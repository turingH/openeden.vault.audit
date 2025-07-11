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
  OpenEdenVaultV3,
  FeeManager,
  KycManager,
  TBillPriceOracle,
  MockV3Aggregator,
  Controller,
  PartnerShip,
} from "../typechain-types";

describe("OpenEden", async function () {
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
  const depositFee = 5;
  const redeemFee = 5;

  let usdcTokenIns: USDC;
  let feeManager: FeeManager;
  let kycManagerIns: KycManager;
  let vaultV2: OpenEdenVaultV2;
  let vaultV3: OpenEdenVaultV3;
  let aggregator: MockV3Aggregator;
  let tbillOracle: TBillPriceOracle;
  let timelock: TimelockController;
  let controller: Controller;
  let partnership: PartnerShip;
  let OpenEdenVaultV3;
  let iface;
  let operatorRole;
  let adminRole;

  let owner,
    investor1,
    investor2,
    investor3,
    investor4,
    lvAccount,
    child1,
    parent,
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
      lvAccount,
      child1,
      parent,
      non_kyc,
      operator,
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
      // treasuryAccount.address,
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

    await vaultV2.upgradeTo(v3.address);
    vaultV3 = await OpenEdenVaultV3.attach(vaultV2.address);
    await vaultV3.setPartnerShip(partnership.address);
  }

  beforeEach(async () => {
    await loadFixture(deployOpenEdenFixture);
  });

  describe("Initialize", () => {
    it("chainlink aggregator", async function () {
      expect(await aggregator.decimals()).to.equal(chainlinkDecimal);
      expect(await aggregator.latestAnswer()).to.equal(chainlinkInitAnswer);
    });

    it("check partnership", async function () {
      expect(await partnership.getParent(child1.address)).to.equal(
        parent.address
      );

      const [updatedDepositFee, updatedRedeemFee] =
        await partnership.getParentFees(parent.address);

      expect(updatedDepositFee).to.equal(depositFee);
      expect(updatedRedeemFee).to.equal(redeemFee);
    });

    it("tbill oracle", async function () {
      expect(await tbillOracle.decimals()).to.equal(tbillOracleDecimal);
      expect(await tbillOracle.maxPriceDeviation()).to.equal(
        tbillInitDeviation
      );
      expect(await tbillOracle.latestAnswer()).to.equal(tbillOracleInitPrice);
    });

    it("vault v2", async function () {
      expect(await vaultV2.decimals()).to.equal(vaultDecimals);
      expect(await vaultV2.isWeekend()).to.equal(false);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      console.log("oeFee", oeFee.toString());
      console.log("pFee", pFee.toString());
      console.log("totalFee", totalFee.toString());
      console.log(oeFee.add(pFee).toString());
      expect(totalFee).to.equal(_50$);

      console.log("1");
      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        child1.address,
        _100k
      );
      expect(totalFee).to.equal(_50$.mul(2));

      console.log("2");
      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        REDEEM,
        investor1.address,
        _10k
      );
      expect(totalFee).to.equal(_25$);

      console.log("3");
      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        REDEEM,
        child1.address,
        _10k
      );
      expect(totalFee).to.equal(_25$);

      console.log("4");
      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        REDEEM,
        investor1.address,
        _100k
      );
      expect(totalFee).to.equal(_50$);

      console.log("5");
      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        REDEEM,
        child1.address,
        _100k
      );
      expect(totalFee).to.equal(_50$.mul(2));

      console.log("6");
      expect(await vaultV2.tbillUsdcRate()).to.equal(_1$);
    });

    it("fee manager", async function () {
      const [minDeposit, maxDeposit] = await feeManager.getMinMaxDeposit(); // min/max deposit
      expect(minDeposit).to.equal(_10k);
      expect(maxDeposit).to.equal(_1M);
      expect(await feeManager.getMinTxsFee()).to.equal("25000000");
      expect(await feeManager.getTxFeePct(DEPOSIT, false)).to.equal("5");
      expect(await feeManager.getTxFeePct(DEPOSIT, true)).to.equal("10");

      expect(await feeManager.getFirstDeposit()).to.equal(_100k); // first deposit
    });

    it("controller", async function () {
      const pausedDeposit = await controller.pausedDeposit();
      const pausedWithdraw = await controller.pausedWithdraw();

      expect(pausedDeposit).to.equal(false);
      expect(pausedWithdraw).to.equal(false);
    });

    it("kyc", async function () {
      expect(await kycManagerIns.isKyc(investor1.address)).to.equal(true);
      expect(await kycManagerIns.isKyc(investor2.address)).to.equal(true);
      expect(await kycManagerIns.isKyc(investor3.address)).to.equal(true);
      expect(await kycManagerIns.isKyc(investor4.address)).to.equal(true);
    });
  });

  describe("usdc depeg check", () => {
    it("should fail when usdc depeg", async function () {
      await vaultV2.setMaxDepeg(100);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.be.revertedWith("usdc and usd depeg!");
    });

    it("stale usdc answer!", async function () {
      await vaultV2.setMaxTimeDelay(1);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.be.revertedWith("stale usdc answer!");
    });

    // it("initialize", async function () {
    //   await expect(
    //     vaultV2.initialize(
    //       usdcTokenIns.address,
    //       controller.address,
    //       operator.address,
    //       tbillOracle.address,
    //       aggregator.address,
    //       oplTreasury.address,
    //       treasuryAccount.address,
    //       // treasuryAccount.address,
    //       feeManager.address,
    //       kycManagerIns.address,
    //       [],
    //       []
    //     )
    //   ).to.revertedWith("Initializable: contract is already initialized");
    // });
  });

  describe("deposit/withdraw tbill/usdc 1:1", () => {
    it("deposit 100k", async function () {
      expect(await vaultV2.hasDepositBefore(investor1.address)).to.equal(false);
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      const investor1DepositFee = totalFee;
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        _100k.sub(investor1DepositFee)
      );

      expect(await vaultV2.totalAssets()).to.equal(
        _100k.sub(investor1DepositFee)
      );
      expect(await vaultV2.hasDepositBefore(investor1.address)).to.equal(true);

      await vaultV2.connect(investor1).deposit(_100k, investor2.address);
      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor2.address,
        _100k
      );
      expect(await vaultV2.balanceOf(investor2.address)).to.equal(
        _100k.sub(totalFee)
      );

      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        child1.address,
        _100k
      );
      await vaultV2.connect(child1).deposit(_100k, child1.address);
      expect(await vaultV2.balanceOf(child1.address)).to.equal(
        _100k.sub(totalFee)
      );
      expect(totalFee).to.equal(investor1DepositFee.mul(2));

      await vaultV2.connect(child1).redeem(_50k, child1.address);
    });

    it("should fail deposit when sender is a non-kyc user", async function () {
      await expect(
        vaultV2.connect(non_kyc).deposit(_100k, investor1.address)
      ).to.be.revertedWith("invalid kyc");
    });

    it("abnormal deposit", async function () {
      await expect(
        vaultV2.connect(investor1).deposit(_50k, investor1.address)
      ).to.revertedWith("amount should gt first deposit");

      let res1 = await vaultV3.connect(investor1).canDeposit(0);
      expect(res1.toNumber()).to.equal(0);

      vaultV2.connect(investor1).deposit(_100k.mul(5), investor1.address);

      await expect(
        vaultV2.connect(investor1).deposit(_50$, investor1.address)
      ).to.revertedWith("deposit too few");
      await expect(
        vaultV2.connect(investor1).deposit(_1M, investor1.address)
      ).to.revertedWith("deposit too much");

      await vaultV2.connect(operator).updateEpoch(false);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      res1 = await vaultV3.connect(investor1).canDeposit(0);
      expect(res1.toNumber()).to.equal(_100k);

      await expect(
        vaultV2.connect(investor1).deposit(_1M.mul(2), investor1.address)
      ).to.revertedWith("deposit too much");

      const feePara = await feeManager.getMinMaxDeposit();
      res1 = await vaultV3.connect(investor1).canDeposit(feePara[1].toString());
      expect(res1.toString()).to.equal(_100k.add(feePara[1]));

      res1 = await vaultV3.connect(investor1).canDeposit(0);
      expect(res1.toString()).to.equal(_100k);
    });

    it("abnormal withdraw", async function () {
      await vaultV2.previewDeposit(_100k);
      await vaultV2.previewRedeem(_100k);
      vaultV2.connect(investor1).deposit(_100k.mul(5), investor1.address);
      await expect(
        vaultV2.connect(investor1).redeem(_50$, investor1.address)
      ).to.revertedWith("withdraw too few");
      await vaultV2.connect(operator).updateEpoch(false);
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      await vaultV2.connect(operator).updateEpoch(false);
      await vaultV2.connect(investor1).deposit(_100k.mul(8), investor1.address);
      await vaultV2.connect(operator).updateEpoch(false);
      await vaultV2.connect(investor1).deposit(_100k.mul(8), investor1.address);
      await expect(
        vaultV2.connect(investor1).redeem(_1M.mul(2), investor1.address)
      ).to.revertedWith("withdraw too much");
      await vaultV2.connect(operator).updateEpoch(false);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      await expect(
        vaultV2.connect(investor1).redeem(_1M.mul(2), investor1.address)
      ).to.revertedWith("withdraw too much");
      await vaultV2.connect(operator).updateEpoch(false);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      await expect(
        vaultV2.connect(investor1).redeem(_1M, investor1.address)
      ).to.revertedWith("withdraw too much");
    });

    it("should fail deposit when receiver is a non-kyc user", async function () {
      await expect(
        vaultV2.connect(investor1).deposit(_100k, non_kyc.address)
      ).to.be.revertedWith("invalid kyc");
    });

    it("should fail deposit when receiver is a banned kyc user", async function () {
      kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
    });

    it("redeem 10k, redeem 100k", async function () {
      // deposit
      await vaultV2.connect(investor1).deposit(_300k, investor1.address);
      let tbillBeforeRedeem = await vaultV2.balanceOf(investor1.address);
      let usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      console.log("tbillBeforeRedeem", tbillBeforeRedeem.toString());
      console.log("usdcBeforeRedeem", usdcBeforeRedeem.toString());

      // redeem 10k
      await expect(vaultV2.connect(investor1).redeem(_10k, investor1.address))
        .emit(vaultV2, "AddToWithdrawalQueue")
        .withArgs(investor1.address, investor1.address, _10k, anyValue);
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_10k)
      );

      // redeem 100k
      tbillBeforeRedeem = await vaultV2.balanceOf(investor1.address);
      usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_100k)
      );
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeRedeem
      );
    });

    it("should fail redeem when sender is a non-kyc user", async function () {
      vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await expect(
        vaultV2.connect(non_kyc).redeem(10000, investor1.address)
      ).to.be.revertedWith("invalid kyc");
    });

    it("should fail redeem when receiver is a non-kyc user", async function () {
      vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await expect(
        vaultV2.connect(investor1).redeem(10000, non_kyc.address)
      ).to.be.revertedWith("invalid kyc");
    });

    it("should fail redeem when receiver is a banned kyc user", async function () {
      vaultV2.connect(investor1).deposit(_100k, investor1.address);
      kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV2.connect(investor1).redeem(10000, investor2.address)
      ).to.be.revertedWith("invalid kyc");
    });

    it("weekend restriction deposit", async function () {
      // deposit 1M ok
      await vaultV2.connect(investor1).deposit(_1M, investor1.address);
      // set weekend
      await expect(vaultV2.updateEpoch(true)).to.revertedWith(
        "permission denied"
      );
      await vaultV2.connect(operator).updateEpoch(true);
      expect(await vaultV2.isWeekend()).to.equal(true);
      // deposit 100k fail (>5% tvl)
      await expect(
        vaultV2.connect(investor2).deposit(_100k, investor2.address)
      ).to.revertedWith("deposit too much");
      // deposit 10k ok
      await vaultV2.connect(investor1).deposit(_10k, investor1.address);
      // deposit 50k ok, net aggregated = ~60k,  tvl =~1M + 1k
      await vaultV2.connect(investor1).deposit(_50k, investor1.address);
      // deposit 50k fail, got net aggregated condition, net aggregated = 110k > 10% tvl (~1M + 60k)
      await expect(
        vaultV2.connect(investor1).deposit(_50k, investor1.address)
      ).to.revertedWith("reach out weekend limit");
      // redeem 50k, net aggregated = 10k
      await vaultV2.connect(investor1).redeem(_50k, investor1.address);
      // deposit 50k ok, net aggregated = ~60k, (~1M + 10k)
      await vaultV2.connect(investor1).deposit(_50k, investor1.address);
    });

    it("update epoch", async function () {
      // deposit 1M ok
      await vaultV2.connect(investor1).deposit(_1M, investor1.address);
      // set weekend
      await vaultV2.connect(operator).updateEpoch(true);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      await vaultV2.connect(operator).updateEpoch(false);
      await expect(vaultV2.setWeekendFlag(true)).to.revertedWith(
        "permission denied"
      );
      await vaultV2.connect(operator).updateEpoch(true);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      await vaultV2.connect(investor1).deposit(_10k, investor1.address);
      await vaultV2.connect(operator).updateEpoch(true);
      await vaultV2.connect(investor1).redeem(_10k, investor1.address);
      await vaultV2.connect(investor1).deposit(_10k, investor1.address);
    });

    it("claim service fee", async function () {
      await feeManager.setManagementFeeRate(managementFeeRate);
      // deposit 1M ok
      await vaultV2.connect(investor1).deposit(_1M, investor1.address);
      // set weekend
      await vaultV2.connect(operator).updateEpoch(true);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      //await vaultV2.connect(operator).claimServiceFee(0);
      await expect(vaultV2.claimServiceFee(_1$)).to.revertedWith(
        "permission denied"
      );
      await expect(
        vaultV2.connect(operator).claimServiceFee(_1$)
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
      await usdcTokenIns.connect(investor2).transfer(vaultV2.address, _50$);
      await vaultV2.connect(operator).claimServiceFee(_1$);
    });

    it("setter addresses", async function () {
      await expect(vaultV2.setFeeManager(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setKycManager(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setOperator(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setTBillPriceFeed(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setController(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setOplTreasury(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setTreasury(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setQTreasury(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );
      await expect(vaultV2.setUsdcPriceFeed(ZERO_ADDRESS)).to.revertedWith(
        "zero address!"
      );

      await expect(
        vaultV2.connect(investor1).setFeeManager(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setKycManager(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setOperator(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setTBillPriceFeed(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setController(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setOplTreasury(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setTreasury(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setQTreasury(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(vaultV2.connect(investor1).setMaxDepeg(500)).to.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(
        vaultV2.connect(investor1).setMaxTimeDelay(500)
      ).to.revertedWith("Ownable: caller is not the owner");
      await expect(
        vaultV2.connect(investor1).setUsdcPriceFeed(investor1.address)
      ).to.revertedWith("Ownable: caller is not the owner");

      await vaultV2.setFeeManager(investor1.address);
      await vaultV2.setKycManager(investor1.address);
      await vaultV2.setOperator(investor1.address);
      await vaultV2.setTBillPriceFeed(investor1.address);
      await vaultV2.setController(investor1.address);
      await vaultV2.setOplTreasury(investor1.address);
    });

    it("getter", async function () {});

    it("sender: non-kyc, banned ", async function () {
      // deposit/redeem and transfer normal
      await vaultV2.connect(investor1).deposit(_100k, investor2.address);
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await vaultV2.connect(investor1).redeem(_10k, investor1.address);
      await vaultV2.connect(investor1).transfer(investor3.address, _10k);

      // sender banned, can't deposit/redeem and transfer
      kycManagerIns.bannedInBulk([investor1.address]);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).redeem(_10k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).transfer(investor3.address, _10k)
      ).to.be.revertedWith("invalid kyc");

      // sender unbanned, can deposit/redeem and transfer
      await kycManagerIns.unBannedInBulk([investor1.address]);
      await vaultV2.connect(investor1).deposit(_100k, investor2.address);
      await vaultV2.connect(investor1).redeem(_10k, investor2.address);
      await vaultV2.connect(investor1).transfer(investor3.address, _10k);

      // sender revoke kyc, can't deposit/redeem and transfer
      await kycManagerIns.revokeKycInBulk([investor1.address]);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).redeem(_10k, investor1.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).transfer(investor3.address, _10k)
      ).to.be.revertedWith("invalid kyc");
    });

    it("receiver: non-kyc, banned ", async function () {
      // deposit/redeem and transfer normal
      await vaultV2.connect(investor1).deposit(_100k, investor2.address);
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await vaultV2.connect(investor1).redeem(_10k, investor2.address);
      await vaultV2.connect(investor1).transfer(investor2.address, _10k);

      // banned receiver, can't deposit/redeem and transfer
      await kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).redeem(_10k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).transfer(investor2.address, _10k)
      ).to.be.revertedWith("invalid kyc");

      // unbanned receiver, can deposit/redeem and transfer
      await kycManagerIns.unBannedInBulk([investor2.address]);
      await vaultV2.connect(investor1).deposit(_100k, investor2.address);
      await vaultV2.connect(investor1).redeem(_10k, investor2.address);
      await vaultV2.connect(investor1).transfer(investor2.address, _10k);

      // revoke kyc receiver, can't deposit/redeem and transfer
      await kycManagerIns.revokeKycInBulk([investor2.address]);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).redeem(_10k, investor2.address)
      ).to.be.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).transfer(investor2.address, _10k)
      ).to.be.revertedWith("invalid kyc");
    });

    it("receiver is zero address", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      // deposit fail
      await expect(
        kycManagerIns.grantKycInBulk([ZERO_ADDRESS], [2])
      ).to.revertedWith("invalid address");
      // redeem fail
      await expect(
        vaultV2.connect(investor1).redeem(_10k, ZERO_ADDRESS)
      ).to.revertedWith("invalid kyc");
      await expect(
        vaultV2.connect(investor1).transfer(ZERO_ADDRESS, _10k)
      ).to.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("deposit/withdraw tbill/usdc 1:1", () => {
    it("deposit 100k", async function () {
      expect(await vaultV2.hasDepositBefore(investor1.address)).to.equal(false);
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );

      let fee = totalFee;
      console.log("txsFee", oeFee.toString(), pFee.toString(), fee.toString());

      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        _100k.sub(fee)
      );
      expect(await vaultV2.totalAssets()).to.equal(_100k.sub(fee));
      expect(await vaultV2.hasDepositBefore(investor1.address)).to.equal(true);

      await vaultV2.connect(investor1).deposit(_100k, investor2.address);
      expect(await vaultV2.balanceOf(investor2.address)).to.equal(
        _100k.sub(fee)
      );
    });

    it("redeem 10k, redeem 100k", async function () {
      // deposit
      await vaultV2.connect(investor1).deposit(_300k, investor1.address);
      let tbillBeforeRedeem = await vaultV2.balanceOf(investor1.address);
      let usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      console.log("tbillBeforeRedeem", tbillBeforeRedeem.toString());
      console.log("usdcBeforeRedeem", usdcBeforeRedeem.toString());

      // redeem 10k
      await expect(vaultV2.connect(investor1).redeem(_10k, investor1.address))
        .emit(vaultV2, "AddToWithdrawalQueue")
        .withArgs(investor1.address, investor1.address, _10k, anyValue);
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_10k)
      );

      // redeem 100k
      tbillBeforeRedeem = await vaultV2.balanceOf(investor1.address);
      usdcBeforeRedeem = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBeforeRedeem.sub(_100k)
      );
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeRedeem
      );
    });

    it("deposit 150k, deposit 10k", async function () {
      // deposit 150k
      let tbillBeforeDeposit = await vaultV2.balanceOf(investor1.address);
      let usdcBeforeDeposit = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV2.connect(investor1).deposit(_150k, investor1.address);
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeDeposit.sub(_150k)
      );
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBeforeDeposit.add(_150k).sub(_75$)
      );

      // deposit 10k
      tbillBeforeDeposit = await vaultV2.balanceOf(investor1.address);
      usdcBeforeDeposit = await usdcTokenIns.balanceOf(investor1.address);
      await vaultV2.connect(investor1).deposit(_10k, investor1.address);
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBeforeDeposit.sub(_10k)
      );
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBeforeDeposit.add(_10k).sub(_25$)
      );
      await tbillOracle.updateMaxPriceDeviation(50000);
      await tbillOracle.updatePrice("120000000");
      expect(await vaultV2.tbillUsdcRate()).to.equals("1200000");
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await vaultV2.connect(investor1).redeem(_100k, investor1.address);
    });
  });

  describe("offRamp and offRmapQ", async () => {
    it("should success to offRamp usdc", async function () {
      await usdcTokenIns.transfer(vaultV2.address, _100k);
      await vaultV2.connect(operator).offRamp(_1$);
    });

    it("should success to offRampQ usdc", async function () {
      await usdcTokenIns.transfer(vaultV2.address, _100k);
      await vaultV2.connect(operator).offRampQ(usdcTokenIns.address, _1$);
    });

    it("should fail to offRampQ tbill", async function () {
      await expect(
        vaultV2.connect(operator).offRampQ(vaultV2.address, _1$)
      ).to.revertedWith("not allowed to move tbill!");
    });

    it("should fail to offRamp tbill by non operator", async function () {
      await expect(vaultV2.connect(investor1).offRamp(_1$)).to.be.revertedWith(
        "permission denied"
      );

      await expect(
        vaultV2.connect(investor1).offRampQ(usdcTokenIns.address, _1$)
      ).to.be.revertedWith("permission denied");
    });
  });

  //check free rate base on timestamp
  describe("weekend restriction transaction fee", () => {
    it("check weekend", async function () {
      await vaultV2.connect(operator).setWeekendFlag(true); // Saturday(weekend)
      expect(await vaultV2.isWeekend()).to.equal(true);
    });

    it("check totalWeekendDeposit", async function () {
      await vaultV2.connect(investor1).deposit(_300k, investor1.address);
      expect(await vaultV2.currWeekendDeposit()).to.equal(0);
      await vaultV2.connect(operator).setWeekendFlag(true); // weekend

      await vaultV2.connect(investor1).deposit(_10k, investor1.address); // deposit 10k in weekend
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _10k
      );
      let fee = totalFee;
      expect(await vaultV2.currWeekendDeposit()).to.equal(_10k.sub(fee)); // 10k - fee

      await vaultV2.connect(operator).setWeekendFlag(false); // weekday
      expect(await vaultV2.isWeekend()).to.equal(false);
      await vaultV2.connect(operator).updateEpoch(false); // update epoch
      expect(await vaultV2.currWeekendDeposit()).to.equal("0"); // reset weekend deposit amount

      await vaultV2.connect(operator).setWeekendFlag(true); // weekend
      await vaultV2.connect(investor1).deposit(_10k, investor1.address); // deposit 10k in weekend
      expect(await vaultV2.currWeekendDeposit()).to.equal(_10k.sub(fee));
    });
  });

  describe("separate pauseable deposit/withdraw", () => {
    it("pause deposit", async function () {
      await controller.pauseDeposit();
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.revertedWith("Pausable: deposit paused");
      await controller.unpauseDeposit();
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        _100k.sub(totalFee)
      );
    });

    it("pause deposit but withdraw", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        _100k.sub(totalFee)
      );
      await controller.pauseDeposit(); // pause deposit
      // can't deposit
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.revertedWith("Pausable: deposit paused");
      // withdraw success
      const usdcBalnaceBeforeWithdraw = await usdcTokenIns.balanceOf(
        investor1.address
      );
      await vaultV2.connect(investor1).redeem(_50k, investor1.address);
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBalnaceBeforeWithdraw
      );
    });

    it("pause withdraw but deposit", async function () {
      const usdcBalnaceBeforeDeposit = await usdcTokenIns.balanceOf(
        investor1.address
      );
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);

      await controller.pauseWithdraw(); // pause withdraw
      // withdraw fail
      await expect(
        vaultV2.connect(investor1).redeem(_50k, investor1.address)
      ).to.revertedWith("Pausable: withdraw paused");
      // deposit success
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBalnaceBeforeDeposit.sub(_200k)
      );
    });

    it("pause deposit, pause withdraw", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        _100k.sub(totalFee)
      );
      await controller.pauseDeposit(); // pause deposit
      // can't deposit
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.revertedWith("Pausable: deposit paused");
      // withdraw success
      await controller.pauseWithdraw(); // pause withdraw
      await expect(
        vaultV2.connect(investor1).redeem(_50k, investor1.address)
      ).to.revertedWith("Pausable: withdraw paused");
    });
  });

  //   test V2 token transfer
  describe("tbill transfer", () => {
    it("should succeed to transfer between kyc users", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await expect(
        vaultV2.connect(investor1).transfer(investor2.address, _10k)
      ).to.emit(vaultV2, "Transfer");
    });

    it("should fail to transfer to non kyc users", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await expect(
        vaultV2.connect(investor2).transfer(non_kyc.address, _10k)
      ).to.be.rejectedWith("invalid kyc");
    });

    it("should fail to transfer to banned kyc users", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      await kycManagerIns.bannedInBulk([investor2.address]);
      await expect(
        vaultV2.connect(investor1).transfer(investor2.address, _10k)
      ).to.be.rejectedWith("invalid kyc");
    });
  });

  describe("deposit/withdraw tbill/usdc 1:0.5", () => {
    beforeEach(async () => {
      await tbillOracle.updateMaxPriceDeviation(50000); //50%
      await tbillOracle.updatePrice(tbillOracleInitPrice.div(2));
      //await vaultV2.setMaxDepeg(6000000);
    });
    it("price update", async function () {
      expect(await tbillOracle.latestAnswer()).to.equal(
        tbillOracleInitPrice.div(2)
      );
    });
    it("deposit", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      let [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        _100k.sub(totalFee).mul(2)
      );

      [oeFee, pFee, totalFee] = await vaultV3.txsFee(
        DEPOSIT,
        investor1.address,
        _100k
      );
      expect(await vaultV2.totalAssets()).to.equal(_100k.sub(totalFee));
    });

    it("redeem", async function () {
      await vaultV2.connect(investor1).deposit(_100k, investor1.address);
      const tbillBalanceBeforeRedeem = await vaultV2.balanceOf(
        investor1.address
      );
      const usdcBalnaceBeforeRedeem = await usdcTokenIns.balanceOf(
        investor1.address
      );

      console.log(
        "tbillBalanceBeforeRedeem",
        tbillBalanceBeforeRedeem.toString()
      );
      console.log(
        "usdcBalnaceBeforeRedeem",
        usdcBalnaceBeforeRedeem.toString()
      );

      await vaultV2.connect(investor1).redeem(_10k, investor1.address);
      expect(await vaultV2.balanceOf(investor1.address)).to.equal(
        tbillBalanceBeforeRedeem.sub(_10k)
      );
      expect(await usdcTokenIns.balanceOf(investor1.address)).to.equal(
        usdcBalnaceBeforeRedeem
      );
    });
  });

  describe("Withdrawal Queue", () => {
    it("processWithdrawQueue ", async function () {
      expect(
        await vaultV2.connect(investor1).deposit(_300k, investor1.address)
      ).to.emit(vaultV2, "ProcessDeposit");
      expect(
        await vaultV2.connect(investor2).deposit(_300k, investor2.address)
      ).emit(vaultV2, "ProcessDeposit");

      await usdcTokenIns.transfer(vaultV2.address, _300k);
      await usdcTokenIns.transfer(vaultV2.address, _300k);

      let usdcBalance = await usdcTokenIns.balanceOf(vaultV2.address);
      console.log("vaultV2 usdc balance: ", usdcBalance.toString());

      await vaultV2.connect(investor1).redeem(_10k, investor1.address);
      await vaultV2.connect(investor1).redeem(_10k, investor2.address); //investor1 -> investor2
      await vaultV2.connect(investor2).redeem(_100k, investor2.address);
      await vaultV2.connect(investor2).redeem(_150k, investor2.address);

      let length = await vaultV2.getWithdrawalQueueLength();
      expect(length).to.equal(4);

      console.log("----- process withdrawal queue 1 -----");
      await vaultV2.connect(operator).processWithdrawalQueue(1);
      length = await vaultV2.getWithdrawalQueueLength();
      expect(length).to.equal(3);
      // await displayQueue(vaultV2);

      console.log("----- process withdrawal queue 0 (all length) -----");
      await vaultV2.connect(operator).processWithdrawalQueue(0);
      length = await vaultV2.getWithdrawalQueueLength();

      // insufficient balance, so the last redeem will be failed
      expect(length).to.equal(0);

      console.log("test cancellation");
      await vaultV2.connect(investor1).redeem(_10k, investor1.address);
      await vaultV2.connect(investor2).redeem(_10k, investor2.address);
      await expect(vaultV2.connect(operator).cancel(0)).to.be.revertedWith(
        "invalid len"
      );
      await expect(vaultV2.connect(operator).cancel(10)).to.be.revertedWith(
        "invalid len"
      );
      await expect(vaultV2.connect(investor2).cancel(1)).to.be.revertedWith(
        "permission denied"
      );

      // await displayQueue(vaultV2);

      await expect(vaultV2.connect(operator).cancel(2)).to.be.revertedWith(
        "user is not banned"
      );

      console.log("test cancel");
      await kycManagerIns.bannedInBulk([investor1.address]);
      await kycManagerIns.bannedInBulk([investor2.address]);
      await vaultV2.connect(operator).cancel(2); // have tested 0, 1
      // await displayQueue(vaultV2);
    });

    it("should gt 0", async function () {
      await vaultV2.getWithdrawalQueueInfo(1);
      await expect(
        vaultV2.connect(operator).processWithdrawalQueue(1)
      ).to.be.revertedWith("empty queue!");
      vaultV2.connect(investor1).deposit(_100k, investor1.address);
      vaultV2.connect(investor1).redeem(_10k, investor1.address);
      vaultV2.connect(investor1).redeem(_10k, investor1.address);
      vaultV2.connect(investor1).redeem(_10k, investor1.address);

      await vaultV2.getWithdrawalQueueInfo(0);
      await vaultV2.getWithdrawalQueueInfo(1);
      await vaultV2.getWithdrawalQueueInfo(5);

      await vaultV2.getWithdrawalUserInfo(investor1.address);
      await vaultV2.getWithdrawalUserInfo(investor1.address);
      await vaultV2.getWithdrawalTotalShares();

      await expect(
        vaultV2.connect(investor1).processWithdrawalQueue(1)
      ).to.be.revertedWith("permission denied");
      await expect(
        vaultV2.connect(operator).processWithdrawalQueue(5)
      ).to.be.revertedWith("invalid len!");
      await vaultV2.connect(operator).processWithdrawalQueue(1);

      tbillOracle = await deployContract<TBillPriceOracle>(
        "TBillPriceOracle",
        tbillOracleDecimal,
        tbillInitDeviation,
        "0", // price
        "0", // closing nav price
        operator.address,
        owner.address
      );
      await vaultV2.setUsdcPriceFeed(tbillOracle.address);
      await expect(
        vaultV2.connect(investor1).deposit(_100k, investor1.address)
      ).to.be.revertedWith("should gt 0");
      await expect(
        vaultV2.connect(investor1).redeem(_100k, investor1.address)
      ).to.be.revertedWith("should gt 0");

      await expect(
        vaultV2.connect(investor1).processWithdrawalQueue(1)
      ).to.be.revertedWith("should gt 0");
    });
  });
});
