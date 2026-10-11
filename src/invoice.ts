import { getAddress, isAddress, keccak256, toHex, type Address, type Hex } from "viem";
import { randomBytes } from "node:crypto";

export type Invoice = {
  id: string;
  payTo: Address;
  /** USDC atomic units (6 decimals), as a decimal string. */
  amount: string;
  description: string;
  createdAt: number;
  due: number;
  status: "open" | "paid";
  paidTx?: Hex;
  /** chain head when the invoice was created; lower bound for the on-chain double-pay scan */
  createdBlock?: string;
};

/** The EIP-3009 nonce a payer must use for this invoice. Binds the on-chain authorization to the invoice. */
export const invoiceNonce = (id: string): Hex => keccak256(toHex(id));

/** Strict decimal -> atomic. Rejects negatives, exponents, >6 decimals, zero. */
export function parseUsdc(s: string): bigint {
  const m = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(String(s).trim());
  if (!m) throw new Error("amount must be a positive decimal with at most 6 places");
  const v = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
  if (v <= 0n) throw new Error("amount must be greater than zero");
  return v;
}
export function formatUsdc(n: bigint): string {
  const w = n / 1_000_000n, f = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return f ? `${w}.${f.padEnd(2, "0")}` : `${w}.00`;
}

export class InvoiceStore {
  private m = new Map<string, Invoice>();
  create(input: { payTo: string; amount: string; description?: string; dueInDays?: number; createdBlock?: bigint }, now = Math.floor(Date.now() / 1000)): Invoice {
    if (!isAddress(input.payTo)) throw new Error("payTo must be a valid address");
    const description = String(input.description ?? "").slice(0, 200);
    const days = input.dueInDays ?? 14;
    if (!Number.isFinite(days) || days < 0 || days > 365) throw new Error("dueInDays out of range");
    const id = randomBytes(6).toString("hex");
    const inv: Invoice = { id, payTo: getAddress(input.payTo), amount: parseUsdc(input.amount).toString(), description, createdAt: now, due: now + Math.round(days * 86400), status: "open", createdBlock: input.createdBlock?.toString() };
    this.m.set(id, inv);
    return inv;
  }
  get(id: string) { return this.m.get(id); }
  markPaid(id: string, tx: Hex) { const i = this.m.get(id); if (i) { i.status = "paid"; i.paidTx = tx; } }
  all() { return [...this.m.values()]; }
}
