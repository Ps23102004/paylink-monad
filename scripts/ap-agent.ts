// Usage: AGENT_KEY=0x… PO='{"<invoiceId>":"5.00"}' tsx scripts/ap-agent.ts <invoice-url> [more urls]
// Pays invoice URLs over x402 — only ones with a purchase order that covers them. Sim servers can fund the agent: SIM_FUND=1.
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { NETS } from "../src/chain";
import { payInvoices } from "../src/agent";
import { parseUsdc } from "../src/invoice";

const urls = process.argv.slice(2);
if (!urls.length) { console.error("give at least one invoice URL"); process.exit(1); }
const signer = privateKeyToAccount((process.env.AGENT_KEY as `0x${string}`) ?? generatePrivateKey());
const origin = new URL(urls[0]).origin;
const info: any = await (await fetch(`${origin}/api/info`)).json();
if (process.env.SIM_FUND && info.mode === "sim") await fetch(`${origin}/api/sim/fund`, { method: "POST", body: JSON.stringify({ address: signer.address }) });
const po = Object.fromEntries(Object.entries<string>(JSON.parse(process.env.PO ?? "{}")).map(([k, v]) => [k, parseUsdc(v)]));
console.log(`[${info.mode}] agent ${signer.address} · ${Object.keys(po).length} purchase order(s)`);
for (const r of await payInvoices(urls, { signer, net: NETS[info.chainId], po })) console.log(r.status.toUpperCase().padEnd(9), r.url, r.reason ?? "", r.tx ?? "", r.ms ? `${r.ms}ms` : "");
