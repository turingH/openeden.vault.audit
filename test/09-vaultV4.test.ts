import { expect } from "chai";
import { describe } from "mocha";
import { BigNumber } from "ethers";
import { deployContract } from "../helpers/framework/contracts";
import { ethers, upgrades } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import VaultV2 from "../artifacts/contracts/OpenEdenVaultV2.sol/OpenEdenVaultV2.json";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {
  MockBUIDL,
  MockBuidlRedemption,
  USDC,
  TimelockController,
  OpenEdenVaultV2,
  OpenEdenVaultV3,
  OpenEdenVaultV4,
  FeeManager,
  KycManager,
  TBillPriceOracle,
  MockV3Aggregator,
  Controller,
  PartnerShip,
} from "../typechain-types";

describe.only("OpenEdenV4", async function () {
  const DEPOSIT = 0;
  const REDEEM = 1;
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
  const txFeeWorkdayWithdrawPct = 5; // 5bps
  const txFeeHolidayDepositPct = 10; // 10bps
  const txFeeHolidayWithdrawPct = 10; // 10bps
  const maxHolidayDepositPct = 500; // 5% tvl
  const maxHolidayAggDepositPct = 1000; // 10% tvl
  const managementFeeRate = 40; // 40bps
  const BPSUNIT = 10000;
  const delayTime = 60 * 60 * 24; // 24h

  // partnership parameters
  const depositFee = 5;
  const redeemFee = 5;

  let usdcTokenIns: USDC;
  let buidlTokenIns: MockBUIDL;
  let buidlRedemptionIns: MockBuidlRedemption;
  let feeManager: FeeManager;
  let kycManagerIns: KycManager;
  let vaultV2: OpenEdenVaultV2;
  let vaultV3: OpenEdenVaultV3;
  let vaultV4: OpenEdenVaultV4;
  let aggregator: MockV3Aggregator;
  let tbillOracle: TBillPriceOracle;
  let timelock: TimelockController;
  let controller: Controller;
  let partnership: PartnerShip;
  let OpenEdenVaultV3;
  let OpenEdenVaultV4;
  let iface;

  let owner: SignerWithAddress,
    investor1: SignerWithAddress,
    investor2: SignerWithAddress,
    investor3: SignerWithAddress,
    investor4: SignerWithAddress,
    lvAccount,
    child1,
    parent,
    non_kyc,
    operator,
    maintainer,
    treasuryAccount: SignerWithAddress,
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
      lvAccount,
      child1,
      parent,
      non_kyc,
      operator,
      maintainer,
      treasuryAccount,
      oplTreasury, // as quarantine treasury
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

    buidlTokenIns = await deployContract<MockBUIDL>("MockBUIDL");
    buidlRedemptionIns = await deployContract<MockBuidlRedemption>(
      "MockBuidlRedemption",
      buidlTokenIns.address,
      usdcTokenIns.address
    );

    controller = await deployContract<Controller>(
      "Controller",
      operator.address,
      owner.address
    );

    partnership = await deployContract<PartnerShip>("PartnerShip");
    await partnership.createPartnerShip([child1.address], parent.address);
    await partnership.updatePartnerShipFees(
      parent.address,
      depositFee,
      redeemFee
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

    const OpenEdenVaultV2Factory = await ethers.getContractFactory(
      "MockOpenEdenVaultV2"
    );
    vaultV2 = (await upgrades.deployProxy(OpenEdenVaultV2Factory, params, {
      kind: "uups",
    })) as OpenEdenVaultV2;

    //const proxy = await upgrades.deployProxy(OpenEdenVaultV3, params,{ kind: 'uups'});

    await usdcTokenIns.transfer(investor1.address, _10M);
    await usdcTokenIns.transfer(investor2.address, _10M);
    await usdcTokenIns.transfer(investor3.address, _10M);
    await usdcTokenIns.transfer(investor4.address, _10M);
    await usdcTokenIns.transfer(child1.address, _10M);
    await usdcTokenIns.transfer(non_kyc.address, _10M);

    await usdcTokenIns.connect(investor1).approve(vaultV2.address, _10M);
    await usdcTokenIns.connect(investor2).approve(vaultV2.address, _10M);
    await usdcTokenIns.connect(investor3).approve(vaultV2.address, _10M);
    await usdcTokenIns.connect(investor4).approve(vaultV2.address, _10M);
    await usdcTokenIns.connect(child1).approve(vaultV2.address, _10M);
    await usdcTokenIns.connect(non_kyc).approve(vaultV2.address, _10M);

    //operatorRole = await timelock.PROPOSER_ROLE();
    //adminRole = await timelock.DEFAULT_ADMIN_ROLE();

    // 0: NON KYC, 1: US KYC, 2: GENERAL KYC
    await kycManagerIns.grantKycInBulk(
      [
        investor1.address,
        investor2.address,
        investor3.address,
        investor4.address,
        child1.address,
        vaultV2.address,
        oplTreasury.address,
        lvAccount.address,
      ],
      [2, 2, 2, 1, 2, 2, 2, 2]
    );

    await vaultV2.setQTreasury(oplTreasury.address);
    await vaultV2.setMaxDepeg(200);
    await vaultV2.setMaxTimeDelay(24 * 60 * 60);
    console.log("deployOpenEdenFixture over!");

    await kycManagerIns.setStrict(true);
    OpenEdenVaultV3 = await ethers.getContractFactory("OpenEdenVaultV3");
    let v3 = await OpenEdenVaultV3.deploy();
    await v3.deployed();

    OpenEdenVaultV4 = await ethers.getContractFactory("OpenEdenVaultV4");
    let v4 = await OpenEdenVaultV4.deploy();
    await v4.deployed();

    // !!!! important !!!!
    await upgrades.validateUpgrade(vaultV2.address, OpenEdenVaultV4, {
      unsafeAllowRenames: true,
    });

    await vaultV2.upgradeTo(v4.address);
    vaultV4 = await OpenEdenVaultV4.attach(vaultV2.address);
    await vaultV4.connect(owner).setMaintainer(maintainer.address);

    await vaultV4.connect(maintainer).setPartnerShip(partnership.address);
    await vaultV4.connect(maintainer).setOperator([operator.address], [true]);

    // setup buidl
    await usdcTokenIns.transfer(buidlRedemptionIns.address, _100k);
    await buidlTokenIns.transfer(treasuryAccount.address, _1M);
    await buidlTokenIns.connect(treasuryAccount).approve(vaultV4.address, _50k);
    await vaultV4
      .connect(maintainer)
      .setBuidl(buidlTokenIns.address, buidlRedemptionIns.address);
  }

  beforeEach(async () => {
    await loadFixture(deployOpenEdenFixture);
  });

  describe("txsFee Function", () => {
    const ActionType = {
      DEPOSIT: 0,
      REDEEM: 1,
    };
    it("should calculate positive oeFee and positive pFee", async function () {
      // Set tx fee in FeeManager (for OpenEden fee)
      await feeManager.setTxFeeWorkdayDepositPct(50); // 50 basis points

      // Set positive partnership fee for child
      await partnership.updatePartnerShipFees(parent.address, 100, 50); // deposit fee 100bps (1%)
      const depositAssets = _10k;

      // Call txsFee and validate the result
      const [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        ActionType.DEPOSIT,
        child1.address,
        depositAssets
      );

      expect(oeFee).to.equal(depositAssets.mul(50).div(BPSUNIT)); // 0.5% fee
      expect(pFee).to.equal(depositAssets.mul(100).div(BPSUNIT)); // 1% partnership fee
      expect(totalFee).to.equal(oeFee.add(pFee)); // Total = oeFee + pFee
    });

    it("should calculate positive oeFee and negative pFee", async function () {
      // Set tx fee in FeeManager (for OpenEden fee)
      await feeManager.setTxFeeWorkdayDepositPct(50); // 50 basis points

      // Set negative partnership fee for child
      await partnership.updatePartnerShipFees(parent.address, -100, 50); // deposit fee -100bps (-1%)
      const depositAssets = _10k;

      // Call txsFee and validate the result
      const [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        ActionType.DEPOSIT,
        child1.address,
        depositAssets
      );

      expect(oeFee).to.equal(depositAssets.mul(50).div(BPSUNIT)); // 0.5% fee
      expect(pFee).to.equal(depositAssets.mul(-100).div(BPSUNIT)); // -1% partnership fee

      console.log(oeFee.add(pFee));
      expect(totalFee).to.be.gte(0); // Ensure non-negative totalFee
    });

    it("should less than positive oeFee when set negative pFee", async function () {
      // Set tx fee in FeeManager (for OpenEden fee)
      await feeManager.setTxFeeWorkdayDepositPct(50); // 50 basis points

      // Set negative partnership fee for child
      await partnership.updatePartnerShipFees(parent.address, -40, 50); // deposit fee -100bps (-1%)
      const depositAssets = _10k;

      // Call txsFee and validate the result
      const [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        ActionType.DEPOSIT,
        child1.address,
        depositAssets
      );

      expect(oeFee).to.equal(depositAssets.mul(50).div(BPSUNIT)); // 0.5% fee
      expect(pFee).to.equal(depositAssets.mul(-40).div(BPSUNIT)); // -1% partnership fee

      console.log(oeFee.add(pFee));
      expect(totalFee).to.be.gte(depositAssets.mul(10).div(BPSUNIT)); // Ensure non-negative totalFee
    });

    it("should ensure totalFee does not fall below minimum transaction fee", async function () {
      // Set tx fee in FeeManager (for OpenEden fee)
      await feeManager.setTxFeeWorkdayDepositPct(50); // 50 basis points

      // Set a small partnership fee
      await partnership.updatePartnerShipFees(parent.address, 1, 50); // deposit fee 1bps

      // Set minimum transaction fee in FeeManager
      await feeManager.setMinTxsFee(ethers.utils.parseUnits("8", 6)); // Min transaction fee 5 units
      const depositAssets = _1$;

      // Call txsFee and validate that the totalFee is at least the minTxsFee
      const [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        ActionType.DEPOSIT,
        child1.address,
        depositAssets
      );

      const expectedFee = oeFee.add(pFee);
      const minFee = await feeManager.getMinTxsFee();
      console.log("expectedFee: ", expectedFee);
      console.log("minFee: ", minFee);

      expect(totalFee).to.be.at.least(minFee); // Ensure total fee is not below minTxsFee
      expect(totalFee).to.equal(expectedFee.gte(minFee) ? expectedFee : minFee);
    });

    it("should return only oeFee when no PartnerShip contract is set", async function () {
      // Remove the partnership contract
      await vaultV4
        .connect(maintainer)
        .setPartnerShip(ethers.constants.AddressZero);

      // Set tx fee in FeeManager
      await feeManager.setTxFeeWorkdayDepositPct(50); // 50 basis points
      const depositAssets = _10k;

      // Call txsFee and validate that only oeFee is returned
      const [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        ActionType.DEPOSIT,
        investor1.address,
        depositAssets
      );

      expect(oeFee).to.equal(depositAssets.mul(50).div(BPSUNIT)); // 0.5% fee
      expect(pFee).to.equal(0); // No partnership fee
      expect(totalFee).to.equal(oeFee); // Total fee is only oeFee
    });
  });

  describe("setOperator Function", function () {
    it("should allow owner to set multiple operators", async function () {
      // Prepare operator addresses and their statuses
      const operators = [investor1.address, investor2.address];
      const statuses = [true, false]; // operator1 = true, operator2 = false

      // Call setOperator with valid data
      await vaultV4.connect(maintainer).setOperator(operators, statuses);

      // Check if operator statuses were set correctly
      const operator1Status = await vaultV4.operators(investor1.address);
      expect(operator1Status).to.equal(true);

      const operator2Status = await vaultV4.operators(investor2.address);
      expect(operator2Status).to.equal(false);
    });

    it("should emit SetOperator event for each operator", async function () {
      // Prepare operator addresses and their statuses
      const operators = [investor1.address, investor2.address];
      const statuses = [true, false]; // operator1 = true, operator2 = false

      // Expect the SetOperator event to be emitted twice, once for each operator
      await expect(vaultV4.connect(maintainer).setOperator(operators, statuses))
        .to.emit(vaultV4, "SetOperator")
        .withArgs(investor1.address, true) // First operator's event
        .and.to.emit(vaultV4, "SetOperator")
        .withArgs(investor2.address, false); // Second operator's event
    });

    it("should revert if called by a non-owner", async function () {
      // Prepare operator addresses and their statuses
      const operators = [investor1.address];
      const statuses = [true];

      // Try to call setOperator from non-owner account and expect revert
      await expect(
        vaultV4.connect(investor1).setOperator(operators, statuses)
      ).to.be.revertedWithCustomError(vaultV4, "TBillNoPermission");
    });

    it("should revert if array lengths are mismatched", async function () {
      // Prepare operator addresses and mismatched statuses array
      const operators = [investor1.address, investor2.address];
      const statuses = [true]; // Mismatched length

      // Expect revert due to array length mismatch
      await expect(vaultV4.connect(maintainer).setOperator(operators, statuses))
        .to.be.reverted;
    });
  });

  describe("updateEpoch Function", async function () {
    const twentyHours = 20 * 60 * 60; // 20 hours in seconds
    beforeEach(async function () {
      await vaultV4.connect(maintainer).setTimeBuffer(twentyHours);
    });

    it("should revert if updateEpoch is called before 20 hours have passed", async function () {
      await vaultV4.connect(operator).updateEpoch(false);

      // eleven hours have passed
      const newHour = twentyHours - 60 * 60 * 9;
      await time.increase(newHour); // Increase time by 19 hours 59 minutes

      await expect(
        vaultV4.connect(operator).updateEpoch(false)
      ).to.be.revertedWithCustomError(vaultV4, "TBillUpdateTooEarly");

      await vaultV4.connect(maintainer).setTimeBuffer(newHour);
      await vaultV4.connect(operator).updateEpoch(false);
    });

    it("should successfully updateEpoch after 20 hours have passed", async function () {
      await vaultV4.connect(operator).updateEpoch(false);
      const epoch1 = await vaultV4.epoch();
      expect(epoch1).to.equal(1);

      await time.increase(twentyHours);
      await vaultV4.connect(operator).updateEpoch(false);

      const epoch = await vaultV4.epoch();
      expect(epoch).to.equal(2);

      const isWeekend = await vaultV4.isWeekend();
      expect(isWeekend).to.equal(false);

      const lastUpdateTS = await vaultV4.lastUpdateTS();
      const currentTime = await time.latest();
      expect(lastUpdateTS).to.equal(currentTime);
    });
  });

  describe("cancel", async function () {
    const assets = _150k;
    let shares;
    beforeEach(async function () {
      let bal = await usdcTokenIns.balanceOf(investor1.address);
      console.log("bal: ", bal.toString());

      await vaultV4.connect(investor1).deposit(assets, investor1.address);
      shares = await vaultV4.balanceOf(investor1.address);

      await vaultV4.connect(investor1).redeem(shares, investor1.address);
    });

    it("should only allow maintainer to cancel", async function () {
      await expect(
        vaultV4.connect(investor1).cancel(1)
      ).to.be.revertedWithCustomError(vaultV4, "TBillNoPermission");
    });

    it("should transfer shares back to sender on cancel", async function () {
      const balanceBefore = await vaultV4.balanceOf(investor1.address);
      expect(balanceBefore).to.equal(0);

      await vaultV4.connect(maintainer).cancel(1);

      const balanceAfter = await vaultV4.balanceOf(investor1.address);
      console.log("before: ", balanceBefore.toString());
      console.log("after: ", balanceAfter.toString());
      expect(balanceAfter).to.equal(shares);
    });
  });

  describe("redeemIns test", async function () {
    const assets = _150k;
    let shares: any;
    beforeEach(async function () {
      let bal = await usdcTokenIns.balanceOf(investor1.address);
      // _10M
      console.log("bal: ", bal.toString());

      await vaultV4.connect(investor1).deposit(assets, investor1.address);
      shares = await vaultV4.balanceOf(investor1.address);
    });

    // usdc liquidity : _200K
    // balance: _1M
    // allowance:  _50K
    it("should success to get the minimum liquidity", async function () {
      const res = await vaultV4.checkLiquidity();
      console.log("check liquidity:", res);

      expect(res.minimum).to.equal(_50k);
    });

    it("should call redeemIns() successfully", async function () {
      const shares1 = _10k;
      await vaultV4.connect(investor1).redeemIns(shares1, investor1.address);
    });

    it("should not able to to redeemIns when no enough allowance", async function () {
      const shares1 = _100k;

      await expect(
        vaultV4.connect(investor1).redeemIns(shares1, investor1.address)
      ).to.revertedWith("ERC20: insufficient allowance");
    });

    it("should not able to to redeemIns when without enough usdc liqudity", async function () {
      await buidlTokenIns
        .connect(treasuryAccount)
        .approve(vaultV4.address, _10M);
      await expect(
        vaultV4.connect(investor1).redeemIns(shares, investor1.address)
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("deposit/withdraw tbill/usdc 1:1", () => {
    it("should fail if price is outdate ", async function () {
      // pass 3 days, so the price is outdate
      await time.increase(60 * 60 * 24 * 8);

      await expect(
        vaultV4.connect(investor1).deposit(_100k, investor1.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillPriceOutdated");
    });
    it("deposit 100k", async function () {
      expect(await vaultV4.firstDepositMap(investor1.address)).to.equal(false);
      await vaultV4.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      const investor1DepositFee = totalFee;
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        _100k.sub(investor1DepositFee)
      );

      expect(await vaultV4.totalAssets()).to.equal(
        _100k.sub(investor1DepositFee)
      );
      expect(await vaultV4.firstDepositMap(investor1.address)).to.equal(true);

      await vaultV4.connect(investor1).deposit(_100k, investor2.address);
      [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        DEPOSIT,
        investor2.address,
        _100k
      );
      expect(await vaultV4.balanceOf(investor2.address)).to.equal(
        _100k.sub(totalFee)
      );

      [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        DEPOSIT,
        child1.address,
        _100k
      );
      await vaultV4.connect(child1).deposit(_100k, child1.address);
      expect(await vaultV4.balanceOf(child1.address)).to.equal(
        _100k.sub(totalFee)
      );
      expect(totalFee).to.equal(investor1DepositFee.mul(2));

      await vaultV4.connect(child1).redeem(_50k, child1.address);
    });

    it("should have some assets onchain", async function () {
      await usdcTokenIns.transfer(vaultV4.address, _100k);
      expect(await vaultV4.onchainAssets()).to.greaterThan(BigNumber.from("0"));
    });

    it("should fail deposit when sender is a non-kyc user", async function () {
      await expect(
        vaultV4.connect(non_kyc).deposit(_100k, investor1.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("abnormal withdraw", async function () {
      await vaultV4.previewDeposit(_100k);
      await vaultV4.previewRedeem(_100k);
      vaultV4.connect(investor1).deposit(_100k.mul(5), investor1.address);
      await expect(
        vaultV4.connect(investor1).redeem(_50$, investor1.address)
      ).to.revertedWithCustomError(vaultV4, "TBillLessThanMin");
    });

    it("should fail deposit when receiver is a non-kyc user", async function () {
      await expect(
        vaultV4.connect(investor1).deposit(_100k, non_kyc.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("should fail deposit when receiver is a banned kyc user", async function () {
      await kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV4.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("redeem 10k, redeem 100k", async function () {
      // deposit
      await vaultV4.connect(investor1).deposit(_300k, investor1.address);
      let tbillBeforeRedeem = await vaultV4.balanceOf(investor1.address);
      let usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      console.log("tbillBeforeRedeem", tbillBeforeRedeem.toString());
      console.log("usdcBeforeRedeem", usdcBeforeRedeem.toString());

      // redeem 10k
      await expect(vaultV4.connect(investor1).redeem(_10k, investor1.address))
        .emit(vaultV4, "AddToWithdrawalQueue")
        .withArgs(investor1.address, investor1.address, _10k, anyValue);
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_10k)
      );

      // redeem 100k
      tbillBeforeRedeem = await vaultV4.balanceOf(investor1.address);
      usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV4.connect(investor1).redeem(_100k, investor1.address);
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_100k)
      );
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeRedeem
      );
    });

    describe("WithdrawalQueue", () => {
      it("processWithdrawQueue ", async function () {
        expect(
          await vaultV4.connect(investor1).deposit(_300k, investor1.address)
        ).to.emit(vaultV4, "ProcessDeposit");
        expect(
          await vaultV4.connect(investor2).deposit(_300k, investor2.address)
        ).emit(vaultV4, "ProcessDeposit");

        await usdcTokenIns.transfer(vaultV4.address, _300k);
        await usdcTokenIns.transfer(vaultV4.address, _300k);

        let usdcBalance = await usdcTokenIns.balanceOf(vaultV4.address);
        console.log("vaultV4 usdc balance: ", usdcBalance.toString());

        await vaultV4.connect(investor1).redeem(_10k, investor1.address);
        await vaultV4.connect(investor1).redeem(_10k, investor2.address); //investor1 -> investor2
        await vaultV4.connect(investor2).redeem(_100k, investor2.address);
        await vaultV4.connect(investor2).redeem(_150k, investor2.address);

        let length = await vaultV4.getWithdrawalQueueLength();
        expect(length).to.equal(4);

        console.log("----- process withdrawal queue 1 -----");
        await vaultV4.connect(operator).processWithdrawalQueue(1);
        length = await vaultV4.getWithdrawalQueueLength();
        expect(length).to.equal(3);
        // await displayQueue(vaultV4);

        console.log("----- process withdrawal queue 0 (all length) -----");
        await vaultV4.connect(operator).processWithdrawalQueue(0);
        length = await vaultV4.getWithdrawalQueueLength();

        // insufficient balance, so the last redeem will be failed
        expect(length).to.equal(0);

        console.log("test cancellation");
        await vaultV4.connect(investor1).redeem(_10k, investor1.address);
        await vaultV4.connect(investor2).redeem(_10k, investor2.address);
        await expect(
          vaultV4.connect(maintainer).cancel(10)
        ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidInput");
        await expect(
          vaultV4.connect(investor2).cancel(1)
        ).to.be.revertedWithCustomError(vaultV4, "TBillNoPermission");

        // await kycManagerIns.bannedInBulk([investor1.address]);
        // await kycManagerIns.bannedInBulk([investor2.address]);
        await vaultV4.connect(maintainer).cancel(2); // have tested 0, 1
      });

      it("should gt 0", async function () {
        await vaultV4.getWithdrawalQueueInfo(1);
        await expect(
          vaultV4.connect(operator).processWithdrawalQueue(1)
        ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidInput");
        vaultV4.connect(investor1).deposit(_100k, investor1.address);
        vaultV4.connect(investor1).redeem(_10k, investor1.address);
        vaultV4.connect(investor1).redeem(_10k, investor1.address);
        vaultV4.connect(investor1).redeem(_10k, investor1.address);

        await vaultV4.getWithdrawalQueueInfo(0);
        await vaultV4.getWithdrawalQueueInfo(1);
        await vaultV4.getWithdrawalQueueInfo(5);

        await vaultV4.getWithdrawalUserInfo(investor1.address);
        await vaultV4.getWithdrawalUserInfo(investor1.address);

        await expect(
          vaultV4.connect(investor1).processWithdrawalQueue(1)
        ).to.be.revertedWithCustomError(vaultV4, "TBillNoPermission");
        await expect(
          vaultV4.connect(operator).processWithdrawalQueue(5)
        ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidInput");
        await vaultV4.connect(operator).processWithdrawalQueue(1);

        tbillOracle = await deployContract<TBillPriceOracle>(
          "TBillPriceOracle",
          tbillOracleDecimal,
          tbillInitDeviation,
          "0", // price
          "0", // closing nav price
          operator.address,
          owner.address
        );
      });
    });

    it("should fail redeem when sender is a non-kyc user", async function () {
      vaultV4.connect(investor1).deposit(_100k, investor1.address);
      await expect(
        vaultV4.connect(non_kyc).redeem(10000, investor1.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("should fail redeem when receiver is a non-kyc user", async function () {
      vaultV4.connect(investor1).deposit(_100k, investor1.address);
      await expect(
        vaultV4.connect(investor1).redeem(10000, non_kyc.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("should fail redeem when receiver is a banned kyc user", async function () {
      vaultV4.connect(investor1).deposit(_100k, investor1.address);
      await kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV4.connect(investor1).redeem(10000, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("claim service fee", async function () {
      await feeManager.setManagementFeeRate(managementFeeRate);
      // deposit 1M ok
      await vaultV4.connect(investor1).deposit(_1M, investor1.address);
      // set weekend
      await vaultV4.connect(operator).updateEpoch(true);
      await vaultV4.connect(investor1).redeem(_100k, investor1.address);
      //await vaultV4.connect(operator).claimServiceFee(0);
      await expect(vaultV4.claimServiceFee(_1$)).to.revertedWithCustomError(
        vaultV4,
        "TBillNoPermission"
      );
      await expect(
        vaultV4.connect(operator).claimServiceFee(_1$)
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
      await usdcTokenIns.connect(investor2).transfer(vaultV4.address, _50$);
      await vaultV4.connect(operator).claimServiceFee(_1$);
    });

    it("sender: non-kyc, banned ", async function () {
      // deposit/redeem and transfer normal
      await vaultV4.connect(investor1).deposit(_100k, investor2.address);
      await vaultV4.connect(investor1).deposit(_100k, investor1.address);
      await vaultV4.connect(investor1).redeem(_10k, investor1.address);
      await vaultV4.connect(investor1).transfer(investor3.address, _10k);

      // sender banned, can't deposit/redeem and transfer
      await kycManagerIns.bannedInBulk([investor1.address]);
      await expect(
        vaultV4.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).redeem(_10k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).transfer(investor3.address, _10k)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");

      // sender unbanned, can deposit/redeem and transfer
      await kycManagerIns.unBannedInBulk([investor1.address]);
      await vaultV4.connect(investor1).deposit(_100k, investor2.address);
      await vaultV4.connect(investor1).redeem(_10k, investor2.address);
      await vaultV4.connect(investor1).transfer(investor3.address, _10k);

      // sender revoke kyc, can't deposit/redeem and transfer
      await kycManagerIns.revokeKycInBulk([investor1.address]);
      await expect(
        vaultV4.connect(investor1).deposit(_100k, investor1.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).redeem(_10k, investor1.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).transfer(investor3.address, _10k)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("receiver: non-kyc, banned ", async function () {
      // deposit/redeem and transfer normal
      await vaultV4.connect(investor1).deposit(_100k, investor2.address);
      await vaultV4.connect(investor1).deposit(_100k, investor1.address);
      await vaultV4.connect(investor1).redeem(_10k, investor2.address);
      await vaultV4.connect(investor1).transfer(investor2.address, _10k);

      // banned receiver, can't deposit/redeem and transfer
      await kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV4.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).redeem(_10k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).transfer(investor2.address, _10k)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");

      // unbanned receiver, can deposit/redeem and transfer
      await kycManagerIns.unBannedInBulk([investor2.address]);
      await vaultV4.connect(investor1).deposit(_100k, investor2.address);
      await vaultV4.connect(investor1).redeem(_10k, investor2.address);
      await vaultV4.connect(investor1).transfer(investor2.address, _10k);

      // revoke kyc receiver, can't deposit/redeem and transfer
      await kycManagerIns.revokeKycInBulk([investor2.address]);
      await expect(
        vaultV4.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).redeem(_10k, investor2.address)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).transfer(investor2.address, _10k)
      ).to.be.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
    });

    it("receiver is zero address", async function () {
      await vaultV4.connect(investor1).deposit(_100k, investor1.address);
      // deposit fail
      await expect(
        kycManagerIns.grantKycInBulk([ZERO_ADDRESS], [2])
      ).to.revertedWith("invalid address");
      // redeem fail
      await expect(
        vaultV4.connect(investor1).redeem(_10k, ZERO_ADDRESS)
      ).to.revertedWithCustomError(vaultV4, "TBillInvalidateKyc");
      await expect(
        vaultV4.connect(investor1).transfer(ZERO_ADDRESS, _10k)
      ).to.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("deposit/withdraw tbill/usdc 1:1", () => {
    it("deposit 100k", async function () {
      expect(await vaultV4.firstDepositMap(investor1.address)).to.equal(false);
      await vaultV4.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV4.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );

      let fee = totalFee;
      console.log("txsFee", oeFee.toString(), pFee.toString(), fee.toString());

      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        _100k.sub(fee)
      );
      expect(await vaultV4.totalAssets()).to.equal(_100k.sub(fee));
      expect(await vaultV4.firstDepositMap(investor1.address)).to.equal(true);

      await vaultV4.connect(investor1).deposit(_100k, investor2.address);
      expect(await vaultV4.balanceOf(investor2.address)).to.equal(
        _100k.sub(fee)
      );
    });

    it("redeem 10k, redeem 100k", async function () {
      // deposit
      await vaultV4.connect(investor1).deposit(_300k, investor1.address);
      let tbillBeforeRedeem = await vaultV4.balanceOf(investor1.address);
      let usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      console.log("tbillBeforeRedeem", tbillBeforeRedeem.toString());
      console.log("usdcBeforeRedeem", usdcBeforeRedeem.toString());

      // redeem 10k
      await expect(vaultV4.connect(investor1).redeem(_10k, investor1.address))
        .emit(vaultV4, "AddToWithdrawalQueue")
        .withArgs(investor1.address, investor1.address, _10k, anyValue);
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_10k)
      );

      // redeem 100k
      tbillBeforeRedeem = await vaultV4.balanceOf(investor1.address);
      usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV4.connect(investor1).redeem(_100k, investor1.address);
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_100k)
      );
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeRedeem
      );
    });

    it("deposit 150k, deposit 10k", async function () {
      // deposit 150k
      let tbillBeforeDeposit = await vaultV4.balanceOf(investor1.address);
      let usdcBeforeDeposit = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV4.connect(investor1).deposit(_150k, investor1.address);
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeDeposit.sub(_150k)
      );
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        tbillBeforeDeposit.add(_150k).sub(_75$)
      );

      // deposit 10k
      tbillBeforeDeposit = await vaultV4.balanceOf(investor1.address);
      usdcBeforeDeposit = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV4.connect(investor1).deposit(_10k, investor1.address);
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeDeposit.sub(_10k)
      );
      expect(await vaultV4.balanceOf(investor1.address)).to.equal(
        tbillBeforeDeposit.add(_10k).sub(_25$)
      );

      await vaultV4.connect(investor1).deposit(_100k, investor1.address);
      await vaultV4.connect(investor1).redeem(_100k, investor1.address);
    });
  });

  describe("offRamp and offRmapQ", async () => {
    it("should success to offRamp usdc", async function () {
      await usdcTokenIns.transfer(vaultV4.address, _100k);
      await vaultV4.connect(operator).offRamp(_1$);
    });

    it("should success to offRampQ usdc", async function () {
      await usdcTokenIns.transfer(vaultV4.address, _100k);
      await vaultV4.connect(operator).offRampQ(usdcTokenIns.address, _1$);
    });

    it("should fail to offRampQ tbill", async function () {
      await expect(
        vaultV4.connect(operator).offRampQ(vaultV4.address, _1$)
      ).to.revertedWithCustomError(vaultV4, "TBillInvalidInput");
    });

    it("should fail to offRamp tbill by non operator", async function () {
      await expect(
        vaultV4.connect(investor1).offRamp(_1$)
      ).to.be.revertedWithCustomError(vaultV4, "TBillNoPermission");

      await expect(
        vaultV4.connect(investor1).offRampQ(usdcTokenIns.address, _1$)
      ).to.be.revertedWithCustomError(vaultV4, "TBillNoPermission");
    });
  });

  it("setter addresses", async function () {
    await expect(
      vaultV4.connect(owner).setOplTreasury(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(owner).setFeeManager(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(owner).setKycManager(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(owner).setTBillPriceFeed(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(owner).setController(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(owner).setTreasury(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(owner).setQTreasury(ZERO_ADDRESS)
    ).to.revertedWithCustomError(vaultV4, "TBillZeroAddress");
    await expect(
      vaultV4.connect(operator).setMaintainer(ZERO_ADDRESS)
    ).to.revertedWith("Ownable: caller is not the owner");
    await expect(
      vaultV4.connect(operator).setOperator([ZERO_ADDRESS], [true])
    ).to.revertedWithCustomError(vaultV4, "TBillNoPermission");
  });
});
