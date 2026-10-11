import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashDomain, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NETS, USDC_DOMAIN, usdcAbi } from "../src/chain";
import { createApp } from "../src/server";
import { LocalFacilitator } from "../src/facilitator";
import { InvoiceStore, formatUsdc, invoiceNonce, parseUsdc } from "../src/invoice";
import { fundUsdc, seedUsdc } from "../src/sim";
import { simClients, startSimNode } from "../src/simnode";
import { decodeHeader, encodeHeader, requirementsFor, signPayment, typedData, type PaymentPayload } from "../src/x402";
import { payInvoices } from "../src/agent";
import { verifyReceipt } from "../src/receipt";

const net = NETS[143];
let stop = () => {}, base = "", rpc = "";
let clients: ReturnType<typeof simClients>;
let store: InvoiceStore;
let facilitator: LocalFacilitator;
const acct = () => privateKeyToAccount(generatePrivateKey());
const bal = (a: Address) => clients.client.readContract({ address: net.usdc, abi: usdcAbi, functionName: "balanceOf", args: [a] });
const funded = async (usd: string) => { const a = acct(); await fundUsdc(rpc, a.address, parseUsdc(usd)); return a; };

async function newInvoice(payTo: Address, amount: string, description = "test") {
  const r = await fetch(`${base}/api/invoices`, { method: "POST", body: JSON.stringify({ payTo, amount, description }) });
  const j: any = await r.json();
  return { status: r.status, id: j.id as string, url: j.url as string, x402: j.x402 as string, body: j };
}
async function requirements(x402: string) { return (await (await fetch(x402)).json() as any).accepts[0]; }
const send = (url: string, p: PaymentPayload | string) => fetch(url, { headers: { "payment-signature": typeof p === "string" ? p : Buffer.from(JSON.stringify(p)).toString("base64"), accept: "application/json" } });
async function signed(signer: ReturnType<typeof acct>, inv: { url: string; x402: string }) {
  return signPayment(signer, await requirements(inv.x402), net, inv.url);
}

beforeAll(async () => {
  const node = await startSimNode(18545);
  stop = node.stop; rpc = node.url;
  clients = simClients(rpc);
  store = new InvoiceStore();
  facilitator = new LocalFacilitator(clients.client, clients.relayer, net);
  const app = createApp({ store, net, client: clients.client, mode: "sim", facilitator });
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(app.address() as any).port}`;
}, 60_000);
afterAll(() => stop());

describe("units", () => {
  it("parses and formats USDC strictly", () => {
    expect(parseUsdc("4")).toBe(4_000_000n); expect(parseUsdc("0.000001")).toBe(1n); expect(parseUsdc("12.5")).toBe(12_500_000n);
    for (const bad of ["0", "-1", "1e3", "1.0000001", "", "abc", "1,5", "99999999999999"]) expect(() => parseUsdc(bad), bad).toThrow();
    expect(formatUsdc(12_500_000n)).toBe("12.50"); expect(formatUsdc(1n)).toBe("0.000001");
  });
  it("binds the nonce to the invoice id", () => {
    expect(invoiceNonce("abc")).toBe(invoiceNonce("abc")); expect(invoiceNonce("abc")).not.toBe(invoiceNonce("abd"));
  });
  it("refuses to seed or fund anything that is not a local Hardhat node", async () => {
    await expect(seedUsdc("http://127.0.0.1:1")).rejects.toThrow(/not a local Hardhat node/);
    await expect(fundUsdc("http://127.0.0.1:1", acct().address, 1n)).rejects.toThrow(/not a local Hardhat node/);
  });
});

describe("the simulated USDC is Monad's real contract logic", () => {
  it("reports the metadata and EIP-712 domain separator the docs promise", async () => {
    const r = (fn: string) => clients.client.readContract({ address: net.usdc, abi: usdcAbi, functionName: fn as any });
    expect(await r("name")).toBe("USDC"); expect(await r("version")).toBe("2"); expect(await r("decimals")).toBe(6);
    const expected = hashDomain({ domain: { ...USDC_DOMAIN, chainId: 143n, verifyingContract: net.usdc },
      types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } });
    expect(await r("DOMAIN_SEPARATOR")).toBe(expected);
  });
  it("funding writes the balance slot the contract actually reads", async () => {
    const a = await funded("7.5"); expect(await bal(a.address)).toBe(7_500_000n);
  });
});

describe("one URL, two kinds of payer", () => {
  it("serves a pay page to browsers and HTTP 402 to software, on the same URL", async () => {
    const payTo = acct().address; const inv = await newInvoice(payTo, "4.00", "Logo design");
    expect(inv.status).toBe(201);
    const page = await fetch(inv.url, { headers: { accept: "text/html" } });
    expect(page.status).toBe(200); expect(page.headers.get("content-type")).toContain("text/html");
    const soft = await fetch(inv.url); expect(soft.status).toBe(402);
    const pr = decodeHeader(soft.headers.get("payment-required")!); expect(pr.accepts[0].extra.nonce).toBe(invoiceNonce(inv.id));
    expect(pr.accepts[0]).toMatchObject({ scheme: "exact", network: "eip155:143", amount: "4000000", payTo, asset: net.usdc });
  });
  it("escapes invoice text in the pay page", async () => {
    const inv = await newInvoice(acct().address, "1", `<script>alert(1)</script>"x`);
    const html = await (await fetch(inv.url, { headers: { accept: "text/html" } })).text();
    expect(html).not.toContain("<script>alert(1)"); expect(html).toContain("&lt;script&gt;alert(1)");
  });
  it("rejects bad invoice input", async () => {
    for (const body of [{ payTo: "nope", amount: "1" }, { payTo: acct().address, amount: "-1" }, { payTo: acct().address, amount: "1e3" }, { payTo: acct().address, amount: "1", dueInDays: 99999 }])
      expect((await fetch(`${base}/api/invoices`, { method: "POST", body: JSON.stringify(body) })).status, JSON.stringify(body)).toBe(400);
    expect((await fetch(`${base}/api/invoices`, { method: "POST", body: "x".repeat(20_000) })).status).toBe(413);
  });
});

describe("paying", () => {
  it("settles a signed authorization, moves the money, and proves it from chain logs", async () => {
    const payer = await funded("10"); const payTo = acct().address; const inv = await newInvoice(payTo, "4.00");
    const res = await send(inv.url, await signed(payer, inv)); const body: any = await res.json();
    expect(res.status).toBe(200); expect(body).toMatchObject({ status: "paid", verifiedFromLogs: true, payer: payer.address });
    expect(await bal(payTo)).toBe(4_000_000n); expect(await bal(payer.address)).toBe(6_000_000n);
    const rec: any = await (await fetch(`${inv.url}/receipt`)).json();
    expect(rec).toMatchObject({ status: "paid", verifiedFromLogs: true, tx: body.tx });
    const direct = await verifyReceipt(clients.client, net, store.get(inv.id)!, body.tx); expect(direct.ok).toBe(true);
    expect(decodeHeader(res.headers.get("payment-response")!).success).toBe(true);
    // payer needed no native gas: the relayer paid
    expect(await clients.client.getBalance({ address: payer.address })).toBe(0n);
  });
  it("lets the same paid URL answer 200 afterwards and refuses a second payment", async () => {
    const payer = await funded("20"); const payTo = acct().address; const inv = await newInvoice(payTo, "5");
    const p = await signed(payer, inv), p2 = await signed(payer, inv);   // second one signed before the invoice is paid
    expect((await send(inv.url, p)).status).toBe(200);
    expect((await fetch(inv.x402)).status).toBe(200);
    const again = await send(inv.url, p); expect(again.status).toBe(409);
    const fresh = await send(inv.url, p2); expect(fresh.status).toBe(409);
    expect(await bal(payTo)).toBe(5_000_000n); expect(await bal(payer.address)).toBe(15_000_000n);
  });
  it("blocks a second payer even when the first paid outside this server (on-chain double-pay check)", async () => {
    const a = await funded("10"), b = await funded("10"); const payTo = acct().address; const inv = await newInvoice(payTo, "3");
    const out = await facilitator.settle(await signed(a, inv)); expect(out.success).toBe(true);   // paid straight through the facilitator
    const res = await send(inv.url, await signed(b, inv)); expect(res.status).toBe(409);
    expect(await bal(b.address)).toBe(10_000_000n); expect(await bal(payTo)).toBe(3_000_000n);
    expect(store.get(inv.id)!.status).toBe("paid");
  });
  it("lets exactly one of two simultaneous payers win", async () => {
    const a = await funded("10"), b = await funded("10"); const payTo = acct().address; const inv = await newInvoice(payTo, "2");
    const [pa, pb] = [await signed(a, inv), await signed(b, inv)];
    const codes = (await Promise.all([send(inv.url, pa), send(inv.url, pb)])).map((r) => r.status).sort();
    expect(codes).toEqual([200, 409]); expect(await bal(payTo)).toBe(2_000_000n);
  });
});

describe("what must NOT get paid", () => {
  async function expectRejected(mut: (p: PaymentPayload) => Promise<PaymentPayload> | PaymentPayload | void, reason: RegExp, opts: { fundPayer?: string } = {}) {
    const payer = await funded(opts.fundPayer ?? "10"); const payTo = acct().address; const inv = await newInvoice(payTo, "4");
    let p = await signed(payer, inv); p = (await mut(p)) ?? p;
    const res = await send(inv.url, p); const body: any = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(400); expect(body.error).toMatch(reason);
    expect(await bal(payTo)).toBe(0n); expect(store.get(inv.id)!.status).toBe("open");
    return { payer, inv };
  }
  it("wrong amount", () => expectRejected((p) => { p.payload.authorization.value = "3999999"; }, /wrong_amount/));
  it("wrong recipient", () => expectRejected((p) => { p.payload.authorization.to = acct().address; }, /wrong_recipient/));
  it("nonce not bound to this invoice", () => expectRejected((p) => { p.payload.authorization.nonce = invoiceNonce("someone-elses"); }, /nonce_not_bound/));
  it("wrong network", () => expectRejected((p) => { p.accepted.network = "eip155:10143"; }, /wrong_network_or_asset/));
  it("wrong asset", () => expectRejected((p) => { p.accepted.asset = acct().address; }, /wrong_network_or_asset/));
  it("insufficient funds", () => expectRejected(() => {}, /insufficient_funds/, { fundPayer: "1" }));
  it("a tampered signature (someone else's `from`)", async () => {
    const victim = await funded("50"); const attacker = acct(); const payTo = acct().address; const inv = await newInvoice(payTo, "4");
    const p = await signed(attacker, inv); p.payload.authorization.from = victim.address;
    const res = await send(inv.url, p); expect(res.status).toBe(402); expect((await res.json() as any).error).toBe("invalid_signature");
    expect(await bal(victim.address)).toBe(50_000_000n); expect(await bal(payTo)).toBe(0n);
  });
  it("an authorization about to expire", async () => {
    const payer = await funded("10"); const payTo = acct().address; const inv = await newInvoice(payTo, "4");
    const req = await requirements(inv.x402); const now = Math.floor(Date.now() / 1000);
    const authorization = { from: payer.address, to: payTo, value: req.amount, validAfter: String(now - 60), validBefore: String(now + 2), nonce: req.extra.nonce };
    const signature = await payer.signTypedData(typedData(authorization, net));
    const res = await send(inv.url, { x402Version: 2, accepted: req, payload: { authorization, signature } });
    expect((await res.json() as any).error).toBe("authorization_expired"); expect(await bal(payTo)).toBe(0n);
  });
  it("garbage headers", async () => {
    const inv = await newInvoice(acct().address, "1");
    expect((await send(inv.url, "%%%not-base64-json")).status).toBe(400);
    expect((await send(inv.url, encodeHeader({ x402Version: 1 }))).status).toBe(400);
  });
  it("unknown invoice", async () => { expect((await fetch(`${base}/i/aaaaaaaaaaaa`)).status).toBe(404); });
  it("a plain USDC transfer is NOT a payment (no invoice-bound authorization)", async () => {
    const payer = await funded("10"); const payTo = acct().address; const inv = await newInvoice(payTo, "4");
    const { relayer, client } = clients;
    await fundUsdc(rpc, relayer.account.address, 4_000_000n);
    const tx = await relayer.writeContract({ address: net.usdc, abi: usdcAbi, functionName: "transfer", args: [payTo, 4_000_000n], chain: relayer.chain, account: relayer.account });
    await client.waitForTransactionReceipt({ hash: tx });
    expect(await bal(payTo)).toBe(4_000_000n);
    const check = await verifyReceipt(client, net, store.get(inv.id)!, tx);
    expect(check).toEqual({ ok: false, reason: "no_authorization_for_this_invoice" });
    expect((await (await fetch(`${inv.url}/receipt`)).json() as any).status).toBe("open");
    void payer;
  });
  it("a payment for invoice A cannot be passed off as payment for invoice B", async () => {
    const payer = await funded("20"); const payTo = acct().address;
    const a = await newInvoice(payTo, "4"), b = await newInvoice(payTo, "4");
    const [forA, alsoForA] = [await signed(payer, a), await signed(payer, a)];
    const out = await send(a.url, forA); const tx = ((await out.json()) as any).tx;
    expect(await verifyReceipt(clients.client, net, store.get(b.id)!, tx)).toMatchObject({ ok: false });
    const wrong = await send(b.url, alsoForA);   // A's nonce presented on B's URL
    expect(wrong.status).toBe(402); expect((await wrong.json() as any).error).toBe("nonce_not_bound_to_invoice");
    expect(store.get(b.id)!.status).toBe("open");
  });
});

describe("AP agent", () => {
  it("pays only invoices with a purchase order that covers them", async () => {
    const agent = await funded("100"); const payTo = acct().address;
    const ok = await newInvoice(payTo, "4"), noPo = await newInvoice(payTo, "9"), tooBig = await newInvoice(payTo, "12.50");
    const results = await payInvoices([ok.url, noPo.url, tooBig.url], { signer: agent, net, po: { [ok.id]: parseUsdc("5"), [tooBig.id]: parseUsdc("10") } });
    expect(results.map((r) => [r.status, r.reason])).toEqual([["paid", undefined], ["rejected", "no_purchase_order"], ["rejected", "exceeds_purchase_order"]]);
    expect(await bal(payTo)).toBe(4_000_000n); expect(await bal(agent.address)).toBe(96_000_000n);
  });
  it("refuses an invoice that asks for a different asset", async () => {
    const agent = await funded("10");
    const evil = async (url: string) => { const r: any = { x402Version: 2, accepts: [{ ...requirementsFor({ id: "a1a1a1a1a1a1", payTo: acct().address, amount: "1", description: "", createdAt: 0, due: 0, status: "open" }, net), asset: acct().address }] };
      return new Response(JSON.stringify(r), { status: 402 }); };
    const res = await payInvoices(["http://evil/i/a1a1a1a1a1a1"], { signer: agent, net, po: { a1a1a1a1a1a1: 1_000_000n }, fetchImpl: evil as any });
    expect(res[0]).toMatchObject({ status: "rejected", reason: "unexpected_network_or_asset" });
  });
});
