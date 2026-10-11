# Simulated run (local chain, Monad mainnet USDC bytecode, test money)

freelancer 0x912bD86062Df549BB1760Fc79E6d59804A901B6D
human payer 0xB2e5cf3057BEC7aCFE5849B154Ad248ed1aDa6A1
AP agent    0xA1838c44C6368f187054b7A06B5083CE66Ef7f93

## 1. Human pays invoice 7118e5e79bac ($4.00)
status=paid verifiedFromLogs=true tx=0x84151a4302a255ddaed5b4a8beb995036dfee16bcfa464cbc83ce0ddc426cf34  (58 ms on a local instant-mining chain — NOT a Monad latency figure)

## 2. AP agent works through three more invoice URLs (PO covers b ≤ $5 and d ≤ $10)
PAID      9d6b8a6c2302  0xda01f9b59d92f7d87fbbd1a29bcdd58b1b6670f4e79c94e687a6a28eb9e72455
REJECTED  eb9896da2fd8 no_purchase_order 
REJECTED  379df162fb88 exceeds_purchase_order 

## 3. Balances
freelancer 8.00 USDC (expected 8.00)
human      21.00 (expected 21.00)
agent      96.00 (expected 96.00)

## 4. Receipts re-derived from chain logs
{"id":"7118e5e79bac","status":"paid","verifiedFromLogs":true,"payer":"0xB2e5cf3057BEC7aCFE5849B154Ad248ed1aDa6A1","block":"1","tx":"0x84151a4302a255ddaed5b4a8beb995036dfee16bcfa464cbc83ce0ddc426cf34"}
{"id":"9d6b8a6c2302","status":"paid","verifiedFromLogs":true,"payer":"0xA1838c44C6368f187054b7A06B5083CE66Ef7f93","block":"2","tx":"0xda01f9b59d92f7d87fbbd1a29bcdd58b1b6670f4e79c94e687a6a28eb9e72455"}
