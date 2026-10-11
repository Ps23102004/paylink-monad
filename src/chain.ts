import { defineChain, parseAbi, type Address } from "viem";

export const USDC_DECIMALS = 6;
/** EIP-712 domain for Monad USDC (docs.monad.xyz/guides/x402): name "USDC", version "2". */
export const USDC_DOMAIN = { name: "USDC", version: "2" } as const;

export const monad = defineChain({
  id: 143, name: "Monad", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
});
export const monadTestnet = defineChain({
  id: 10143, name: "Monad Testnet", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } }, testnet: true,
});

export type Net = { chainId: number; caip: string; usdc: Address; explorer: string };
export const NETS: Record<number, Net> = {
  143: { chainId: 143, caip: "eip155:143", usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", explorer: "https://monadscan.com" },
  10143: { chainId: 10143, caip: "eip155:10143", usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3", explorer: "https://testnet.monadscan.com" },
};

export const FACILITATOR_URL = "https://x402-facilitator.molandak.org";

export const usdcAbi = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);
