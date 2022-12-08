import * as dotenv from 'dotenv';
import {HardhatUserConfig} from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import * as process from "process";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.17',
                settings: {
                    outputSelection: {
                        '*': {
                            '*': ['storageLayout']
                        }
                    },
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ]
    },
    networks: {
        mainnet: {
            url: process.env.MAINNET_URL,
            accounts: [process.env.PRODUCTION_ACCOUNT ?? '']
        },
        goerli: {
            url: process.env.GOERLI_URL,
            accounts: [process.env.ALICE_ACCOUNT ?? '', process.env.BOB_ACCOUNT ?? '']
        }
    },
    namedAccounts: {
        deployer: 0,
        alice: 0,
        bob: 1,
        carol: 2
    },
    verify: {
        etherscan: {
            apiKey: process.env.ETHERSCAN_API_KEY
        }
    },
    gasReporter: {
        currency: 'CHF',
        gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
        enabled: true
    }
};

export default config;
