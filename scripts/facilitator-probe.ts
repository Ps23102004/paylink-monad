// READ-ONLY. No funds, no transactions. Proves our payload + EIP-712 domain are accepted by the real Monad facilitator
// and match the real mainnet USDC contract. Uses a throwaway in-memory key that is never funded or saved.
import { createPublicClient, hashDomain, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { FACILITATOR_URL, NETS, USDC_DOMAIN, monad, monadTestnet, usdcAbi } from "../src/chain";
import { HttpFacilitator } from "../src/facilitator";
import { signPayment, requirementsFor } from "../src/x402";
import type { Invoice } from "../src/invoice";

const out: string[] = [];
const say = (s: string) => { console.log(s); out.push(s); };
say(`# Read-only probe · ${new Date().toISOString()}\n`);
const sup: any = await (await fetch(`${FACILITATOR_URL}/supported`)).json();
say("facilitator /supported (exact): " + JSON.stringify(sup.kinds.filter((k: any) => k.scheme === "exact").map((k: any) => k.network)));

for (const chain of [monad, monadTestnet]) {
  const net = NETS[chain.id];
  const c = createPublicClient({ chain, transport: http() });
  const r = (fn: string) => c.readContract({ address: net.usdc, abi: usdcAbi, functionName: fn as any });
  const sep = await r("DOMAIN_SEPARATOR");
  const mine = hashDomain({ domain: { ...USDC_DOMAIN, chainId: BigInt(chain.id), verifyingContract: net.usdc },
    types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } });
  say(`\n## ${chain.name} (${net.caip}) USDC ${net.usdc}`);
  say(`name=${await r("name")} version=${await r("version")} decimals=${await r("decimals")}`);
  say(`on-chain DOMAIN_SEPARATOR ${sep}\nour computed separator    ${mine}\nmatch: ${sep === mine}`);
  const throwaway = privateKeyToAccount(generatePrivateKey());
  const inv: Invoice = { id: "0123456789ab", payTo: privateKeyToAccount(generatePrivateKey()).address, amount: "10000", description: "probe", createdAt: 0, due: 0, status: "open" };
  const payload = await signPayment(throwaway, requirementsFor(inv, net), net, "http://probe.invalid/i/0123456789ab");
  const v = await new HttpFacilitator(FACILITATOR_URL).verify(payload);
  say(`facilitator /verify on unfunded throwaway ${throwaway.address}: ${JSON.stringify(v)}`);
}
import("node:fs").then((fs) => { fs.mkdirSync("docs", { recursive: true }); fs.writeFileSync("docs/READONLY-PROBE.md", out.join("\n") + "\n"); });
