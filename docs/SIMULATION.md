# What is simulated, what is real

**Simulated (local, free, repeatable)**
- The chain: a Hardhat node with `chainId: 143`, instant mining. Block times and the "~60 ms" figures printed by the demo are **not** Monad latency.
- The facilitator: `LocalFacilitator` (src/facilitator.ts) does what Monad's does — verify the EIP-3009 authorization, submit `transferWithAuthorization`, pay gas — against the local chain.
- Money: balances are written with `hardhat_setStorageAt` into the USDC balance slot. Guarded: `seedUsdc`/`fundUsdc` refuse any node that is not a local Hardhat node (tested).
- The relayer key is Hardhat's public account #0. Worthless outside a local node.

**Real**
- USDC code: proxy + implementation + the linked signature library, copied from Monad mainnet (`scripts/snapshot-usdc.ts`, block 112557617, read-only), so `transferWithAuthorization` runs the genuine contract logic. (The first attempt reverted because the implementation links an external library; the snapshot now collects linked contracts.)
- EIP-712 domain: our domain separator equals the on-chain `DOMAIN_SEPARATOR` on mainnet and testnet (docs/READONLY-PROBE.md).
- Facilitator payload format: the real facilitator parsed it (docs/READONLY-PROBE.md). It checks funds, so a successful settlement against it was **not** exercised.

**Not tested**
- Settlement through the real facilitator; any live transaction; Monad's actual latency; Privy; a real injected wallet; public-RPC log-range limits; behaviour under real load.

**Reproduce:** `npm test` (offline), `npm run demo`, `npm run probe` (read-only network).
