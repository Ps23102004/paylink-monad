import { signPayment, type Requirements, type Signer } from "./x402";
import type { Net } from "./chain";

export type AgentResult = { url: string; status: "paid" | "rejected" | "failed"; reason?: string; tx?: string; amount?: string; ms?: number };

/**
 * An accounts-payable agent. Pays an invoice URL over x402 ONLY if: network+asset are the expected ones,
 * the invoice id has a purchase order, and the amount is within that PO. Everything else is refused, not paid.
 */
export async function payInvoices(urls: string[], o: { signer: Signer; net: Net; po: Record<string, bigint>; fetchImpl?: typeof fetch }): Promise<AgentResult[]> {
  const f = o.fetchImpl ?? fetch;
  const results: AgentResult[] = [];
  for (const raw of urls) {
    const x402Url = /\.x402$/.test(raw) ? raw : `${raw}.x402`;
    const resourceUrl = x402Url.replace(/\.x402$/, "");
    try {
      const r = await f(x402Url);
      if (r.status === 200) { results.push({ url: raw, status: "rejected", reason: "already_paid" }); continue; }
      if (r.status !== 402) { results.push({ url: raw, status: "failed", reason: `unexpected_status_${r.status}` }); continue; }
      const req: Requirements = (await r.json()).accepts?.[0];
      if (!req || req.scheme !== "exact" || req.network !== o.net.caip || req.asset.toLowerCase() !== o.net.usdc.toLowerCase()) { results.push({ url: raw, status: "rejected", reason: "unexpected_network_or_asset" }); continue; }
      const cap = o.po[req.extra.invoiceId];
      if (cap === undefined) { results.push({ url: raw, status: "rejected", reason: "no_purchase_order", amount: req.amount }); continue; }
      if (BigInt(req.amount) > cap) { results.push({ url: raw, status: "rejected", reason: "exceeds_purchase_order", amount: req.amount }); continue; }
      const t0 = Date.now();
      const payload = await signPayment(o.signer, req, o.net, resourceUrl);
      const pr = await f(resourceUrl, { headers: { "payment-signature": Buffer.from(JSON.stringify(payload)).toString("base64"), accept: "application/json" } });
      const body: any = await pr.json();
      results.push(pr.ok ? { url: raw, status: "paid", tx: body.tx, amount: req.amount, ms: Date.now() - t0 } : { url: raw, status: "failed", reason: body.error });
    } catch (e: any) { results.push({ url: raw, status: "failed", reason: String(e?.message ?? e).slice(0, 120) }); }
  }
  return results;
}
