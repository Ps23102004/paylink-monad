import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { build } from "esbuild";
import { formatUsdc, invoiceNonce, InvoiceStore, type Invoice } from "./invoice";
import { decodeHeader, encodeHeader, paymentRequired, requirementsFor, type PaymentPayload } from "./x402";
import { findPaymentByNonce, verifyReceipt } from "./receipt";
import type { Facilitator } from "./facilitator";
import type { Net } from "./chain";
import type { PublicClient } from "viem";

export type Mode = "sim" | "testnet" | "mainnet";
export type AppDeps = {
  store: InvoiceStore; facilitator: Facilitator; net: Net; client: PublicClient; mode: Mode;
  /** sim only: funds a burner wallet with test USDC on the local chain */
  simFund?: (address: `0x${string}`) => Promise<void>;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MODE_LABEL: Record<Mode, string> = {
  sim: "SIMULATION · local chain seeded with Monad mainnet USDC code · test money only",
  testnet: "Monad TESTNET · test USDC",
  mainnet: "Monad MAINNET · real USDC",
};
const json = (res: ServerResponse, code: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
};
async function readBody(req: IncomingMessage, max = 10_000): Promise<string> {
  let n = 0; const chunks: Buffer[] = [];
  for await (const c of req) { n += (c as Buffer).length; if (n > max) throw new Error("body too large"); chunks.push(c as Buffer); }
  return Buffer.concat(chunks).toString("utf8");
}

let clientJs: Promise<string> | undefined;
const bundleClient = () => (clientJs ??= build({ entryPoints: [new URL("./client/pay.ts", import.meta.url).pathname], bundle: true, write: false, format: "iife", minify: true, platform: "browser" }).then((r) => r.outputFiles[0].text));

function payPage(inv: Invoice, d: AppDeps, base: string) {
  const status = inv.status === "paid" ? `<p class="ok">PAID · tx ${esc(inv.paidTx ?? "")}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${esc(inv.id)} · Paylink</title>
<style>:root{--bg:#0e1116;--fg:#e8edf2;--mut:#8b97a5;--acc:#6e56ff;--ok:#2fbf71;--bad:#ff6b6b;--card:#171c24}@media(prefers-color-scheme:light){:root{--bg:#f6f7f9;--fg:#14181f;--mut:#5b6672;--card:#fff}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:520px;margin:0 auto;padding:24px 16px}
.banner{background:#2a2140;color:#d9ccff;padding:8px 12px;border-radius:8px;font-size:13px;margin-bottom:16px}.card{background:var(--card);border-radius:14px;padding:20px}
h1{font-size:28px;margin:.2em 0}.amt{font-size:40px;font-weight:700}.mut{color:var(--mut);font-size:14px;word-break:break-all}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad)}
button{background:var(--acc);color:#fff;border:0;border-radius:10px;padding:12px 16px;font-size:16px;cursor:pointer;margin:6px 6px 0 0}button.sec{background:transparent;border:1px solid var(--mut);color:var(--fg)}pre{white-space:pre-wrap;word-break:break-all;font-size:12px}</style></head>
<body><main><div class="banner">${esc(MODE_LABEL[d.mode])}</div><div class="card">
<div class="mut">Invoice ${esc(inv.id)} · due ${new Date(inv.due * 1000).toISOString().slice(0, 10)}</div>
<div class="amt">${formatUsdc(BigInt(inv.amount))} USDC</div><div>${esc(inv.description || "—")}</div>
<div class="mut">Pay to ${esc(inv.payTo)}</div>${status}
<div id="actions" ${inv.status === "paid" ? "hidden" : ""}>
<button id="burner">Pay with demo burner wallet</button><button class="sec" id="injected">Pay with browser wallet</button>
${d.mode === "sim" ? '<button class="sec" id="fund">Fund burner (sim faucet)</button>' : ""}</div>
<div id="who" class="mut"></div><pre id="out"></pre></div>
<p class="mut">Same URL, two payers: wallets pay here; software gets HTTP 402 at <code>${esc(base)}/i/${esc(inv.id)}.x402</code> and pays over x402.</p></main>
<script>window.PAYLINK=${JSON.stringify({ id: inv.id, mode: d.mode, chainId: d.net.chainId })};</script><script src="/pay.js"></script></body></html>`;
}

export function createApp(d: AppDeps) {
  const inflight = new Set<string>();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const base = `${url.protocol}//${url.host}`;
      const path = url.pathname;

      if (req.method === "GET" && path === "/api/info") return json(res, 200, { mode: d.mode, label: MODE_LABEL[d.mode], chainId: d.net.chainId, usdc: d.net.usdc, network: d.net.caip });
      if (req.method === "GET" && path === "/pay.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(await bundleClient()); }
      if (req.method === "GET" && path === "/") return html(res, home(d));
      if (req.method === "POST" && path === "/api/invoices") {
        let body: any;
        try { body = JSON.parse(await readBody(req)); } catch (e: any) { return e?.message === "body too large" ? json(res, 413, { error: "body too large" }) : json(res, 400, { error: "invalid JSON body" }); }
        try {
          const inv = d.store.create({ ...body, createdBlock: await d.client.getBlockNumber().catch(() => undefined) });
          return json(res, 201, { id: inv.id, url: `${base}/i/${inv.id}`, x402: `${base}/i/${inv.id}.x402`, amount: inv.amount, payTo: inv.payTo });
        } catch (e: any) { return json(res, 400, { error: e.message }); }
      }
      if (req.method === "POST" && path === "/api/sim/fund") {
        if (d.mode !== "sim" || !d.simFund) return json(res, 404, { error: "not available outside simulation" });
        const b = JSON.parse(await readBody(req)).address; if (!/^0x[0-9a-fA-F]{40}$/.test(b)) return json(res, 400, { error: "bad address" });
        await d.simFund(b); return json(res, 200, { funded: b });
      }

      const m = /^\/i\/([0-9a-f]{12})(\.x402|\/receipt)?$/.exec(path);
      if (!m) return json(res, 404, { error: "not found" });
      const inv = d.store.get(m[1]);
      if (!inv) return json(res, 404, { error: "unknown invoice" });
      const suffix = m[2];
      const resourceUrl = `${base}/i/${inv.id}`;

      if (req.method === "GET" && suffix === "/receipt") {
        if (inv.status !== "paid" || !inv.paidTx) return json(res, 200, { id: inv.id, status: "open" });
        const r = await verifyReceipt(d.client, d.net, inv, inv.paidTx);
        return json(res, 200, { id: inv.id, status: r.ok ? "paid" : "unverified", verifiedFromLogs: r.ok, ...(r.ok ? { payer: r.payer, block: r.block, tx: r.tx } : { reason: r.reason }) });
      }
      if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });

      const sigHeader = req.headers["payment-signature"] as string | undefined;
      if (!sigHeader) {
        const wantsHtml = !suffix && (req.headers.accept ?? "").includes("text/html");
        if (wantsHtml) return html(res, payPage(inv, d, base));
        if (inv.status === "paid") return json(res, 200, { id: inv.id, status: "paid", tx: inv.paidTx });
        const pr = paymentRequired(inv, d.net, resourceUrl);
        return json(res, 402, pr, { "payment-required": encodeHeader(pr) });
      }

      // ---- payment attempt ----
      const reject = (code: number, reason: string) => json(res, code, { error: reason, invoice: inv.id }, code === 402 ? { "payment-required": encodeHeader(paymentRequired(inv, d.net, resourceUrl)) } : {});
      if (inv.status === "paid") return reject(409, "already_paid");
      let p: PaymentPayload;
      try { p = decodeHeader(sigHeader); } catch { return reject(400, "malformed_payment_header"); }
      const want = requirementsFor(inv, d.net), a = p?.payload?.authorization;
      if (p?.x402Version !== 2 || !a || !p.payload.signature) return reject(400, "malformed_payment");
      if (p.accepted?.scheme !== "exact" || p.accepted.network !== want.network || p.accepted.asset?.toLowerCase() !== want.asset.toLowerCase()) return reject(402, "wrong_network_or_asset");
      if (a.to.toLowerCase() !== want.payTo.toLowerCase()) return reject(402, "wrong_recipient");
      if (a.value !== want.amount) return reject(402, "wrong_amount");
      if (a.nonce !== invoiceNonce(inv.id)) return reject(402, "nonce_not_bound_to_invoice");
      // pin what the facilitator sees to OUR requirements, not whatever the client claims
      p.accepted = want;

      if (inflight.has(inv.id)) return reject(409, "payment_in_flight");
      inflight.add(inv.id);
      try {
        const prior = await findPaymentByNonce(d.client, d.net, inv).catch(() => null);
        if (prior) { const r = await verifyReceipt(d.client, d.net, inv, prior); if (r.ok) d.store.markPaid(inv.id, prior); return reject(409, "already_paid"); }
        const v = await d.facilitator.verify(p);
        if (!v.isValid) return reject(402, v.invalidReason ?? "invalid_payment");
        const s = await d.facilitator.settle(p);
        if (!s.success || !s.transaction) return reject(402, s.errorReason ?? "settlement_failed");
        const r = await verifyReceipt(d.client, d.net, inv, s.transaction);
        if (!r.ok) return reject(502, `settled_but_unverified:${r.reason}`);
        d.store.markPaid(inv.id, s.transaction);
        return json(res, 200, { id: inv.id, status: "paid", tx: s.transaction, payer: r.payer, block: r.block, verifiedFromLogs: true },
          { "payment-response": encodeHeader({ success: true, transaction: s.transaction, network: d.net.caip, payer: r.payer }) });
      } finally { inflight.delete(inv.id); }
    } catch (e: any) {
      json(res, 500, { error: "internal_error", detail: String(e?.message ?? e).slice(0, 200) });
    }
  });
}
function html(res: ServerResponse, body: string) { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'" }); res.end(body); }
function home(d: AppDeps) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paylink</title>
<style>body{font:16px system-ui;max-width:480px;margin:24px auto;padding:0 16px;background:#0e1116;color:#e8edf2}input,button{font:inherit;padding:10px;margin:4px 0;width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #445}button{background:#6e56ff;color:#fff;border:0}.b{background:#2a2140;color:#d9ccff;padding:8px 12px;border-radius:8px;font-size:13px}</style>
<div class="b">${esc(MODE_LABEL[d.mode])}</div><h1>Paylink</h1><p>One invoice link. People pay it with a wallet; software pays the same URL over x402.</p>
<input id="to" placeholder="Pay to address (0x…)"><input id="amt" placeholder="Amount in USDC, e.g. 4.00"><input id="desc" placeholder="Description">
<button id="go">Create invoice</button><p id="r"></p>
<script>go.onclick=async()=>{const r=await fetch('/api/invoices',{method:'POST',body:JSON.stringify({payTo:to.value,amount:amt.value,description:desc.value})});const j=await r.json();document.getElementById('r').innerHTML=r.ok?'<a style="color:#9f8cff" href="'+j.url+'">'+j.url+'</a>':'Error: '+(j.error||r.status).replace(/</g,'&lt;')}</script>`;
}
