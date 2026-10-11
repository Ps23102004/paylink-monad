# Judge FAQ

**Is this live on Monad?** Not yet. It runs on a local simulation chain with Monad mainnet's real USDC bytecode; the EIP-712 domain and facilitator payload were checked read-only against the live network (docs/READONLY-PROBE.md). The live run is [PENDING — fill in or leave "not done"]. `scripts/day0-live.ts` does it with a fresh throwaway key.

**Why not just use an existing x402 library?** Packaged x402 middleware assumes one fixed price and recipient per route and a random payment nonce. Invoices need a per-invoice amount/recipient and a nonce bound to the invoice, so we wrote the 402 response and verification ourselves. Cost: stock x402 clients are rejected (`nonce_not_bound_to_invoice`); our browser and agent clients read `extra.nonce`.

**How do you know an invoice is paid?** Re-derived from the settlement transaction's logs: one `AuthorizationUsed(nonce = keccak(invoiceId))` and a `Transfer` of the exact amount to the invoice's `payTo` from the same authorizer. A plain USDC transfer of the same amount does not count (tested).

**Can two people pay the same invoice?** EIP-3009 nonces are per-payer, so the token alone wouldn't stop it. The server scans for the invoice nonce on-chain before accepting a payment and serialises in-flight payments (tested: simultaneous payers → exactly one succeeds).

**What does the facilitator see / trust?** It verifies and submits the authorization and pays gas. The server pins amount, recipient, network, asset and nonce to the invoice before asking it, and re-checks the result from chain logs. A dishonest facilitator can refuse to settle; it cannot make us mark a wrong payment as paid.

**Why would an agent pay this?** It won't pay blindly: no purchase order, an amount above the order, or the wrong network/asset → refused (tested).

**Is Monad load-bearing?** For the protocol, no: it's chain-agnostic. Monad is where the facilitator and native USDC we depend on are live, and ~0.6 s finality (per docs, not measured by us) makes "PAID while the payer is still looking" plausible.

**Market?** Unvalidated. Incumbents exist (Request Finance, Acctual, PayRequest). We have no users, sponsor, or off-ramp integration, and we do not claim savings numbers.

**What would break first in production?** In-memory invoice store, unauthenticated invoice creation, no rate limiting, single facilitator dependency, public-RPC log-range limits.

**Privy / embedded wallets?** Not integrated.

**AI use:** built with Claude Code; the author reviewed the protocol logic and tests. [TODO: confirm and name who can explain the code.]
