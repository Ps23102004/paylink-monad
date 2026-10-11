// Browser client for the invoice page. Same protocol as the AP agent: GET .x402 -> sign EIP-3009 -> retry with PAYMENT-SIGNATURE.
import { type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

declare global { interface Window { PAYLINK: { id: string; mode: string; chainId: number }; ethereum?: any } }
const { id, mode, chainId } = window.PAYLINK;
const $ = (s: string) => document.getElementById(s)!;
const out = $("out"), who = $("who");
const log = (m: string) => { out.textContent += m + "\n"; };

const AUTH_TYPES = { TransferWithAuthorization: [
  { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" } ] };

function burner() {
  let k = localStorage.getItem("paylink.burner") as Hex | null;
  if (!k) { k = generatePrivateKey(); localStorage.setItem("paylink.burner", k); }
  return privateKeyToAccount(k);
}
async function pay(signer: { address: `0x${string}`; sign: (td: any) => Promise<Hex> }) {
  out.textContent = "";
  const r = await fetch(`/i/${id}.x402`);
  if (r.status !== 402) { log(`unexpected ${r.status}: ${await r.text()}`); return; }
  const req = (await r.json()).accepts[0];
  const now = Math.floor(Date.now() / 1000);
  const authorization = { from: signer.address, to: req.payTo, value: req.amount, validAfter: String(now - 60), validBefore: String(now + req.maxTimeoutSeconds), nonce: req.extra.nonce };
  const td = { domain: { name: req.extra.name, version: req.extra.version, chainId, verifyingContract: req.asset }, types: AUTH_TYPES, primaryType: "TransferWithAuthorization",
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) } };
  log("signing authorization (no gas, no transaction from you)…");
  const signature = await signer.sign(td);
  const payload = { x402Version: 2, accepted: req, payload: { authorization, signature } };
  const t0 = performance.now();
  const rr = await fetch(`/i/${id}`, { headers: { "payment-signature": btoa(JSON.stringify(payload)), accept: "application/json" } });
  const body = await rr.json();
  if (rr.ok) { log(`PAID in ${Math.round(performance.now() - t0)} ms (sign→verified) · tx ${body.tx}\nverified from chain logs: ${body.verifiedFromLogs}`); setTimeout(() => location.reload(), 1500); }
  else log(`not paid: ${body.error}`);
}
const toJson = (td: any) => JSON.stringify(td, (_, v) => (typeof v === "bigint" ? v.toString() : v));

$("burner")?.addEventListener("click", async () => { const a = burner(); who.textContent = `burner wallet ${a.address}`; await pay({ address: a.address, sign: (td) => a.signTypedData(td) }); });
$("injected")?.addEventListener("click", async () => {
  if (!window.ethereum) return log("no browser wallet found");
  const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
  who.textContent = `wallet ${address}`;
  await pay({ address, sign: (td) => window.ethereum.request({ method: "eth_signTypedData_v4", params: [address, toJson({
    domain: td.domain, types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }], ...td.types },
    primaryType: td.primaryType, message: td.message })] }) });
});
$("fund")?.addEventListener("click", async () => {
  const a = burner(); who.textContent = `burner wallet ${a.address}`;
  const r = await fetch("/api/sim/fund", { method: "POST", body: JSON.stringify({ address: a.address }) });
  log(r.ok ? "burner funded with simulated USDC (sim only)" : `fund failed: ${r.status}`);
});
if (mode !== "sim") $("burner")?.setAttribute("title", "Burner wallets hold no funds unless you send them some. Do not fund with more than you can lose.");
