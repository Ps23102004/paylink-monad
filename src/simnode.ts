import { spawn, type ChildProcess } from "node:child_process";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isLocalSimNode, needsSeed, seedUsdc } from "./sim";

// Hardhat's well-known account #0: a PUBLIC test key printed by every Hardhat install (not a secret; worthless outside a local node). Used as the sim relayer.
export const SIM_RELAYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const simChain = defineChain({ id: 143, name: "Monad (local simulation)", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } });

export async function startSimNode(port: number): Promise<{ url: string; stop: () => void }> {
  const url = `http://127.0.0.1:${port}`;
  if (await isLocalSimNode(url)) { if (await needsSeed(url)) await seedUsdc(url); return { url, stop() {} }; }
  const p: ChildProcess = spawn(new URL("../node_modules/.bin/hardhat", import.meta.url).pathname, ["node", "--port", String(port)], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
  for (let i = 0; i < 80; i++) { if (await isLocalSimNode(url)) break; await new Promise((r) => setTimeout(r, 250)); }
  if (!(await isLocalSimNode(url))) { p.kill(); throw new Error("sim node did not start"); }
  await seedUsdc(url);
  return { url, stop: () => p.kill() };
}
export function simClients(url: string) {
  const chain = defineChain({ ...simChain, rpcUrls: { default: { http: [url] } } });
  const client = createPublicClient({ chain, transport: http(url) });
  const relayer = createWalletClient({ chain, transport: http(url), account: privateKeyToAccount(SIM_RELAYER_KEY) });
  return { client, relayer, chain };
}
