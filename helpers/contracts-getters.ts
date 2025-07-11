import {
  KycManager__factory,
  FeeManager__factory,
  Controller__factory,
  TBillPriceOracle__factory,
  TimelockController__factory,
  OpenEdenVaultV2__factory,
  PartnerShip__factory,
  MockBUIDL__factory,
} from "../typechain-types";
import { OpenEdenVaultV3__factory } from "../typechain-types/factories/contracts/OpenEdenVaultV3Impl.sol";

import { DRE, getDb } from "./misc-utils";
export const getFirstSigner = async () => (await DRE.ethers.getSigners())[0];
export const getAccount = async (index: any) =>
  (await DRE.ethers.getSigners())[index];
export const getAccountSigners = async () => await DRE.ethers.getSigners();
import { eContractid, tEthereumAddress } from "./types";

export const getKycManager = async (address?: tEthereumAddress) =>
  KycManager__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.KycManager}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getFeeManager = async (address?: tEthereumAddress) =>
  FeeManager__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.FeeManager}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getController = async (address?: tEthereumAddress) =>
  Controller__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.Controller}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getTbillPriceFeed = async (address?: tEthereumAddress) =>
  TBillPriceOracle__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.TBillPriceFeed}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getTimelock = async (address?: tEthereumAddress) =>
  TimelockController__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.TimeLock}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getPartnerShip = async (address?: tEthereumAddress) =>
  PartnerShip__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.PartnerShip}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getVaultV2Proxy = async (address?: tEthereumAddress) =>
  OpenEdenVaultV2__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.VaultProxy}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getVaultV3Proxy = async (address?: tEthereumAddress) =>
  // will still use the V2 proxy , not VaultV3Proxy
  OpenEdenVaultV3__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.VaultProxy}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );

export const getMockBuidl = async (address?: tEthereumAddress) =>
  MockBUIDL__factory.connect(
    address ||
      (await getDb()
        .get(`${eContractid.MockBUIDL}.${DRE.network.name}`)
        .value()),
    await getFirstSigner()
  );
