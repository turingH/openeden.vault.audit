import { expect } from "chai";
import { describe } from "mocha";
import { BigNumber, Bytes } from "ethers";
import { deployContract, execute } from "../helpers/framework/contracts";
import { ethers, upgrades } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

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

describe("OpenEden", async function () {
  const chainlinkDecimal = 8;
  const tbillOracleDecimal = 8;
  const tbillOracleInitPrice = BigNumber.from("100000000"); // 1 : 1 (tbill/usd)
  const chainlinkInitAnswer = BigNumber.from("98999999"); // 0.99 : 1  (usd/usdc)
  const tbillInitDeviation = BigNumber.from("100");

  const _500 = BigNumber.from("500000000"); // 500
  const _10k = BigNumber.from("10000000000"); // 10k

  const _1M = BigNumber.from("1000000000000"); // 1M
  const _10M = BigNumber.from("10000000000000"); // 1M
  const _100k = BigNumber.from("100000000000"); // 100k

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
  let aggregator: MockV3Aggregator;
  let tbillOracle: TBillPriceOracle;
  let timelock: TimelockController;
  let controller: Controller;
  let iface;

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
    timelockExecutor;

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
    const vaultParameters = {
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
    await feeManager.connect(owner).setManagementFeeRate(managementFeeRate);
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

    const params = [
      usdcTokenIns.address,
      controller.address,
      operator.address,
      tbillOracle.address,
      aggregator.address,
      oplTreasury.address,
      treasuryAccount.address,
      feeManager.address,
      kycManagerIns.address,
      [],
      [],
    ];

    const OpenEdenVaultV2 = await ethers.getContractFactory(
      "MockOpenEdenVaultV2"
    );
    vaultV2 = (await upgrades.deployProxy(OpenEdenVaultV2, params, {
      kind: "uups",
    })) as OpenEdenVaultV2;

    await vaultV2.setQTreasury(oplTreasury.address);
    await vaultV2.setMaxDepeg(200);
    await vaultV2.setMaxTimeDelay(24 * 60 * 60);
    console.log("deployOpenEdenFixture over!");

    await kycManagerIns.setStrict(true);
  }

  beforeEach(async () => {
    await loadFixture(deployOpenEdenFixture);
  });

  describe("Timelock", () => {
    it("role check", async function () {
      const hasProposerRole = await timelock.hasRole(
        await timelock.PROPOSER_ROLE(),
        timelockProposer.address
      );
      expect(hasProposerRole).to.be.true;
      const hasCancelerRole = await timelock.hasRole(
        await timelock.CANCELLER_ROLE(),
        timelockProposer.address
      );
      expect(hasCancelerRole).to.be.true;
      const hasExecuterRole = await timelock.hasRole(
        await timelock.EXECUTOR_ROLE(),
        timelockExecutor.address
      );
      expect(hasExecuterRole).to.be.true;
      let hasAdminRole = await timelock.hasRole(
        await timelock.TIMELOCK_ADMIN_ROLE(),
        timelock.address
      );
      expect(hasAdminRole).to.be.true;
      hasAdminRole = await timelock.hasRole(
        await timelock.TIMELOCK_ADMIN_ROLE(),
        timelockAdmin.address
      );
      expect(hasAdminRole).to.be.true;
    });
    // SET TREASURY ADDRESS
    it("schedule and execute set new treasury address", async function () {
      await vaultV2.transferOwnership(timelock.address);
      // check current treasury address
      expect(await vaultV2.treasury()).to.equal(treasuryAccount.address);

      // prepare parametesrs
      const payload = iface.encodeFunctionData("setTreasury", [
        newTreasuryAccount.address,
      ]);
      const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      const predecessor = ethers.constants.HashZero;

      // schedule for set new treasury address
      await timelock
        .connect(timelockProposer)
        .schedule(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt,
          delayTime
        );

      // advance time by 24 hours and mine a new block
      await time.increase(delayTime);

      // execute function setTreasury
      await timelock
        .connect(timelockExecutor)
        .execute(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt
        );

      // check current treasury address again
      expect(await vaultV2.treasury()).to.equal(newTreasuryAccount.address);
    });

    it("can not execute when not enough time", async function () {
      await vaultV2.transferOwnership(timelock.address);
      // prepare parametesrs
      const payload = iface.encodeFunctionData("setTreasury", [
        newTreasuryAccount.address,
      ]);
      const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      const predecessor = ethers.constants.HashZero;

      // schedule for set new treasury address
      await timelock
        .connect(timelockProposer)
        .schedule(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt,
          delayTime
        );

      // advance time by 12h and mine a new block, expected 24h
      await time.increase(60 * 60 * 12);

      // execute function setTreasury
      await expect(
        timelock
          .connect(timelockExecutor)
          .execute(
            vaultV2.address,
            ethers.constants.Zero,
            payload,
            predecessor,
            salt
          )
      ).to.rejectedWith("TimelockController: operation is not ready");
    });

    it("can not direct set new treasury address", async function () {
      await vaultV2.transferOwnership(timelock.address);
      await expect(
        vaultV2.setTreasury(newTreasuryAccount.address)
      ).to.rejectedWith("Ownable: caller is not the owner");
    });

    it("can not execute when not enough time", async function () {
      await vaultV2.transferOwnership(timelock.address);

      // prepare parametesrs
      const payload = iface.encodeFunctionData("setTreasury", [
        newTreasuryAccount.address,
      ]);
      const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      const predecessor = ethers.constants.HashZero;

      // schedule
      await timelock
        .connect(timelockProposer)
        .schedule(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt,
          delayTime
        );

      // advance time by (24 hours - 1 minutes) and mine a new block
      await time.increase(delayTime - 60);

      // execute
      await expect(
        timelock
          .connect(timelockExecutor)
          .execute(
            vaultV2.address,
            ethers.constants.Zero,
            payload,
            predecessor,
            salt
          )
      ).to.rejectedWith("TimelockController: operation is not ready");
    });

    it("only proposer account can make schedule call", async function () {
      await vaultV2.transferOwnership(timelock.address);

      // prepare parametesrs
      const payload = iface.encodeFunctionData("setTreasury", [
        newTreasuryAccount.address,
      ]);
      const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      const predecessor = ethers.constants.HashZero;

      // schedule
      await expect(
        timelock.schedule(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt,
          delayTime
        )
      ).to.rejectedWith(
        "AccessControl: account 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 is missing role 0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"
      );
    });

    it("only executor account can trigger execute scheduled function", async function () {
      await vaultV2.transferOwnership(timelock.address);
      // check current treasury address
      expect(await vaultV2.treasury()).to.equal(treasuryAccount.address);

      // prepare parametesrs
      const payload = iface.encodeFunctionData("setTreasury", [
        newTreasuryAccount.address,
      ]);
      const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      const predecessor = ethers.constants.HashZero;

      // schedule for set new treasury address
      await timelock
        .connect(timelockProposer)
        .schedule(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt,
          delayTime
        );

      // advance time by 24 hours and mine a new block
      await time.increase(delayTime);

      // execute function setTreasury
      await expect(
        timelock.execute(
          vaultV2.address,
          ethers.constants.Zero,
          payload,
          predecessor,
          salt
        )
      ).to.revertedWith(
        "AccessControl: account 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 is missing role 0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63"
      );
    });
  });
});
