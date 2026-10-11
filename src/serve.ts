import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FACILITATOR_URL, NETS, monad, monadTestnet } from "./chain";
import { HttpFacilitator, LocalFacilitator } from "./facilitator";
import { InvoiceStore } from "./invoice";
import { createApp, type Mode } from "./server";
import { fundUsdc } from "./sim";
import { SIM_RELAYER_KEY, simClients, startSimNode } from "./simnode";

const mode = (process.env.PAYLINK_MODE ?? "sim") as Mode;
const port = Number(process.env.PORT ?? 8787);
const store = new InvoiceStore();

if (mode === "sim") {
  const node = await startSimNode(Number(process.env.SIM_PORT ?? 8545));
  const { client, relayer } = simClients(node.url);
  const net = NETS[143];
  createApp({ store, net, client, mode, facilitator: new LocalFacilitator(client, relayer, net), simFund: (a) => fundUsdc(node.url, a, 25_000_000n) })
    .listen(port, () => console.log(`Paylink (SIMULATION) http://localhost:${port}  relayer=${privateKeyToAccount(SIM_RELAYER_KEY).address}`));
} else {
  const chain = mode === "mainnet" ? monad : monadTestnet;
  const net = NETS[chain.id];
  const client = createPublicClient({ chain, transport: http(process.env.RPC_URL) });
  createApp({ store, net, client, mode, facilitator: new HttpFacilitator(process.env.FACILITATOR_URL ?? FACILITATOR_URL) })
    .listen(port, () => console.log(`Paylink (${mode.toUpperCase()}) http://localhost:${port} facilitator=${process.env.FACILITATOR_URL ?? FACILITATOR_URL}`));
}
