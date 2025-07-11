import {
  Contract,
  Signer,
  utils,
  ethers,
  BigNumberish,
  ContractReceipt,
} from "ethers";
import { getDb, DRE, waitForTx, getDbCost } from "./misc-utils";
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  eEthereumNetwork,
  iParamsPerNetwork,
  eNetwork,
  iEthereumParamsPerNetwork,
} from "./types";
import { verifyContract } from "./etherscan-verification";

export const registerContractInJsonDb = async (
  contractId: string,
  contractInstance: Contract,
  tx: ContractReceipt
) => {
  const currentNetwork = DRE.network.name;
  const MAINNET_FORK = process.env.MAINNET_FORK === "true";
  if (
    MAINNET_FORK ||
    (currentNetwork !== "hardhat" && !currentNetwork.includes("coverage"))
  ) {
    console.log(`****** ${contractId} ******\n`);
    console.log(`Network: ${currentNetwork}`);
    console.log(`tx: ${contractInstance.deployTransaction.hash}`);
    console.log(`contract address: ${contractInstance.address}`);
    console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
    console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
    console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
    console.log(`${contractId}  save successfully!`);
    console.log(`\n******`);
  }

  let path = `${contractId}.${currentNetwork}`;

  getDb().set(path, contractInstance.address).write();
  getDbCost().set(path, tx.gasUsed.toString()).write();
};

export const insertContractAddressInDb = async (
  id: eContractid,
  address: tEthereumAddress
) =>
  await getDb()
    .set(`${id}.${DRE.network.name}`, {
      address,
    })
    .write();

export const rawInsertContractAddressInDb = async (
  id: string,
  address: tEthereumAddress
) =>
  await getDb()
    .set(`${id}.${DRE.network.name}`, {
      address,
    })
    .write();

export const getEthersSigners = async (): Promise<Signer[]> =>
  await Promise.all(await DRE.ethers.getSigners());

export const getEthersSignersAddresses = async (): Promise<
  tEthereumAddress[]
> =>
  await Promise.all(
    (await DRE.ethers.getSigners()).map((signer) => signer.getAddress())
  );

export const getCurrentBlock = async () => {
  return DRE.ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(["uint256"], data).toString());

export const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  const contract = (await (
    await DRE.ethers.getContractFactory(contractName)
  ).deploy(...args)) as ContractType;
  let tx = await waitForTx(contract.deployTransaction);

  await registerContractInJsonDb(<eContractid>contractName, contract, tx);
  return contract;
};

export const delay = function (ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
export const save = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  name: string
) => {
  let tx = await waitForTx(instance.deployTransaction);
  await registerContractInJsonDb(id, instance, tx);
};

export const withSaveAndVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: (string | string[])[],
  verify?: boolean
): Promise<ContractType> => {
  let tx = await waitForTx(instance.deployTransaction);
  await registerContractInJsonDb(id, instance, tx);

  if (verify) {
    await verifyContract(instance.address, args);
  }
  return instance;
};

export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> =>
  (await DRE.ethers.getContractAt(contractName, address)) as ContractType;

export const getConfigAddress = (config: any, symbol?: string) => {
  const currentNetwork = DRE.network.name;
  if (symbol) {
    return config[currentNetwork][symbol];
  } else {
    return config[currentNetwork];
  }
};

export const getParamPerNetwork = <T>(
  param: iParamsPerNetwork<T>,
  network: eNetwork
) => {
  const { eth_main, arbitrum_one } = param as iEthereumParamsPerNetwork<T>;
  const MAINNET_FORK = process.env.MAINNET_FORK === "true";
  if (MAINNET_FORK) {
    return eth_main;
  }

  switch (network) {
    case eEthereumNetwork.arbitrum_one:
      return arbitrum_one;
    case eEthereumNetwork.eth_main:
      return eth_main;
  }
};

// export const convertToCurrencyDecimals = async (tokenAddress: tEthereumAddress, amount: string) => {
//     const token = await getIErc20Detailed(tokenAddress);
//     let decimals = (await token.decimals()).toString();

//     return ethers.utils.parseUnits(amount, decimals);
// };

// export const convertToCurrencyUnits = async (tokenAddress: string, amount: string) => {
//     const token = await getIErc20Detailed(tokenAddress);
//     let decimals = new BigNumber(await token.decimals());
//     const currencyUnit = new BigNumber(10).pow(decimals);
//     const amountInCurrencyUnits = new BigNumber(amount).div(currencyUnit);
//     return amountInCurrencyUnits.toFixed();
// };

// export const buildPermitParams = (
//     chainId: number,
//     token: tEthereumAddress,
//     revision: string,
//     tokenName: string,
//     owner: tEthereumAddress,
//     spender: tEthereumAddress,
//     nonce: number,
//     deadline: string,
//     value: tStringTokenSmallUnits
// ) => ({
//     types: {
//         EIP712Domain: [
//             { name: 'name', type: 'string' },
//             { name: 'version', type: 'string' },
//             { name: 'chainId', type: 'uint256' },
//             { name: 'verifyingContract', type: 'address' },
//         ],
//         Permit: [
//             { name: 'owner', type: 'address' },
//             { name: 'spender', type: 'address' },
//             { name: 'value', type: 'uint256' },
//             { name: 'nonce', type: 'uint256' },
//             { name: 'deadline', type: 'uint256' },
//         ],
//     },
//     primaryType: 'Permit' as const,
//     domain: {
//         name: tokenName,
//         version: revision,
//         chainId: chainId,
//         verifyingContract: token,
//     },
//     message: {
//         owner,
//         spender,
//         value,
//         nonce,
//         deadline,
//     },
// });

/*
export const getSignatureFromTypedData = (
    privateKey: string,
    typedData: any // TODO: should be TypedData, from eth-sig-utils, but TS doesn't accept it
): ECDSASignature => {
    const signature = signTypedData_v4(Buffer.from(privateKey.substring(2, 66), 'hex'), {
        data: typedData,
    });
    return fromRpcSig(signature);
};
*/

export const buildLiquiditySwapParams = (
  assetToSwapToList: tEthereumAddress[],
  minAmountsToReceive: BigNumberish[],
  swapAllBalances: BigNumberish[],
  permitAmounts: BigNumberish[],
  deadlines: BigNumberish[],
  v: BigNumberish[],
  r: (string | Buffer)[],
  s: (string | Buffer)[],
  useEthPath: boolean[]
) => {
  return ethers.utils.defaultAbiCoder.encode(
    [
      "address[]",
      "uint256[]",
      "bool[]",
      "uint256[]",
      "uint256[]",
      "uint8[]",
      "bytes32[]",
      "bytes32[]",
      "bool[]",
    ],
    [
      assetToSwapToList,
      minAmountsToReceive,
      swapAllBalances,
      permitAmounts,
      deadlines,
      v,
      r,
      s,
      useEthPath,
    ]
  );
};

export const buildRepayAdapterParams = (
  collateralAsset: tEthereumAddress,
  collateralAmount: BigNumberish,
  rateMode: BigNumberish,
  permitAmount: BigNumberish,
  deadline: BigNumberish,
  v: BigNumberish,
  r: string | Buffer,
  s: string | Buffer,
  useEthPath: boolean
) => {
  return ethers.utils.defaultAbiCoder.encode(
    [
      "address",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint8",
      "bytes32",
      "bytes32",
      "bool",
    ],
    [
      collateralAsset,
      collateralAmount,
      rateMode,
      permitAmount,
      deadline,
      v,
      r,
      s,
      useEthPath,
    ]
  );
};

export const buildFlashLiquidationAdapterParams = (
  collateralAsset: tEthereumAddress,
  debtAsset: tEthereumAddress,
  user: tEthereumAddress,
  debtToCover: BigNumberish,
  useEthPath: boolean
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "address", "uint256", "bool"],
    [collateralAsset, debtAsset, user, debtToCover, useEthPath]
  );
};
