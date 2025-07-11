import { expect } from "chai";
import { describe } from "mocha";
import { BigNumber, Bytes } from "ethers";
import { deployContract, execute } from "../helpers/framework/contracts";
import { successfulTransaction } from "../helpers/framework/transaction";
import { network, ethers, upgrades } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import VaultV2 from "../artifacts/contracts/OpenEdenVaultV2.sol/OpenEdenVaultV2.json";

import {
  USDC,
  TimelockController,
  OpenEdenVaultV2,
  FeeManager,
  KycManager,
  TBillPriceOracle,
  MockV3Aggregator,
  Controller,
} from "../typechain-types";

describe("OpenEden Upgrade Test", async function () {
  const vaultDecimals = 6;
  const chainlinkDecimal = 8;
  const tbillOracleDecimal = 8;
  const tbillOracleInitPrice = BigNumber.from("100000000"); // 1 : 1 (tbill/usd)
  const chainlinkInitAnswer = BigNumber.from("98999999"); // 0.99 : 1  (usd/usdc)
  const tbillInitDeviation = BigNumber.from("100");

  const _500 = BigNumber.from("500000000"); // 500
  const _10k = BigNumber.from("10000000000"); // 10k
  const _9k = BigNumber.from("9000000000");

  const _50k = BigNumber.from("50000000000"); // 50k
  const _1M = BigNumber.from("1000000000000"); // 1M
  const _10M = BigNumber.from("10000000000000"); // 1M
  const _80k = BigNumber.from("80000000000");
  const _100k = BigNumber.from("100000000000"); // 100k
  const _150k = BigNumber.from("150000000000"); // 150k
  const _200k = BigNumber.from("200000000000"); // 200k
  const _250k = BigNumber.from("250000000000"); //
  const _300k = BigNumber.from("300000000000"); // 300k

  const _5$ = BigNumber.from("5000000");
  const _1$ = BigNumber.from("1000000");
  const _50$ = BigNumber.from("50000000"); // 50$
  const _75$ = BigNumber.from("75000000"); // 75$
  const _25$ = BigNumber.from("25000000"); // 25$
  const _500$ = BigNumber.from("500000000");
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const fundAmount = "10000000000000000000";

  const txFeeWorkdayDepositPct = 5; // 5bps
  const txFeeWorkdayWithdrawPct = 10; // 10bps
  const txFeeHolidayDepositPct = 12; // 12bps
  const txFeeHolidayWithdrawPct = 15; // 15bps
  const maxHolidayDepositPct = 500; // 5% tvl
  const maxHolidayAggDepositPct = 1000; // 10% tvl
  const managementFeeRate = 40; // 40bps
  const BPSUNIT = 10000;
  const delayTime = 60 * 60 * 24; // 24h

  let usdcTokenIns: USDC;
  let feeManager: FeeManager;
  let kycManagerIns: KycManager;
  let vaultV2: OpenEdenVaultV2;
  let vaultV3: OpenEdenVaultV2;
  let aggregator: MockV3Aggregator;
  let tbillOracle: TBillPriceOracle;
  let timelock: TimelockController;
  let controller: Controller;
  let iface;
  let operatorRole;
  let adminRole;

  let owner,
    investor1,
    investor2,
    investor3,
    investor4,
    non_kyc,
    operator,
    treasuryAccount,
    newTreasuryAccount,
    oplTreasury,
    timelockAdmin,
    timelockProposer,
    timelockExecutor,
    vaultParameters;

  async function deployOpenEdenFixture() {
    [
      owner,
      investor1,
      investor2,
      investor3,
      investor4,
      non_kyc,
      operator,
      treasuryAccount,
      newTreasuryAccount,
      oplTreasury,
      timelockAdmin,
      timelockProposer,
      timelockExecutor,
    ] = await ethers.getSigners();
    vaultParameters = {
      txFeeWorkdayDepositPct: txFeeWorkdayDepositPct, // 5 bps
      txFeeWorkdayWithdrawPct: txFeeWorkdayWithdrawPct, // 10 bps
      txFeeHolidayDepositPct: txFeeHolidayDepositPct,
      txFeeHolidayWithdrawPct: txFeeHolidayWithdrawPct,
      maxHolidayDepositPct: maxHolidayDepositPct,
      maxHolidayAggDepositPct: maxHolidayAggDepositPct,
      firstDeposit: _100k,
      minDeposit: _10k, // 100000 USDC
      maxDeposit: _1M, // max deposit on a day
      minWithdraw: _500, // min withdraw once
      maxWithdraw: _1M, // max withdraw on a day
      // managementFeeRate: managementFeeRate,
    };

    usdcTokenIns = await deployContract<USDC>("USDC");
    timelock = await deployContract<TimelockController>(
      "TimelockController",
      delayTime,
      [timelockProposer.address],
      [timelockExecutor.address],
      timelockAdmin.address
    );
    controller = await deployContract<Controller>(
      "Controller",
      operator.address,
      owner.address
    );

    iface = new ethers.utils.Interface(VaultV2.abi);

    kycManagerIns = await deployContract<KycManager>("KycManager");
    console.log(vaultParameters.firstDeposit);
    feeManager = await deployContract<FeeManager>(
      "FeeManager",
      vaultParameters.txFeeWorkdayDepositPct,
      vaultParameters.txFeeWorkdayWithdrawPct,
      vaultParameters.txFeeHolidayDepositPct,
      vaultParameters.txFeeHolidayWithdrawPct,
      vaultParameters.maxHolidayDepositPct,
      vaultParameters.maxHolidayAggDepositPct,
      vaultParameters.firstDeposit,
      vaultParameters.minDeposit,
      vaultParameters.maxDeposit,
      vaultParameters.minWithdraw,
      vaultParameters.maxWithdraw
      // vaultParameters.managementFeeRate
    );
    // vaultV2 = await deployContract<OpenEdenVaultV2>("OpenEdenVaultV2");
    aggregator = await deployContract<MockV3Aggregator>(
      "MockV3Aggregator",
      chainlinkDecimal,
      chainlinkInitAnswer
    );

    // tbill
    tbillOracle = await deployContract<TBillPriceOracle>(
      "TBillPriceOracle",
      tbillOracleDecimal,
      tbillInitDeviation,
      tbillOracleInitPrice, // price
      tbillOracleInitPrice, // closing nav price
      operator.address,
      owner.address
    );

    //const proxy = await upgrades.deployProxy(OpenEdenVaultV3, params,{ kind: 'uups'});

    await usdcTokenIns.transfer(investor1.address, _10M);
    await usdcTokenIns.transfer(investor2.address, _10M);
    await usdcTokenIns.transfer(investor3.address, _10M);
    await usdcTokenIns.transfer(investor4.address, _10M);
    await usdcTokenIns.transfer(non_kyc.address, _10M);
    //operatorRole = await timelock.PROPOSER_ROLE();
    //adminRole = await timelock.DEFAULT_ADMIN_ROLE();
    console.log("deployOpenEdenFixture over!");

    await kycManagerIns.setStrict(true);
  }

  beforeEach(async () => {
    await loadFixture(deployOpenEdenFixture);
  });

  it("pre-mint with kyc addresses", async function () {
    // 0: NON KYC, 1: US KYC, 2: GENERAL KYC
    await kycManagerIns.grantKycInBulk(
      [investor1.address, investor2.address],
      [2, 2]
    );

    const params = [
      usdcTokenIns.address,
      controller.address,
      operator.address,
      tbillOracle.address,
      aggregator.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      feeManager.address,
      kycManagerIns.address,
      [investor1.address, investor1.address],
      [_100k, _100k],
    ];

    const OpenEdenVaultV2 = await ethers.getContractFactory(
      "MockOpenEdenVaultV2"
    );

    vaultV2 = (await upgrades.deployProxy(OpenEdenVaultV2, params, {
      kind: "uups",
    })) as OpenEdenVaultV2;

    await expect(vaultV2.connect(operator).claimServiceFee(0)).to.revertedWith(
      "invalid opl address"
    );
    await expect(vaultV2.connect(operator).offRamp(0)).to.revertedWith(
      "invalid _to address!"
    );

    const OpenEdenVaultV3 = await ethers.getContractFactory(
      "MockOpenEdenVaultV3"
    );
    vaultV3 = await OpenEdenVaultV3.deploy();
    await vaultV3.deployed();
    // upgrade success
    await expect(
      vaultV2.connect(investor1).upgradeTo(vaultV3.address)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("pre-mint with non-kyc addresses", async function () {
    const params = [
      usdcTokenIns.address,
      controller.address,
      operator.address,
      tbillOracle.address,
      aggregator.address,
      oplTreasury.address,
      treasuryAccount.address,
      // treasuryAccount.address,
      feeManager.address,
      kycManagerIns.address,
      [investor1.address],
      [_100k],
    ];

    const OpenEdenVaultV2 = await ethers.getContractFactory(
      "MockOpenEdenVaultV2"
    );
    await expect(
      upgrades.deployProxy(OpenEdenVaultV2, params, {
        kind: "uups",
      })
    ).to.revertedWith("can not pre mint for non kyc investor");
  });

  it("pre-mint with kyc addresses", async function () {
    // 0: NON KYC, 1: US KYC, 2: GENERAL KYC
    await kycManagerIns.grantKycInBulk(
      [investor1.address, investor2.address],
      [2, 2]
    );

    const params = [
      usdcTokenIns.address,
      controller.address,
      operator.address,
      tbillOracle.address,
      aggregator.address,
      oplTreasury.address,
      treasuryAccount.address,
      // treasuryAccount.address,
      feeManager.address,
      kycManagerIns.address,
      [investor1.address, investor1.address],
      [_100k],
    ];

    const OpenEdenVaultV2 = await ethers.getContractFactory(
      "MockOpenEdenVaultV2"
    );
    await expect(
      upgrades.deployProxy(OpenEdenVaultV2, params, {
        kind: "uups",
      })
    ).to.revertedWith("length mismatch");
  });
});
