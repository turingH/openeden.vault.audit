import path from "path";
import fs from "fs";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-storage-layout";
import "hardhat-contract-sizer";
require("solidity-coverage");

import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import { } from "colors.ts";
const colors = require("colors");
colors.enable();
dotenv.config();

const secretFile = ".secret";

// this is a fake private key, used for local testing, to cease the compilation errors
let privateKey =
  "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122";
if (fs.existsSync(secretFile)) {
  privateKey = fs.readFileSync(secretFile).toString() || privateKey;
}

const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const ARBSCAN_KEY = process.env.ARBSCAN_KEY;
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

const SKIP_LOAD = process.env.SKIP_LOAD === "true";
if (!SKIP_LOAD) {
  console.log("Loading tasks".green);
  ["full", "misc"].forEach((folder) => {
    const tasksPath = path.join(__dirname, "tasks", folder);
    fs.readdirSync(tasksPath)
      .filter((pth) => pth.includes(".ts"))
      .forEach((task) => {
        require(`${tasksPath}/${task}`);
      });
  });
}

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337,
    },
    arbitrum_sepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      chainId: 421614,
      accounts: [privateKey],
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      chainId: 11155111,
      accounts: [privateKey],
    },
    eth_main: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      chainId: 1,
      accounts: [privateKey],
    },
    arbitrum_one: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      chainId: 42161,
      accounts: [privateKey],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_KEY,
      sepolia: ETHERSCAN_KEY,
      arbitrum_sepolia: ARBSCAN_KEY,
      arbitrumOne: ARBSCAN_KEY,
    },
    customChains: [
      {
        network: "arbitrum_sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api", // https => http
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    // paths: {
    //   sources: "./contracts",
    //   tests: "./test",
    //   cache: "./build/cache",
    //   artifacts: "./build/artifacts",
    // },
  },
};

export default config;
