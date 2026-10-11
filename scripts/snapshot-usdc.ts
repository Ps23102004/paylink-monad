// Read-only: copies Monad mainnet USDC (proxy + implementation bytecode, low storage slots) into fixtures/usdc-monad.json
// so tests can seed a local chain with the REAL contract logic without any network access.
import { createPublicClient, http, getAddress, type Hex } from "viem";
import { writeFileSync } from "node:fs";

const USDC = getAddress("0x754704Bc059F8C67012fEd69BC8A327a5aafb603");
const c0 = createPublicClient({ transport: http("https://rpc.monad.xyz") });
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ZOS_IMPL_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3"; // Circle FiatTokenProxy (zeppelinos)
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const proxyCode = await c0.getCode({ address: USDC });
let implRaw = await c0.getStorageAt({ address: USDC, slot: IMPL_SLOT });
if (!implRaw || BigInt(implRaw) === 0n) implRaw = await c0.getStorageAt({ address: USDC, slot: ZOS_IMPL_SLOT });
const usesEip1967 = !!implRaw && BigInt(implRaw) !== 0n;
const impl = usesEip1967 ? getAddress(("0x" + implRaw!.slice(26)) as Hex) : null;
const implCode = impl ? await c0.getCode({ address: impl }) : null;
// Linked libraries: Circle's FiatToken calls an external signature-checker library. Find every PUSH20 <addr> in the
// implementation (and in what it links) that has code on chain, and snapshot it too.
const libs: Record<string, Hex> = {};
async function collectLibs(code: Hex | null | undefined, depth = 0) {
  if (!code || depth > 2) return;
  const hex = code.slice(2);
  for (let i = 0; i + 42 < hex.length; i += 2) {
    if (hex.slice(i, i + 2) !== "73") continue;
    const cand = getAddress(("0x" + hex.slice(i + 2, i + 42)) as Hex);
    if (cand === USDC || cand === impl || libs[cand] || /^0x0{30}/.test(cand)) continue;
    const c = await c0.getCode({ address: cand }).catch(() => undefined);
    if (c && c !== "0x") { libs[cand] = c; await collectLibs(c, depth + 1); }
  }
}
await collectLibs(implCode);
const slots: Record<string, Hex> = {};
for (let i = 0; i < 64; i++) {
  const slot = ("0x" + i.toString(16).padStart(64, "0")) as Hex;
  const v = await c0.getStorageAt({ address: USDC, slot });
  if (v && BigInt(v) !== 0n) slots[slot] = v;
}
for (const s of [IMPL_SLOT, ZOS_IMPL_SLOT, ADMIN_SLOT]) {
  const v = await c0.getStorageAt({ address: USDC, slot: s as Hex });
  if (v && BigInt(v) !== 0n) slots[s] = v;
}
const block = await c0.getBlockNumber();
writeFileSync("fixtures/usdc-monad.json", JSON.stringify({ chainId: 143, address: USDC, block: block.toString(), proxyCode, impl, implCode, libs, slots }, null, 1));
console.log({ USDC, impl, proxyBytes: (proxyCode!.length - 2) / 2, implBytes: implCode ? (implCode.length - 2) / 2 : 0, slots: Object.keys(slots).length, libs: Object.keys(libs), block });
