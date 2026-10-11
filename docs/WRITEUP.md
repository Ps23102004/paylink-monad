# Paylink — write-up (Metropolis · Track 2: Consumer Products & Payments)

**One invoice link that a person and a software agent can both pay.**

## Problem
Freelancers invoice clients in other countries and wait on slow, fee-heavy rails. Stablecoin invoicing tools exist, but they assume a human with a wallet on both sides and a server that says "paid". Finance teams are also starting to automate accounts payable with software that can't click a "pay with crypto" button.

## What we built
- **One URL, two payers.** Browsers get a pay page; software gets HTTP 402 with x402 v2 requirements on the same URL and pays over the same rail.
- **Invoice-bound authorization.** The EIP-3009 nonce is `keccak256(invoiceId)`. A payment authorized for invoice A cannot settle invoice B.
- **Paid only if the chain says so.** After settlement we re-read the transaction logs for exactly one `AuthorizationUsed(nonce)` and a matching USDC `Transfer`. We never trust the facilitator's, or our own, word. A second payer is blocked by an on-chain nonce scan.
- **Gasless for the payer.** The payer signs; the facilitator submits and pays gas.
- **An AP agent with guardrails.** Pays only invoices with a purchase order that covers them, on the expected network and asset.

## Why Monad
Monad hosts an x402 facilitator on mainnet and testnet and native USDC, so the whole flow is signature → settlement in seconds. Docs state ~0.6 s finality (docs.monad.xyz); **we did not measure it.** The protocol itself is chain-agnostic: Monad is where the facilitator and native USDC we use are live.

## Honest status
- 26 automated tests pass on a local simulation chain that runs Monad mainnet's real USDC bytecode (see docs/SIMULATION.md). The EIP-712 domain matches live mainnet and testnet USDC, and the real facilitator accepted our payload format in a read-only check (docs/READONLY-PROBE.md).
- **Live Day-0 run on Monad: [PENDING — TODO fill tx hash / "not done"].**
- No users, no sponsor, no off-ramp integration. Cross-border savings are unvalidated.
- Not integrated: Privy. Browser wallet path untested with a real wallet.

## Prior art we know about
Request Finance, Acctual (stablecoin invoicing, accounting export), PayRequest (invoices payable by agents over x402 on Base/Solana). Our difference: one shared URL and rail for wallet and agent payers, invoice-bound nonce, and a log-derived receipt anyone can re-check without our server.

## Links
Repo: [TODO public URL] · Demo video: [TODO] · Deck: [TODO] · Team: [TODO names/contacts]
