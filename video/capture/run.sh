#!/bin/sh
# Re-captures every real artifact the videos show, from the running SIMULATION server (npm run serve).
# Writes transcripts to video/capture/out/ and UI screenshots to video/capture/shots/, crops to video/shared/ui/.
set -eu
cd "$(dirname "$0")"
B=http://localhost:8787
mkdir -p out shots
curl -s -X POST $B/api/invoices -d '{"payTo":"0x1111111111111111111111111111111111111111","amount":"4.00","description":"Logo design"}' > out/01-create.json
ID=$(python3 -c "import json;print(json.load(open('out/01-create.json'))['id'])")
echo "$ID" > out/id.txt
curl -si $B/i/$ID > out/02-curl-402.txt
curl -s $B/i/$ID | python3 -m json.tool > out/03-402-body.json
node capture.mjs "$ID" > out/04-browser.txt
curl -s $B/i/$ID/receipt | python3 -m json.tool > out/05-receipt.json
curl -si $B/i/$ID > out/06-curl-after-paid.txt
for f in 1-unpaid 2-funded 3-signing 4-paid; do magick shots/$f.png -crop 1120x880+0+0 +repage ../shared/ui/$f.png; done
echo "captured invoice $ID"
