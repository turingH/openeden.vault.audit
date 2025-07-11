import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Bytes } from "ethers";
const ACTION_TYPE = {
  DEPOSIT: 0,
  REDEEM: 1,
};

describe("FeeManager", function () {
  let FeeManager, feeManager, owner, addr1, addr2;

  const _10k = BigNumber.from("10000000000"); // 10k
  const _50k = BigNumber.from("50000000000"); // 50k
  const _1M = BigNumber.from("1000000000000"); // 1M
  const _100k = BigNumber.from("100000000000"); // 100k
  const _200k = BigNumber.from("200000000000"); // 200k
  const _300k = BigNumber.from("300000000000"); // 300k
  const _10M = BigNumber.from("10000000000000"); // 1M

  const _5$ = BigNumber.from("5000000");
  const _1$ = BigNumber.from("1000000");
  const _25$ = BigNumber.from("25000000"); // 25$
  const _75$ = BigNumber.from("75000000"); // 75$
  const _50$ = BigNumber.from("50000000"); // 50$
  const _500$ = BigNumber.from("500000000");

  const txFeeWorkdayDepositPct = 5; // 5bps
  const txFeeWorkdayWithdrawPct = 10; // 10bps
  const txFeeHolidayDepositPct = 12; // 12bps
  const txFeeHolidayWithdrawPct = 15; // 15bps
  const maxHolidayDepositPct = 500; // 5% tvl
  const maxHolidayAggDepositPct = 1000; // 10% tvl
  const managementFeeRate = 40; // 40bps

  beforeEach(async function () {
    FeeManager = await ethers.getContractFactory("FeeManager");
    [owner, addr1, addr2] = await ethers.getSigners();

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
      minWithdraw: _500$, // min withdraw once
      maxWithdraw: _1M, // max withdraw on a day
      // managementFeeRate: managementFeeRate,
    };

    feeManager = await FeeManager.deploy(
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
    await feeManager.deployed();
    await feeManager.connect(owner).setManagementFeeRate(managementFeeRate);
  });
  // ===
  describe("Getter", function () {
    it("should return the correct values for getTxFeeWeekday", async function () {
      const result = await feeManager.getTxFeePct(ACTION_TYPE.DEPOSIT, false);
      expect(result).to.equal(txFeeWorkdayDepositPct);
    });

    it("should return the correct values for getTxFeeWeekend", async function () {
      const result = await feeManager.getTxFeePct(ACTION_TYPE.DEPOSIT, true);
      expect(result).to.equal(txFeeHolidayDepositPct);
    });

    it("should return the correct values for getTxFeeWeekday", async function () {
      const result = await feeManager.getTxFeePct(ACTION_TYPE.DEPOSIT, true);
      expect(result).to.equal(txFeeHolidayDepositPct);
    });

    it("should return the correct values for getTxFeeWeekend", async function () {
      const result = await feeManager.getTxFeePct(ACTION_TYPE.REDEEM, true);
      expect(result).to.equal(txFeeHolidayWithdrawPct);
    });

    it("should return the correct values for getMinMaxDeposit", async function () {
      const [min, max] = await feeManager.getMinMaxDeposit();
      expect(min).to.equal(_10k);
      expect(max).to.equal(_1M);
    });

    it("should return the correct values for getMinMaxWithdraw", async function () {
      const [min, max] = await feeManager.getMinMaxWithdraw();
      expect(min).to.equal(_500$);
      expect(max).to.equal(_1M);
    });

    it("should return the correct value for getManagementFeeRate", async function () {
      const result = await feeManager.getManagementFeeRate();
      expect(result).to.equal(managementFeeRate);
    });

    it("should return the correct value for getFirstDeposit", async function () {
      const result = await feeManager.getFirstDeposit();
      expect(result).to.equal(_100k);
    });

    it("should return the correct values for getMaxWeekendDepositPct", async function () {
      const [maxPct, maxAggregatedPct] =
        await feeManager.getMaxHolidayDepositPct();
      expect(maxPct).to.equal(maxHolidayDepositPct);
      expect(maxAggregatedPct).to.equal(maxHolidayAggDepositPct);
    });

    it("should return the correct value for getMinTxsFee", async function () {
      const result = await feeManager.getMinTxsFee();
      expect(result).to.equal(_25$);
    });
  });

  describe("Setter", function () {
    it("should set depsoit transaction fee for weekdays", async function () {
      const newFee = 7; // 7bps
      await feeManager.connect(owner).setTxFeeWorkdayDepositPct(newFee);
      const result = await feeManager.getTxFeePct(ACTION_TYPE.DEPOSIT, false);
      expect(result).to.equal(newFee);
    });

    it("should set redeem transaction fee for weekdays", async function () {
      const newFee = 8;
      await feeManager.connect(owner).setTxFeeWorkdayWithdrawPct(newFee);
      const result = await feeManager.getTxFeePct(ACTION_TYPE.REDEEM, false);
      expect(result).to.equal(newFee);
    });

    it("should set depsoit transaction fee for holiday", async function () {
      const newFee = 10;
      await feeManager.connect(owner).setTxFeeHolidayDepositPct(newFee);
      const result = await feeManager.getTxFeePct(ACTION_TYPE.DEPOSIT, true);
      expect(result).to.equal(newFee);
    });

    it("should set redeem transaction fee for holiday", async function () {
      const newFee = 11;
      await feeManager.connect(owner).setTxFeeHolidayWithdrawPct(newFee);
      const result = await feeManager.getTxFeePct(ACTION_TYPE.REDEEM, true);
      expect(result).to.equal(newFee);
    });

    it("should set first deposit value", async function () {
      const newFirstDeposit = _200k;
      await feeManager.connect(owner).setFirstDeposit(newFirstDeposit);
      const result = await feeManager.getFirstDeposit();
      expect(result).to.equal(newFirstDeposit);
    });

    it("should set management fee rate", async function () {
      const newFeeRate = 50; // 50bps
      await feeManager.connect(owner).setManagementFeeRate(newFeeRate);
      const result = await feeManager.getManagementFeeRate();
      expect(result).to.equal(newFeeRate);
    });

    it("should set max holiday aggregated deposit percentage", async function () {
      const newAggPercentage = 1200; // 12%
      const newPercentage = 600; // 6%

      await feeManager
        .connect(owner)
        .setMaxHolidayAggDepositPct(newAggPercentage);
      await feeManager.connect(owner).setMaxHolidayDepositPct(newPercentage);

      const result = await feeManager.getMaxHolidayDepositPct();
      expect(result[0]).to.equal(newPercentage);
      expect(result[1]).to.equal(newAggPercentage);
    });

    it("should set minimum transaction fee", async function () {
      const newFee = _50$;
      await feeManager.connect(owner).setMinTxsFee(newFee);
      const result = await feeManager.getMinTxsFee();
      expect(result).to.equal(newFee);
    });

    it("should set minimum deposit value", async function () {
      const newMinDeposit = _200k;
      await feeManager.connect(owner).setMinDeposit(newMinDeposit);
      const result = await feeManager.getMinMaxDeposit();
      expect(result[0]).to.equal(newMinDeposit);
    });

    it("should set maximum deposit value", async function () {
      const newMaxDeposit = _10M;
      await feeManager.connect(owner).setMaxDeposit(newMaxDeposit);
      const result = await feeManager.getMinMaxDeposit();
      expect(result[1]).to.equal(newMaxDeposit);
    });

    it("should set minimum withdraw value", async function () {
      const newMinWithdraw = _1$;
      await feeManager.connect(owner).setMinWithdraw(newMinWithdraw);
      const result = await feeManager.getMinMaxWithdraw();
      expect(result[0]).to.equal(newMinWithdraw);
    });

    it("should set maximum withdraw value", async function () {
      const newMaxWithdraw = _10M;
      await feeManager.connect(owner).setMaxWithdraw(newMaxWithdraw);
      const result = await feeManager.getMinMaxWithdraw();
      expect(result[1]).to.equal(newMaxWithdraw);
    });
  });

  describe("Setting (Abnormal Cases)", function () {
    it("should revert when non-owner tries to set transaction fee for weekdays", async function () {
      const newFee = 7; // 7bps
      await expect(
        feeManager.connect(addr1).setTxFeeWorkdayDepositPct(newFee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set transaction fee for weekends", async function () {
      const newFee = 12; // 12bps
      await expect(
        feeManager.connect(addr1).setTxFeeHolidayDepositPct(newFee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set redeem transaction fee for weekdays", async function () {
      const newFee = 7; // 7bps
      await expect(
        feeManager.connect(addr1).setTxFeeWorkdayWithdrawPct(newFee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set redeem transaction fee for weekends", async function () {
      const newFee = 12; // 12bps
      await expect(
        feeManager.connect(addr1).setTxFeeHolidayWithdrawPct(newFee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set first deposit value", async function () {
      const newFirstDeposit = _200k;
      await expect(
        feeManager.connect(addr1).setFirstDeposit(newFirstDeposit)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set management fee rate", async function () {
      const newFeeRate = 50; // 50bps
      await expect(
        feeManager.connect(addr1).setManagementFeeRate(newFeeRate)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set max weekend aggregated deposit percentage", async function () {
      const newPercentage = 1200; // 12%
      await expect(
        feeManager.connect(addr1).setMaxHolidayAggDepositPct(newPercentage)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set max weekend deposit percentage", async function () {
      const newPercentage = 600; // 6%
      await expect(
        feeManager.connect(addr1).setMaxHolidayDepositPct(newPercentage)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set minimum transaction fee", async function () {
      const newFee = _50$;
      await expect(
        feeManager.connect(addr1).setMinTxsFee(newFee)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set minimum deposit value", async function () {
      const newMinDeposit = _200k;
      await expect(
        feeManager.connect(addr1).setMinDeposit(newMinDeposit)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set maximum deposit value", async function () {
      const newMaxDeposit = _10M;
      await expect(
        feeManager.connect(addr1).setMaxDeposit(newMaxDeposit)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set minimum withdraw value", async function () {
      const newMinWithdraw = _1$;
      await expect(
        feeManager.connect(addr1).setMinWithdraw(newMinWithdraw)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to set maximum withdraw value", async function () {
      const newMaxWithdraw = _10M;
      await expect(
        feeManager.connect(addr1).setMaxWithdraw(newMaxWithdraw)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
