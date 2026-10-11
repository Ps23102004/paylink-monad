# Demo video — 2:00 (record this; keep the SIMULATION banner visible)

Setup: `npm run serve` (simulation) in one terminal, browser on http://localhost:8787, second terminal ready. Pre-create two invoices (one for the human, three for the agent) with `curl -X POST localhost:8787/api/invoices -d '{"payTo":"0x…","amount":"4.00","description":"Logo design"}'`.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:15 | Home page, simulation banner | "Paylink: one invoice link that a person and an AP agent can both pay. This is a simulation on a local chain running Monad mainnet's real USDC code; I'll show what's verified live at the end." |
| 0:15–0:45 | Open invoice URL in the browser → Fund burner (sim) → Pay | "A person signs one authorization. No gas, no transaction from them. Settled, and the page says verified from chain logs." |
| 0:45–1:15 | Terminal: `curl -i <url>` shows 402 + requirements; then `PO='{"<id>":"5.00"}' SIM_FUND=1 npx tsx scripts/ap-agent.ts <url1> <url2> <url3>` | "Same URL, software gets HTTP 402. The agent pays only the invoice with a purchase order that covers it, and refuses the other two." |
| 1:15–1:35 | `npm test` bottom lines (26 passed), highlight tamper cases | "Wrong amount, wrong recipient, forged signer, replay, two payers at once: none of them get paid. A plain transfer isn't a payment either." |
| 1:35–1:50 | `npm run probe` output | "Read-only against the real network: our EIP-712 domain separator matches mainnet and testnet USDC, and Monad's facilitator parses our payload." |
| 1:50–2:00 | README status table | "Not yet run live on Monad, no users, no off-ramp. That's next." |

Do not say: "live on mainnet", any latency number from the demo (local chain is instant), any fee-savings percentage, or "Privy".
