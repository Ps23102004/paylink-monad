// Scripted end-to-end run on the LOCAL SIMULATION chain. Prints a transcript and writes docs/SIM-RUN.md.
// Everything here is simulated: local Hardhat chain seeded with Monad mainnet's USDC code; test money; instant blocks.
import { writeFileSync, mkdirSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NETS, usdcAbi } from "../src/chain";
import { createApp } from "../src/server";
import { LocalFacilitator } from "../src/facilitator";
import { InvoiceStore, formatUsdc, parseUsdc } from "../src/invoice";
import { fundUsdc } from "../src/sim";
import { simClients, startSimNode } from "../src/simnode";
import { signPayment } from "../src/x402";
import { payInvoices } from "../src/agent";

const net = NETS[143];
const node = await startSimNode(18700);
const { client, relayer } = simClients(node.url);
const app = createApp({ store: new InvoiceStore(), net, client, mode: "sim", facilitator: new LocalFacilitator(client, relayer, net) });
await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(app.address() as any).port}`;
const bal = (a: `0x${string}`) => client.readContract({ address: net.usdc, abi: usdcAbi, functionName: "balanceOf", args: [a] });
const lines: string[] = [];
const say = (s = "") => { console.log(s); lines.push(s); };
const mk = async (payTo: string, amount: string, description: string) => (await (await fetch(`${base}/api/invoices`, { method: "POST", body: JSON.stringify({ payTo, amount, description }) })).json()) as any;

const freelancer = privateKeyToAccount(generatePrivateKey()), human = privateKeyToAccount(generatePrivateKey()), agent = privateKeyToAccount(generatePrivateKey());
await fundUsdc(node.url, human.address, parseUsdc("25")); await fundUsdc(node.url, agent.address, parseUsdc("100"));

say("# Simulated run (local chain, Monad mainnet USDC bytecode, test money)\n");
say(`freelancer ${freelancer.address}\nhuman payer ${human.address}\nAP agent    ${agent.address}\n`);

// 1) human path — identical protocol to the browser button
const a = await mk(freelancer.address, "4.00", "Logo design");
say(`## 1. Human pays invoice ${a.id} ($4.00)`);
let t0 = Date.now();
const req = (await (await fetch(a.x402)).json() as any).accepts[0];
const p = await signPayment(human, req, net, a.url);
const r1: any = await (await fetch(a.url, { headers: { "payment-signature": Buffer.from(JSON.stringify(p)).toString("base64"), accept: "application/json" } })).json();
say(`status=${r1.status} verifiedFromLogs=${r1.verifiedFromLogs} tx=${r1.tx}  (${Date.now() - t0} ms on a local instant-mining chain — NOT a Monad latency figure)\n`);

// 2) agent path
const b = await mk(freelancer.address, "4.00", "Landing page copy"), c = await mk(freelancer.address, "9.00", "Unapproved vendor"), d = await mk(freelancer.address, "12.50", "Over the PO");
say("## 2. AP agent works through three more invoice URLs (PO covers b ≤ $5 and d ≤ $10)");
for (const x of await payInvoices([b.url, c.url, d.url], { signer: agent, net, po: { [b.id]: parseUsdc("5"), [d.id]: parseUsdc("10") } }))
  say(`${x.status.toUpperCase().padEnd(9)} ${x.url.split("/").pop()} ${x.reason ?? ""} ${x.tx ?? ""}`);

say("\n## 3. Balances");
say(`freelancer ${formatUsdc(await bal(freelancer.address))} USDC (expected 8.00)\nhuman      ${formatUsdc(await bal(human.address))} (expected 21.00)\nagent      ${formatUsdc(await bal(agent.address))} (expected 96.00)`);
say("\n## 4. Receipts re-derived from chain logs");
for (const inv of [a, b]) say(JSON.stringify(await (await fetch(`${inv.url}/receipt`)).json()));
mkdirSync("docs", { recursive: true }); writeFileSync("docs/SIM-RUN.md", lines.join("\n") + "\n");
node.stop(); process.exit(0);
