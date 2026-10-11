# Submission checklist (what only a human can do)

- [ ] **Portal rules**: log in at hackathon.monad.xyz; read deadline time, team cap, testnet-vs-mainnet requirement, Track 2 criteria, and the Cross-Border Payments bounty criteria. Public pages don't say. Treat **Oct 13, 7:59pm EDT** as the cutoff unless the portal says otherwise; submit Oct 12.
- [ ] **Repo visibility**: judges need the code link. Make it public when ready (it contains no secrets; check `git log -p | grep -i key` yourself if unsure).
- [ ] **Placeholders to replace** (grep for `TODO` and `PENDING`): docs/WRITEUP.md (live run, repo URL, video, deck, team), docs/JUDGE-FAQ.md (live run, AI-use line).
- [ ] **Demo video**: record per docs/DEMO-SCRIPT.md; upload; paste link.
- [ ] **Optional live Day-0**: testnet is free. Create a FRESH wallet (never a key that was pasted anywhere), get testnet USDC at faucet.circle.com (1 USDC / 2 h), then
      `PAYLINK_MODE=testnet PAYER_KEY=0x… PAY_TO=0x… npx tsx scripts/day0-live.ts` → writes docs/DAY0-testnet.md with the tx link. Mainnet needs `--i-understand-this-spends-real-usdc` and spends real USDC.
- [ ] **Team**: teammates join Metropolis with code 8VKA-N806-A8; pick exactly one track (Track 2).
- [ ] Don't claim: Privy, live mainnet, measured Monad latency, savings %, sponsor interest — unless they become true.
