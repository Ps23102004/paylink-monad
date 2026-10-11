import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { USDC_DOMAIN, type Net } from "./chain";
import { invoiceNonce, type Invoice } from "./invoice";

export const AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ],
} as const;

export type Requirements = {
  scheme: "exact"; network: string; amount: string; asset: Address; payTo: Address; maxTimeoutSeconds: number;
  /** `nonce` is a Paylink extension: payers MUST use it as the EIP-3009 nonce (binds payment to invoice). */
  extra: { name: string; version: string; nonce: Hex; invoiceId: string };
};
export type Authorization = { from: Address; to: Address; value: string; validAfter: string; validBefore: string; nonce: Hex };
export type PaymentPayload = { x402Version: 2; accepted: Requirements; payload: { authorization: Authorization; signature: Hex }; resource?: { url: string; description?: string; mimeType?: string } };

export function requirementsFor(inv: Invoice, net: Net): Requirements {
  return { scheme: "exact", network: net.caip, amount: inv.amount, asset: net.usdc, payTo: inv.payTo, maxTimeoutSeconds: 300,
    extra: { ...USDC_DOMAIN, nonce: invoiceNonce(inv.id), invoiceId: inv.id } };
}
export function paymentRequired(inv: Invoice, net: Net, url: string) {
  return { x402Version: 2, error: "payment required", resource: { url, description: inv.description || `Invoice ${inv.id}`, mimeType: "application/json" }, accepts: [requirementsFor(inv, net)] };
}
export function typedData(a: Authorization, net: Net) {
  return {
    domain: { ...USDC_DOMAIN, chainId: BigInt(net.chainId), verifyingContract: net.usdc },
    types: AUTH_TYPES, primaryType: "TransferWithAuthorization" as const,
    message: { from: a.from, to: a.to, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce },
  };
}
export type Signer = { address: Address; signTypedData: (args: any) => Promise<Hex> };

export async function signPayment(signer: Signer, req: Requirements, net: Net, resourceUrl: string, now = Math.floor(Date.now() / 1000)): Promise<PaymentPayload> {
  const authorization: Authorization = { from: signer.address, to: req.payTo, value: req.amount, validAfter: String(now - 60), validBefore: String(now + req.maxTimeoutSeconds), nonce: req.extra.nonce };
  const signature = await signer.signTypedData(typedData(authorization, net));
  return { x402Version: 2, accepted: req, payload: { authorization, signature }, resource: { url: resourceUrl, mimeType: "application/json" } };
}
export async function recoverPayer(p: PaymentPayload, net: Net): Promise<Address> {
  return recoverTypedDataAddress({ ...typedData(p.payload.authorization, net), signature: p.payload.signature });
}
export const encodeHeader = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
export const decodeHeader = <T = any>(s: string): T => JSON.parse(Buffer.from(s, "base64").toString("utf8"));
