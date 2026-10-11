// Local simulation chain only (chainId 143 so USDC's EIP-712 domain matches mainnet). No fork, no contracts compiled.
module.exports = { networks: { hardhat: { chainId: 143, hardfork: "cancun", initialBaseFeePerGas: 0, gasPrice: 0, allowUnlimitedContractSize: true } } };
