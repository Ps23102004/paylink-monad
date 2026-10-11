// Simulation helpers: seed a LOCAL hardhat node (chainId 143) with Monad mainnet's real USDC bytecode + state,
// and fund test accounts. Never touches a live network (writes use hardhat_* RPCs only).
import { readFileSync } from "node:fs";
import { encodeAbiParameters, keccak256, pad, toHex, type Address, type Hex } from "viem";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/usdc-monad.json", import.meta.url), "utf8"));
export const USDC_FIXTURE = fixture as { address: Address; impl: Address; block: string };
const BALANCE_SLOT = 9n; // FiatTokenV2_2 balanceAndBlacklistStates

async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j: any = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
export async function isLocalSimNode(url: string) {
  try { return (await rpc(url, "web3_clientVersion", [])).toLowerCase().includes("hardhat"); } catch { return false; }
}
export async function seedUsdc(url: string) {
  if (!(await isLocalSimNode(url))) throw new Error("refusing to seed: not a local Hardhat node");
  await rpc(url, "hardhat_setCode", [fixture.address, fixture.proxyCode]);
  await rpc(url, "hardhat_setCode", [fixture.impl, fixture.implCode]);
  for (const [addr, code] of Object.entries<string>(fixture.libs ?? {})) await rpc(url, "hardhat_setCode", [addr, code]);
  for (const [slot, val] of Object.entries<string>(fixture.slots)) await rpc(url, "hardhat_setStorageAt", [fixture.address, slot, val]);
}
export async function fundUsdc(url: string, to: Address, atomic: bigint) {
  if (!(await isLocalSimNode(url))) throw new Error("refusing to fund: not a local Hardhat node");
  const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [to, BALANCE_SLOT]));
  await rpc(url, "hardhat_setStorageAt", [fixture.address, slot, pad(toHex(atomic), { size: 32 })]);
}
export async function needsSeed(url: string) {
  const code = await rpc(url, "eth_getCode", [fixture.address, "latest"]);
  return !code || code === "0x";
}
