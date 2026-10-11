import { decodeEventLog, type Address, type Hex, type PublicClient } from "viem";
import { usdcAbi, type Net } from "./chain";
import { invoiceNonce, type Invoice } from "./invoice";

export type ReceiptCheck = { ok: true; payer: Address; block: string; tx: Hex } | { ok: false; reason: string };

/**
 * Trustless paid-check: the invoice is paid iff ONE successful tx emitted, on the USDC contract,
 * AuthorizationUsed(nonce = keccak(invoiceId)) AND Transfer(to = payTo, value = amount) from the same authorizer.
 * We never trust the facilitator's or our own say-so.
 */
export async function verifyReceipt(client: PublicClient, net: Net, inv: Invoice, tx: Hex): Promise<ReceiptCheck> {
  const rc = await client.getTransactionReceipt({ hash: tx }).catch(() => null);
  if (!rc) return { ok: false, reason: "tx_not_found" };
  if (rc.status !== "success") return { ok: false, reason: "tx_reverted" };
  const nonce = invoiceNonce(inv.id);
  let authorizer: Address | undefined;
  let transferOk = false;
  const used: { authorizer: Address }[] = [];
  const transfers: { from: Address; to: Address; value: bigint }[] = [];
  for (const log of rc.logs) {
    if (log.address.toLowerCase() !== net.usdc.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: usdcAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "AuthorizationUsed" && (ev.args as any).nonce === nonce) used.push({ authorizer: (ev.args as any).authorizer });
      if (ev.eventName === "Transfer") transfers.push(ev.args as any);
    } catch { /* not a USDC event we know */ }
  }
  if (used.length !== 1) return { ok: false, reason: "no_authorization_for_this_invoice" };
  authorizer = used[0].authorizer;
  transferOk = transfers.some((t) => t.from.toLowerCase() === authorizer!.toLowerCase() && t.to.toLowerCase() === inv.payTo.toLowerCase() && t.value === BigInt(inv.amount));
  if (!transferOk) return { ok: false, reason: "transfer_does_not_match_invoice" };
  return { ok: true, payer: authorizer, block: rc.blockNumber.toString(), tx };
}

/** Has ANY payer already consumed this invoice's nonce? (EIP-3009 nonces are per-authorizer, so two payers could both pay.) */
export async function findPaymentByNonce(client: PublicClient, net: Net, inv: Invoice): Promise<Hex | null> {
  const logs = await client.getLogs({
    address: net.usdc, event: usdcAbi.find((x) => x.type === "event" && x.name === "AuthorizationUsed") as any,
    args: { nonce: invoiceNonce(inv.id) }, fromBlock: inv.createdBlock ? BigInt(inv.createdBlock) : "earliest", toBlock: "latest",
  });
  return logs[0]?.transactionHash ?? null;
}
