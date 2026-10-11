import { createWalletClient, http, parseSignature, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { usdcAbi, type Net } from "./chain";
import { recoverPayer, type PaymentPayload } from "./x402";

export type VerifyResult = { isValid: boolean; invalidReason?: string; payer?: Address };
export type SettleResult = { success: boolean; transaction?: Hex; errorReason?: string; payer?: Address };
export interface Facilitator {
  verify(p: PaymentPayload): Promise<VerifyResult>;
  settle(p: PaymentPayload): Promise<SettleResult>;
}

/** Talks to a real x402 facilitator (default: Monad's, https://x402-facilitator.molandak.org). */
export class HttpFacilitator implements Facilitator {
  constructor(private url: string) {}
  private async post(path: string, p: PaymentPayload) {
    const r = await fetch(`${this.url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x402Version: 2, payload: p.payload, accepted: p.accepted, resource: p.resource }) });
    return r.json() as Promise<any>;
  }
  verify(p: PaymentPayload) { return this.post("/verify", p) as Promise<VerifyResult>; }
  settle(p: PaymentPayload) { return this.post("/settle", p) as Promise<SettleResult>; }
}

/**
 * Local stand-in for a facilitator: does what Monad's facilitator does (verify the EIP-3009 authorization,
 * submit transferWithAuthorization, pay gas) against whatever chain `client` points at. Used for the fork simulation.
 */
export class LocalFacilitator implements Facilitator {
  constructor(private client: PublicClient, private relayer: WalletClient, private net: Net) {}
  async verify(p: PaymentPayload): Promise<VerifyResult> {
    const a = p.payload.authorization;
    let payer: Address;
    try { payer = await recoverPayer(p, this.net); } catch { return { isValid: false, invalidReason: "invalid_signature" }; }
    if (payer.toLowerCase() !== a.from.toLowerCase()) return { isValid: false, invalidReason: "invalid_signature", payer };
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (BigInt(a.validBefore) <= now + 6n) return { isValid: false, invalidReason: "authorization_expired", payer };
    if (BigInt(a.validAfter) > now) return { isValid: false, invalidReason: "authorization_not_yet_valid", payer };
    const bal = await this.client.readContract({ address: this.net.usdc, abi: usdcAbi, functionName: "balanceOf", args: [a.from] });
    if (bal < BigInt(a.value)) return { isValid: false, invalidReason: "insufficient_funds", payer };
    const used = await this.client.readContract({ address: this.net.usdc, abi: usdcAbi, functionName: "authorizationState", args: [a.from, a.nonce] });
    if (used) return { isValid: false, invalidReason: "authorization_already_used", payer };
    return { isValid: true, payer };
  }
  async settle(p: PaymentPayload): Promise<SettleResult> {
    const v = await this.verify(p);
    if (!v.isValid) return { success: false, errorReason: v.invalidReason, payer: v.payer };
    const a = p.payload.authorization;
    const sig = parseSignature(p.payload.signature);
    try {
      const hash = await this.relayer.writeContract({
        address: this.net.usdc, abi: usdcAbi, functionName: "transferWithAuthorization", chain: this.relayer.chain, account: this.relayer.account!,
        args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, Number(sig.v ?? 27n + BigInt(sig.yParity!)), sig.r, sig.s],
      });
      const rc = await this.client.waitForTransactionReceipt({ hash });
      return rc.status === "success" ? { success: true, transaction: hash, payer: v.payer } : { success: false, errorReason: "transaction_reverted", transaction: hash, payer: v.payer };
    } catch (e: any) {
      return { success: false, errorReason: `settle_error: ${String(e?.shortMessage ?? e?.message ?? e).slice(0, 160)}`, payer: v.payer };
    }
  }
}
export { createWalletClient, http };
