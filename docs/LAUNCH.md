# Launch kit

Assets live in [`docs/media/`](media/) and are rebuilt from [`video/`](../video/) with `video/render.sh` (direction and honesty notes: [`video/DESIGN.md`](../video/DESIGN.md)). Everything shown ran in **simulation**: a local chain seeded with Monad mainnet's real USDC bytecode, test money.

| File | What |
|---|---|
| `paylink-launch-20s.mp4` | 20 s launch cut, 1920x1080, code-made SFX |
| `paylink-walkthrough.mp4` | 88 s captioned walkthrough (follows `docs/DEMO-SCRIPT.md`) |
| `launch.gif` | 10 s loop of the one-URL / two-payers moment, 720 px |
| `hero.png` | 1280x640 README banner |
| `social-card.png` | 1200x630 link preview / social image |

## 20-second script (as cut)

| Time | Picture | On-screen words |
|---|---|---|
| 0.0–3.0 | Ledger paper, the real "Pay with demo burner wallet" button; a terminal shutter drops in | "Every invoice assumes *a person with a wallet.*" / "Software can't click "Pay"." |
| 3.0–4.9 | The invoice URL types across the seam: top half ink on paper, bottom half paper on ink | "One invoice link." / "Accept: text/html → a pay page" / "anything else → HTTP 402" |
| 4.9–7.5 | Real pay page rises out of the seam and is paid (pointer click, real signing and PAID states, stamp). Below: real `curl -si` → `HTTP/1.1 402 Payment Required` | "A person opens it *and pays with a wallet.* One signature. No gas." / "Software asks the same URL." / "402 · x402 v2 terms: amount, payee, and a nonce bound to this invoice." |
| 7.5–9.8 | `npm run demo` excerpt (docs/SIM-RUN.md §2): PAID / REJECTED no_purchase_order / REJECTED exceeds_purchase_order | "An AP agent pays only what *a purchase order covers.*" |
| 9.8–11.9 | Terminal takes the frame: `"invoiceId"` → `"nonce"` from the real 402 body, bracket `keccak256(invoiceId) =` | "The nonce *is* the invoice. A signature for this invoice can't pay any other." |
| 11.9–13.9 | Paper drops back: real receipt JSON, a ledger rule scans to `"verifiedFromLogs": true`, then the PAID stamp | "Marked paid only after *the chain logs agree.*" |
| 13.9–15.9 | Real `npm test` names: wrong amount, wrong recipient, tampered signature, second payment refused, two simultaneous payers, invoice A ≠ invoice B | "None of these get paid:" / "Tests 26 passed (26)" |
| 15.9–20.0 | Seam returns; the repo URL types across it | "One invoice link. *Two kinds of payer.*" / `github.com/Ps23102004/paylink-monad` / "Built for Metropolis (Monad). Runs in simulation; not yet live on Monad." |

A persistent `SIMULATION · local chain · test money` tag is on screen for all 20 s.

## Social posts

Only facts from the repo: 26 tests pass; same URL serves a pay page to browsers and HTTP 402 to software; invoice-bound nonce; paid only after logs are re-checked; payer needs no gas; the agent refuses invoices without a covering purchase order; EIP-712 domain matches live Monad mainnet and testnet USDC and Monad's facilitator parsed the payload (read-only probe). No speed, fee, user or "live" claims.

### X

> Paylink: one invoice link, two kinds of payer.
>
> A person pays it with a wallet. An AP agent requests the same URL, gets HTTP 402 and pays over x402. Paid only after the chain logs are re-read.
>
> Simulation build for Metropolis (Monad), not live yet.
> github.com/Ps23102004/paylink-monad

Attach `launch.gif` or `paylink-launch-20s.mp4`.

### LinkedIn

> I built Paylink for Metropolis, the Monad hackathon: one invoice link that both a person and an accounts-payable agent can pay.
>
> A browser opening the link gets a pay page. Software requesting the same URL gets HTTP 402 with x402 payment terms and pays over the same USDC authorization (EIP-3009), so the payer signs once and pays no gas.
>
> Two details I cared about:
> • The payment nonce is derived from the invoice id, so a signature for one invoice can't settle another.
> • An invoice is marked paid only after the server re-reads the settlement transaction's logs, not because a facilitator said so.
>
> The AP agent refuses invoices with no purchase order or above it. 26 automated tests cover the tampering cases (wrong amount, wrong recipient, forged signer, replay, two payers at once).
>
> Status, plainly: it runs on a local simulation chain seeded with Monad mainnet's real USDC bytecode, with test money. A read-only probe confirmed our EIP-712 domain matches live mainnet and testnet USDC and that Monad's facilitator parses our payload. It has not been run live on Monad yet, and there are no users and no off-ramp.
>
> Code and an 88-second walkthrough: github.com/Ps23102004/paylink-monad

### Reddit (r/ethdev)

**Title:** One invoice URL that a wallet user and an x402 agent can both pay (hackathon project, simulation only, feedback welcome)

> Built for Metropolis (Monad). The idea: a freelancer sends one link. A browser gets a pay page; software hitting the same URL gets HTTP 402 with x402 v2 requirements. Both paths sign the same EIP-3009 `TransferWithAuthorization`, and a facilitator submits it, so the payer pays no gas.
>
> Things I'd like eyes on:
> - The authorization nonce is `keccak256(invoiceId)`. That binds a signature to one invoice, but it means stock x402 clients (random nonce) get rejected with `nonce_not_bound_to_invoice`. Reasonable trade?
> - "Paid" is derived from the settlement tx logs: exactly one `AuthorizationUsed(nonce)` plus a matching `Transfer`. Since EIP-3009 nonces are per-payer, a second payer is blocked by scanning for the invoice nonce on-chain first, and in-flight payments are serialized. What am I missing?
> - The AP agent only pays when a purchase order covers the invoice, on the expected network and asset.
>
> Honest status: everything runs on a local Hardhat chain seeded with Monad mainnet's real USDC bytecode, test money. 26 tests pass offline. A read-only probe showed our EIP-712 domain separator matches live Monad mainnet and testnet USDC, and Monad's facilitator parsed our payload (it returned `insufficient_funds` for an empty throwaway key). Not run live on Monad yet; invoices are in memory; no auth on invoice creation.
>
> Repo: github.com/Ps23102004/paylink-monad

## README snippets

Hero banner (top of README):

```html
<p align="center">
  <img src="docs/media/hero.png" alt="Paylink: one invoice link. A browser gets a pay page; software gets HTTP 402 at the same URL. Simulation build." width="100%">
</p>
```

Badges (static, honest wording):

```markdown
![status: simulation](https://img.shields.io/badge/status-simulation%20only-c93a24)
![tests: 26 passing locally](https://img.shields.io/badge/tests-26%20passing%20(local)-2f6b4f)
![protocol: x402 v2](https://img.shields.io/badge/protocol-x402%20v2-1b1813)
![built for Metropolis (Monad)](https://img.shields.io/badge/built%20for-Metropolis%20(Monad)-5b5446)
```

Demo loop and videos:

```markdown
<p align="center"><img src="docs/media/launch.gif" alt="One URL: a person pays the real pay page while software gets HTTP 402; marked paid only after the chain logs are re-read" width="720"></p>

[20-second launch video](docs/media/paylink-launch-20s.mp4) · [88-second walkthrough](docs/media/paylink-walkthrough.mp4)
```

GitHub shows repo-relative `.mp4` links as downloads, not inline players. For an inline player, drag the MP4 into the README editor on github.com (it uploads to `user-attachments` and embeds a player), or use the GIF.

Social preview: upload `docs/media/social-card.png` under the repo's Settings → General → Social preview.
