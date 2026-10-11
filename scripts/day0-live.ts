// OPTIONAL live Day-0 run on real Monad. Needs a FRESH throwaway PAYER_KEY holding a little USDC (facilitator pays gas).
//   testnet (free): PAYLINK_MODE=testnet PAYER_KEY=0x… PAY_TO=0x… npx tsx scripts/day0-live.ts   (USDC from faucet.circle.com)
//   mainnet (real money): add --i-understand-this-spends-real-usdc ; amount defaults to 0.01 USDC.
// Never reuse a key that was ever pasted anywhere. The key is read from env only and never printed or written.
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { writeFileSync, mkdirSync } from "node:fs";
import { FACILITATOR_URL, NETS, monad, monadTestnet, usdcAbi } from "../src/chain";
import { HttpFacilitator } from "../src/facilitator";
import { InvoiceStore, formatUsdc, parseUsdc } from "../src/invoice";
import { createApp } from "../src/server";
import { signPayment } from "../src/x402";

const mode = process.env.PAYLINK_MODE === "mainnet" ? "mainnet" : "testnet";
if (mode === "mainnet" && !process.argv.includes("--i-understand-this-spends-real-usdc")) { console.error("mainnet spends real USDC. Re-run with --i-understand-this-spends-real-usdc"); process.exit(1); }
const key = process.env.PAYER_KEY as `0x${string}` | undefined, payTo = process.env.PAY_TO as `0x${string}` | undefined;
if (!key || !payTo) { console.error("set PAYER_KEY (fresh throwaway) and PAY_TO"); process.exit(1); }
const amount = process.env.AMOUNT ?? "0.01";
const chain = mode === "mainnet" ? monad : monadTestnet, net = NETS[chain.id];
const client = createPublicClient({ chain, transport: http() });
const payer = privateKeyToAccount(key);
const have = await client.readContract({ address: net.usdc, abi: usdcAbi, functionName: "balanceOf", args: [payer.address] });
console.log(`[${mode}] payer ${payer.address} holds ${formatUsdc(have)} USDC; invoice ${amount}`);
if (have < parseUsdc(amount)) { console.error(`fund ${payer.address} with at least ${amount} USDC on ${chain.name} and re-run`); process.exit(2); }

const store = new InvoiceStore();
const app = createApp({ store, net, client, mode, facilitator: new HttpFacilitator(FACILITATOR_URL) });
await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(app.address() as any).port}`;
const inv: any = await (await fetch(`${base}/api/invoices`, { method: "POST", body: JSON.stringify({ payTo, amount, description: "Paylink Day-0 live test" }) })).json();
const req = (await (await fetch(inv.x402)).json() as any).accepts[0];
const t0 = Date.now();
const res = await fetch(inv.url, { headers: { accept: "application/json", "payment-signature": Buffer.from(JSON.stringify(await signPayment(payer, req, net, inv.url))).toString("base64") } });
const body: any = await res.json(); const ms = Date.now() - t0;
const lines = [`# Day-0 live run · ${mode} · ${new Date().toISOString()}`, `chain ${chain.id} · USDC ${net.usdc}`, `invoice ${inv.id} · ${amount} USDC · payTo ${payTo}`, `HTTP ${res.status} in ${ms} ms (sign→facilitator settle→log verification, includes network round trips)`, JSON.stringify(body), body.tx ? `explorer: ${net.explorer}/tx/${body.tx}` : "NOT PAID"];
console.log(lines.join("\n")); mkdirSync("docs", { recursive: true }); writeFileSync(`docs/DAY0-${mode}.md`, lines.join("\n") + "\n");
process.exit(res.ok ? 0 : 3);
