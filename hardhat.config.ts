import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig, HttpNetworkUserConfig } from "hardhat/types";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@matterlabs/hardhat-zksync-ethers";
import "@matterlabs/hardhat-zksync-node";
import "hardhat-deploy";
import dotenv from "dotenv";
import yargs from "yargs";
import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";

const argv = yargs
    .option("network", {
        type: "string",
        default: "hardhat",
    })
    .help(false)
    .version(false)
    .parseSync();

// Load environment variables.
dotenv.config();
const {
    NODE_URL,
    INFURA_KEY,
    MNEMONIC,
    ETHERSCAN_API_KEY,
    PK,
    SOLIDITY_VERSION,
    SOLIDITY_SETTINGS,
    HARDHAT_ENABLE_ZKSYNC = "0",
    HARDHAT_CHAIN_ID = 31337,
} = process.env;

const DEFAULT_MNEMONIC = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
    sharedNetworkConfig.accounts = [PK];
} else {
    sharedNetworkConfig.accounts = {
        mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
    };
}

if (["mainnet", "rinkeby", "kovan", "goerli", "ropsten", "mumbai", "polygon"].includes(argv.network) && INFURA_KEY === undefined) {
    throw new Error(`Could not find Infura key in env, unable to connect to network ${argv.network}`);
}

import "./src/tasks/local_verify";
import "./src/tasks/deploy_contracts";
import "./src/tasks/show_codesize";
import { BigNumber } from "@ethersproject/bignumber";
import { DeterministicDeploymentInfo } from "hardhat-deploy/dist/types";

const defaultSolidityVersion = "0.7.6";
const primarySolidityVersion = SOLIDITY_VERSION || defaultSolidityVersion;
const soliditySettings = SOLIDITY_SETTINGS ? JSON.parse(SOLIDITY_SETTINGS) : undefined;

const deterministicDeployment = (network: string): DeterministicDeploymentInfo => {
    const info = getSingletonFactoryInfo(parseInt(network));
    if (!info) {
        throw new Error(`
        Safe factory not found for network ${network}. You can request a new deployment at https://github.com/safe-global/safe-singleton-factory.
        For more information, see https://github.com/safe-global/safe-smart-account#replay-protection-eip-155
      `);
    }
    return {
        factory: info.address,
        deployer: info.signerAddress,
        funding: BigNumber.from(info.gasLimit).mul(BigNumber.from(info.gasPrice)).toString(),
        signedTx: info.transaction,
    };
};

const userConfig: HardhatUserConfig = {
    paths: {
        artifacts: "build/artifacts",
        cache: "build/cache",
        deploy: "src/deploy_test",
        sources: "contracts",
    },
    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
    },
    solidity: {
        compilers: [{ version: primarySolidityVersion, settings: soliditySettings }, { version: defaultSolidityVersion }],
    },
    zksolc: {
        version: "1.5.3",
        settings: {},
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
            blockGasLimit: 100000000,
            gas: 100000000,
            zksync: HARDHAT_ENABLE_ZKSYNC === "1",
            chainId: typeof HARDHAT_CHAIN_ID === "string" && !Number.isNaN(parseInt(HARDHAT_CHAIN_ID)) ? parseInt(HARDHAT_CHAIN_ID) : 31337,
        },
        mainnet: {
            ...sharedNetworkConfig,
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
        },
        gnosis: {
            ...sharedNetworkConfig,
            url: "https://rpc.gnosischain.com",
        },
        goerli: {
            ...sharedNetworkConfig,
            url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
        },
        mumbai: {
            ...sharedNetworkConfig,
            url: `https://polygon-mumbai.infura.io/v3/${INFURA_KEY}`,
        },
        polygon: {
            ...sharedNetworkConfig,
            url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
        },
        bsc: {
            ...sharedNetworkConfig,
            url: `https://bsc-dataseed.binance.org/`,
        },
        arbitrum: {
            ...sharedNetworkConfig,
            url: `https://arb1.arbitrum.io/rpc`,
        },
        fantomTestnet: {
            ...sharedNetworkConfig,
            url: `https://rpc.testnet.fantom.network/`,
        },
        avalanche: {
            ...sharedNetworkConfig,
            url: `https://api.avax.network/ext/bc/C/rpc`,
        },
        zkSyncMainnet: {
            ...sharedNetworkConfig,
            url: "https://mainnet.era.zksync.io",
            ethNetwork: "mainnet",
            zksync: true,
            verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
        },
        zkSyncSepolia: {
            ...sharedNetworkConfig,
            url: "https://sepolia.era.zksync.dev",
            ethNetwork: "goerli",
            zksync: true,
            verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
        },
        titansepolia: {
            url: `${process.env.NODE_URL}`,
            accounts: [`${process.env.PK}`],
            chainId: 55007,
            gasPrice: 1,
            // deploy: ["/deploy_test"],
        },
    },
    // deterministicDeployment,
    deterministicDeployment: (network: string) => {
        // Skip on hardhat's local network.
        if (network === "31337") {
            return undefined;
        } else if (network === "55007") {
            return {
                factory: "0x97A23639dbce0507Ee466741AAb1A6BD4EB7a38c",
                deployer: "0x9Aa4d862d041717660cF320CC61E8701e7bfc107",
                funding: "1000000000000000",
                signedTx: "0x00",
            };
        } else {
            return {
                factory: "0x4e59b44847b379578588920ca78fbf26c0b4956c",
                deployer: "0x3fab184622dc19b6109349b94811493bf2a45362",
                funding: "10000000000000000",
                signedTx: "0x00",
            };
        }
    },
    namedAccounts: {
        deployer: 0,
    },
    mocha: {
        timeout: 2000000,
    },
    etherscan: {
        apiKey: {
            goerli: `${process.env.ETHERSCAN_API_KEY}`,
            sepolia: `${process.env.ETHERSCAN_API_KEY}`,
            titansepolia: "verify",
        },
        customChains: [
            {
                network: "titansepolia",
                chainId: 55007,
                urls: {
                    apiURL: "https://explorer.titan-sepolia.tokamak.network/api",
                    browserURL: "https://explorer.titan-sepolia.tokamak.network",
                },
            },
        ],
    },
};
if (NODE_URL) {
    userConfig.networks!.custom = {
        ...sharedNetworkConfig,
        url: NODE_URL,
    };
}
export default userConfig;
