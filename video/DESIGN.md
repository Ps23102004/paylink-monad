# Paylink launch assets: design direction

**One link, two worlds.** The frame is split by a horizontal seam. Above it is paper (a ledger page: the person, the invoice, the rubber stamp). Below it is a terminal (software, HTTP, transcripts). The invoice URL sits *on* the seam, so its top half is ink on paper and its bottom half is paper on ink: the same string, read two ways. That is the product in one image. The seam is literally the `Accept` header (`text/html` gets the pay page, anything else gets 402), and it is the only transition device: it steps, drops and rises between shots instead of fades.

## Why this and not a template
- **Horizontal seam, not a left/right split.** Left/right comparison is the default "A vs B" layout. A seam with type straddling it says *same thing*, not *two things*.
- **Paper vs terminal comes from the domain.** Invoices are paper objects (ledger rules, red margin, perforation, rubber stamp); x402 is HTTP. Nothing decorative is invented: every texture is an invoice or a terminal.
- **The stamp is withheld.** "PAID" only lands after the proof (the receipt's `verifiedFromLogs: true` line is scanned first). The motion carries the claim "paid only after the logs agree".

## Tokens
| Role | Value |
|---|---|
| Paper / ink | `#ece6d6` / `#1b1813` (warm, never pure white/black) |
| Terminal / terminal text | `#151412` / `#ece6d6`, dim `#9b9484` |
| Stamp (the one accent) | `#c93a24` on paper, `#f0644a` on dark |
| Ledger green (structure + passing tests only) | `#2f6b4f`, `#7cc49a` on dark |

**Type is the same family in two registers**, mirroring "same URL, two payers": IBM Plex Serif 300 / 300 italic for the human voice and all captions; IBM Plex Mono for everything a machine says (URLs, HTTP, transcripts). League Gothic appears only inside rubber stamps and the "402" numerals. Plex Serif is vendored from Google Fonts (OFL) in `shared/fonts/`; Plex Mono and League Gothic are bundled by HyperFrames.

## Motion grammar
- Paper things move like paper: masked word-by-word set-in (`power3.out`, 0.55 s, 50 ms stagger), windows slide up out of the seam, stamps slam (scale 1.75 to 1 in 0.11 s, `power4.in`, 2 px settle).
- Machine things move like machines: `steps()` typing, lines print instantly at fixed intervals, block cursor, shutter-style seam moves in 4 discrete steps.
- Ambient: ledger rules drift one rule-height, tractor-feed holes crawl. No floating particles, no glows.
- Sound (code-synthesized, `shared/sfx.py`, seeded): key ticks for typing, a blip per printed line, a mechanical clack per shutter, a thump per stamp, paper slides, one bell at the CTA. No music.

## Banned defaults (and what replaced them)
Centered-everything (all layouts anchor to the ledger margin at x=200) · fades between scenes (seam moves and hard cuts on a clack) · purple/blue gradients and neon glow · glassmorphism cards · Inter / Poppins / Syne · emoji · "y:30, opacity 0" as the only entrance · invented terminal output.

## Honesty rules as applied
- A persistent `SIMULATION · local chain · test money` bug sits bottom-right in every frame; the walkthrough opens with the full disclosure and closes on "What's not done yet".
- Every UI frame is a real screenshot of the running sim server (`capture/run.sh` + `capture/capture.mjs`, invoice `b5afe815e575`). The only intervention: the payment request was held 1.2 s so the real "signing authorization…" state could be photographed. The page's own "PAID in N ms" line is never shown.
- Every terminal line is verbatim from `capture/out/*` (curl, receipt, after-paid 200), `docs/SIM-RUN.md`, `docs/READONLY-PROBE.md`, or a real `npm test` run. Presentation edits are limited to cropping long lines at the frame edge, dropping test timings, and `…` where lines are skipped; excerpts say where they come from (`# excerpt: docs/SIM-RUN.md`).
- No latency figures, fee claims, users, sponsors, Privy, off-ramp, or "live on Monad" anywhere.

## Build
`./render.sh` rebuilds everything in `docs/media/` (sync, `hyperframes check`, render, stills, GIF). `./sync.sh` copies `shared/` into each HyperFrames project (HyperFrames refuses `../` asset paths) and synthesizes the SFX. `./contact.sh <mp4> <out.png> label@sec ...` makes the critique contact sheet. Re-capturing (`capture/run.sh`) creates a new invoice id; the compositions hard-code `b5afe815e575` and its nonce/tx, so update them if you re-capture.

Known checker noise: `hyperframes check` reports contrast warnings on `#u-dark` / `#g-dark` / `#u1d`. Those are the dark-world copies of the straddling URL; the checker ignores `clip-path`, so it measures them against paper they never sit on.

## Critique loop (contact sheets in `critique/`)
Scores are story / composition / motion / typography, judged by the same model that built it.

| Launch 20 s | R1 | Final (R3) |
|---|---|---|
| Hook 0–3 s | 8/8/7/8 | 8/8/8/8 |
| One link 3–4.9 s | 7/6/7/8 | 8/8/8/8 |
| Split: page vs 402 | 9/7/8/8 | 9/8/8/8 |
| AP agent | 8/7/7/7 | 8/8/8/8 |
| Nonce = invoice | 8/7/7/8 | 8/8/8/8 |
| Paid after logs | 9/8/8/8 | 9/8/8/8 |
| Tamper tests | 8/7/7/7 | 8/8/8/8 |
| CTA | 8/8/7/8 | 8/8/8/8 |

| Walkthrough 88 s | R1 | Final (R4) |
|---|---|---|
| Title + disclosure | 8/8/8/8 | 8/8/8/8 |
| One URL, two answers | 8/8/8/8 | 8/8/8/8 |
| Inside the 402 | 8/7/7/8 | 8/8/8/8 |
| A person pays (4 real states) | 8/8/7/8 | 8/8/8/8 |
| Proof: receipt + 200 | 8/8/8/7 | 8/8/8/8 |
| AP agent | 8/8/7/8 | 8/8/8/8 |
| Tests | 8/7/7/7 | 8/8/8/8 |
| Read-only probe | 8/7/7/7 | 8/8/8/8 (still the densest frame) |
| Not done yet + CTA | 8/8/8/8 | 8/8/8/8 |
