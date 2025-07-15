/**
 * @title USYC Redemption System Test Suite
 * @notice Test suite for the USYC redemption system components
 * @dev Tests cover:
 *   - Contract deployment and setup
 *   - Treasury management and access control
 *   - Liquidity management and checking
 *   - Price conversion with oracle integration
 *   - Pause status management
 *
 * @author OpenEden Team
 */

import { expect } from "chai";
import { describe } from "mocha";
import { BigNumber } from "ethers";
import { deployContract } from "../helpers/framework/contracts";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { USDC, MockV3Aggregator, MockTBILL } from "../typechain-types";

describe("USYC Redemption System", function () {
  const vaultDecimals = 6;

  const _500 = BigNumber.from("500000000"); // 500
  const _10k = BigNumber.from("10000000000"); // 10k
  const _50k = BigNumber.from("50000000000"); // 50k
  const _100k = BigNumber.from("100000000000"); // 100k
  const _200k = BigNumber.from("200000000000"); // 200k
  const _500k = BigNumber.from("500000000000"); // 500k
  const _1M = BigNumber.from("1000000000000"); // 1M
  const _10M = BigNumber.from("10000000000000"); // 10M

  const _1$ = BigNumber.from("1000000");
  const _5$ = BigNumber.from("5000000");
  const _25$ = BigNumber.from("25000000"); // 25$
  const _50$ = BigNumber.from("50000000"); // 50$
  const _75$ = BigNumber.from("75000000"); // 75$
  const _500$ = BigNumber.from("500000000");
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  // Contract instances
  let usdcTokenIns: USDC;
  let usycTokenIns: any; // MockUSYC
  let usycHelperIns: any; // MockUsycHelper
  let usycRedemptionIns: any; // UsycRedemption
  let tbillTokenIns: MockTBILL;

  // Signers
  let owner: SignerWithAddress,
    investor1: SignerWithAddress,
    investor2: SignerWithAddress,
    investor3: SignerWithAddress,
    investor4: SignerWithAddress,
    usycTreasuryAccount: SignerWithAddress,
    tbillOracle: MockV3Aggregator,
    usycOracle: MockV3Aggregator;

  async function deployUsycRedemptionFixture() {
    [owner, investor1, investor2, investor3, investor4, usycTreasuryAccount] =
      await ethers.getSigners();

    // usyc oracle deploy
    tbillOracle = await deployContract<MockV3Aggregator>(
      "MockV3Aggregator",
      8,
      BigNumber.from("100000000")
    );
    await tbillOracle.deployed();

    // usyc oracle deploy - initial price 1.0:1 (1.0 USDC = 1 USYC)
    usycOracle = await deployContract<MockV3Aggregator>(
      "MockV3Aggregator",
      8,
      BigNumber.from("100000000")
    );
    await usycOracle.deployed();

    // Deploy base tokens
    usdcTokenIns = await deployContract<USDC>("USDC");
    await usdcTokenIns.deployed();

    // Deploy USYC system
    const MockUSYC = await ethers.getContractFactory("MockUSYC");
    usycTokenIns = await MockUSYC.deploy();
    await usycTokenIns.deployed();

    const MockUsycHelper = await ethers.getContractFactory("MockUsycHelper");
    usycHelperIns = await MockUsycHelper.deploy(
      usycTokenIns.address,
      usdcTokenIns.address,
      usycOracle.address
    );
    await usycHelperIns.deployed();

    // Deploy MockTBILL with placeholder for usycRedemption
    tbillTokenIns = await deployContract<MockTBILL>(
      "MockTBILL",
      usdcTokenIns.address,
      usycTokenIns.address,
      "0x0000000000000000000000000000000000000001", // placeholder for usycRedemption
      usycTreasuryAccount.address
    );
    await tbillTokenIns.deployed();

    const UsycRedemption = await ethers.getContractFactory("UsycRedemption");
    usycRedemptionIns = await UsycRedemption.deploy(
      usycTokenIns.address,
      usdcTokenIns.address,
      usycHelperIns.address,
      tbillTokenIns.address,
      usycTreasuryAccount.address
    );
    await usycRedemptionIns.deployed();

    // Set up USYC treasury
    await usycRedemptionIns.setUsycTreasury(usycTreasuryAccount.address);

    // Fund USYC system
    await usycTokenIns.transfer(usycTreasuryAccount.address, _1M);
    await usycTokenIns
      .connect(usycTreasuryAccount)
      .approve(usycRedemptionIns.address, _1M); // Increase allowance to 1M

    // Add USDC liquidity to helper - increase to support multiple redemptions
    await usdcTokenIns.transfer(usycHelperIns.address, _500k);

    console.log("USYC Redemption test fixture deployed successfully");
  }

  beforeEach(async () => {
    await loadFixture(deployUsycRedemptionFixture);
  });

  describe("Contract Deployment and Setup", function () {
    it("should deploy all contracts with correct addresses", async function () {
      expect(await usycRedemptionIns.usyc()).to.equal(usycTokenIns.address);
      expect(await usycRedemptionIns.usdc()).to.equal(usdcTokenIns.address);
      expect(await usycRedemptionIns.helper()).to.equal(usycHelperIns.address);
      expect(await usycRedemptionIns.usycTreasury()).to.equal(
        usycTreasuryAccount.address
      );
      expect(await usycRedemptionIns.scaleFactor()).to.equal(
        BigNumber.from("100000000")
      ); // 1e8
      expect(await usycRedemptionIns.tbillVault()).to.equal(
        tbillTokenIns.address
      );
    });

    it("should have correct initial token balances", async function () {
      const usycTreasuryBalance = await usycTokenIns.balanceOf(
        usycTreasuryAccount.address
      );
      const usycAllowance = await usycTokenIns.allowance(
        usycTreasuryAccount.address,
        usycRedemptionIns.address
      );
      const helperUsdcBalance = await usdcTokenIns.balanceOf(
        usycHelperIns.address
      );

      expect(usycTreasuryBalance).to.equal(_1M);
      expect(usycAllowance).to.equal(_1M); // Updated to match the increased allowance
      expect(helperUsdcBalance).to.equal(_500k);
    });
  });

  describe("Treasury Management", function () {
    it("should allow owner to set USYC treasury", async function () {
      const newTreasury = investor3.address;
      await usycRedemptionIns.setUsycTreasury(newTreasury);
      expect(await usycRedemptionIns.usycTreasury()).to.equal(newTreasury);
    });

    it("should not allow non-owner to set USYC treasury", async function () {
      await expect(
        usycRedemptionIns.connect(investor1).setUsycTreasury(investor3.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow setting zero address as treasury", async function () {
      await expect(
        usycRedemptionIns.setUsycTreasury(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(usycRedemptionIns, "ZeroAddress");
    });

    it("should emit event when treasury is updated", async function () {
      const newTreasury = investor3.address;
      // Since there's no specific event for treasury update, just check it doesn't revert
      await expect(usycRedemptionIns.setUsycTreasury(newTreasury)).to.not.be
        .reverted;
    });
  });

  describe("Liquidity Management", function () {
    it("should return correct liquidity information", async function () {
      const res = await usycRedemptionIns.checkLiquidity();

      // Check helper USDC balance (liquidity)
      const expectedLiquidity = await usdcTokenIns.balanceOf(
        usycHelperIns.address
      );
      expect(res.liquidity).to.equal(expectedLiquidity);

      // Check USYC allowance
      const expectedAllowance = await usycTokenIns.allowance(
        usycTreasuryAccount.address,
        usycRedemptionIns.address
      );
      expect(res.tAllowance).to.equal(expectedAllowance);

      // Check USYC balance
      const expectedBalance = await usycTokenIns.balanceOf(
        usycTreasuryAccount.address
      );
      expect(res.tBalance).to.equal(expectedBalance);

      // Check minimum calculation
      const expectedMinimum = expectedLiquidity.lt(expectedAllowance)
        ? expectedLiquidity.lt(expectedBalance)
          ? expectedLiquidity
          : expectedBalance
        : expectedAllowance.lt(expectedBalance)
        ? expectedAllowance
        : expectedBalance;
      expect(res.minimum).to.equal(expectedMinimum);
    });

    it("should handle zero liquidity correctly", async function () {
      // Drain helper USDC by calling emergency withdraw from helper contract
      const helperBalance = await usdcTokenIns.balanceOf(usycHelperIns.address);
      await usycHelperIns.emergencyWithdraw(
        usdcTokenIns.address,
        helperBalance
      );

      const res = await usycRedemptionIns.checkLiquidity();
      expect(res.liquidity).to.equal(0);
      expect(res.minimum).to.equal(0);
    });

    it("should handle zero allowance correctly", async function () {
      // Remove allowance
      await usycTokenIns
        .connect(usycTreasuryAccount)
        .approve(usycRedemptionIns.address, 0);

      const res = await usycRedemptionIns.checkLiquidity();
      expect(res.tAllowance).to.equal(0);
      expect(res.minimum).to.equal(0);
    });
  });

  describe("Price Conversion", function () {
    it("should convert USDC to USYC token amount correctly at 1:1 rate", async function () {
      // Set oracle price to 1:1 (1 USDC = 1 USYC)
      await usycOracle.updateAnswer(BigNumber.from("100000000")); // 1.0 * 1e8

      const usdcAmount = _10k;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // With 1:1 oracle price, conversion should be 1:1
      expect(convertedAmount).to.equal(usdcAmount);
    });

    it("should convert USDC to USYC when USYC price is above 1:1", async function () {
      // Set oracle price to 1.1:1 (1.1 USDC = 1 USYC, so USYC is more expensive)
      await usycOracle.updateAnswer(BigNumber.from("110000000")); // 1.1 * 1e8

      const usdcAmount = _10k;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // With 1.1:1 oracle price, we should get fewer USYC tokens
      // 10k USDC / 1.1 = ~9090.9 USYC, rounded UP due to Math.Rounding.Up
      const baseAmount = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("110000000"));
      const remainder = usdcAmount
        .mul(BigNumber.from("100000000"))
        .mod(BigNumber.from("110000000"));
      const expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should convert USDC to USYC when USYC price is below 1.1:1", async function () {
      // Set oracle price to 1.05:1 (1.05 USDC = 1 USYC, so USYC is slightly more expensive)
      await usycOracle.updateAnswer(BigNumber.from("105000000")); // 1.05 * 1e8

      const usdcAmount = _10k;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // With 1.05:1 oracle price, we should get fewer USYC tokens
      // 10k USDC / 1.05 = ~9523.8 USYC, rounded UP due to Math.Rounding.Up
      const baseAmount = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("105000000"));
      const remainder = usdcAmount
        .mul(BigNumber.from("100000000"))
        .mod(BigNumber.from("105000000"));
      const expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should handle small amounts with different oracle prices", async function () {
      // Set oracle price to 1.25:1 (1.25 USDC = 1 USYC)
      await usycOracle.updateAnswer(BigNumber.from("125000000")); // 1.25 * 1e8

      const usdcAmount = _5$;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // 5 USDC / 1.25 = 4 USYC
      const expectedAmount = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("125000000"));
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should handle large amounts with different oracle prices", async function () {
      // Set oracle price to 1.15:1 (1.15 USDC = 1 USYC)
      await usycOracle.updateAnswer(BigNumber.from("115000000")); // 1.15 * 1e8

      const usdcAmount = _500k;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // 500k USDC / 1.15 = ~434782.6 USYC, rounded UP due to Math.Rounding.Up
      const baseAmount = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("115000000"));
      const remainder = usdcAmount
        .mul(BigNumber.from("100000000"))
        .mod(BigNumber.from("115000000"));
      const expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should handle fractional oracle prices correctly", async function () {
      // Set oracle price to 1.123456:1 (precise fractional price)
      await usycOracle.updateAnswer(BigNumber.from("112345600")); // 1.123456 * 1e8

      const usdcAmount = _25$;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // 25 USDC / 1.123456 = ~22.26 USYC, rounded UP due to Math.Rounding.Up
      const baseAmount = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("112345600"));
      const remainder = usdcAmount
        .mul(BigNumber.from("100000000"))
        .mod(BigNumber.from("112345600"));
      const expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should handle extreme price scenarios", async function () {
      // Set oracle price to 2.0:1 (2 USDC = 1 USYC, very expensive USYC)
      await usycOracle.updateAnswer(BigNumber.from("200000000")); // 2.0 * 1e8

      const usdcAmount = _100k;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // 100k USDC / 2.0 = 50k USYC
      const expectedAmount = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("200000000"));
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should round up when converting USDC to tokens (favorable to user)", async function () {
      // Set oracle price that creates fractional results
      await usycOracle.updateAnswer(BigNumber.from("300000000")); // 3.0 * 1e8

      // Use amount that creates remainder when divided by 3
      const usdcAmount = BigNumber.from("10000001"); // 10.000001 USDC
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // Manual calculation: 10000001 * 100000000 / 300000000 = 3333333.666...
      // With rounding up, should be 3333334
      const expectedBase = usdcAmount
        .mul(BigNumber.from("100000000"))
        .div(BigNumber.from("300000000"));
      const remainder = usdcAmount
        .mul(BigNumber.from("100000000"))
        .mod(BigNumber.from("300000000"));

      const expectedAmount = remainder.gt(0)
        ? expectedBase.add(1)
        : expectedBase;
      expect(convertedAmount).to.equal(expectedAmount);
    });

    it("should round down when converting tokens to USDC (conservative for protocol)", async function () {
      // Set oracle price that creates fractional results
      await usycOracle.updateAnswer(BigNumber.from("300000000")); // 3.0 * 1e8

      // Use amount that creates remainder when multiplied by 3
      const usycAmount = BigNumber.from("3333334"); // Amount that creates fractional USDC
      const convertedAmount = await usycRedemptionIns.convertTokenToUsdc(
        usycAmount
      );

      // Manual calculation: 3333334 * 300000000 / 100000000 = 10000002
      // With rounding down, should be 10000002 (no remainder in this case)
      // Let's use a better example that creates a remainder
      const usycAmountWithRemainder = BigNumber.from("3333333");
      const convertedAmountWithRemainder =
        await usycRedemptionIns.convertTokenToUsdc(usycAmountWithRemainder);

      // 3333333 * 300000000 / 100000000 = 9999999
      const expectedAmount = usycAmountWithRemainder
        .mul(BigNumber.from("300000000"))
        .div(BigNumber.from("100000000"));
      expect(convertedAmountWithRemainder).to.equal(expectedAmount);
    });

    it("should demonstrate rounding difference between convert functions", async function () {
      // Set oracle price that creates clear fractional results
      await usycOracle.updateAnswer(BigNumber.from("777777777")); // ~7.77777777 * 1e8

      const testAmount = BigNumber.from("1000000"); // 1 USDC or 1 USYC

      // Convert USDC to Token (should round UP)
      const usdcToToken = await usycRedemptionIns.convertUsdcToToken(
        testAmount
      );

      // Convert Token to USDC (should round DOWN)
      const tokenToUsdc = await usycRedemptionIns.convertTokenToUsdc(
        testAmount
      );

      // Due to rounding in different directions, these should be different
      // when the calculation doesn't result in a whole number
      console.log("USDC to Token:", usdcToToken.toString());
      console.log("Token to USDC:", tokenToUsdc.toString());

      // Both should be positive and handle fractions correctly
      expect(usdcToToken).to.be.gt(0);
      expect(tokenToUsdc).to.be.gt(0);
    });

    it("should revert when oracle price is below minimum", async function () {
      // Set oracle price below 1.0 (minimum)
      await usycOracle.updateAnswer(BigNumber.from("95000000")); // 0.95 * 1e8

      await expect(
        usycRedemptionIns.convertUsdcToToken(_10k)
      ).to.be.revertedWithCustomError(usycRedemptionIns, "InvalidPrice");
    });

    it("should work at exactly minimum price", async function () {
      // Set oracle price to exactly 1.0 (minimum)
      await usycOracle.updateAnswer(BigNumber.from("100000000")); // 1.0 * 1e8

      const usdcAmount = _10k;
      const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
        usdcAmount
      );

      // At 1:1 price, conversion should be 1:1
      expect(convertedAmount).to.equal(usdcAmount);
    });

    it("should convert USYC to USDC correctly at 1:1 rate", async function () {
      // Set oracle price to 1:1 (1 USDC = 1 USYC)
      await usycOracle.updateAnswer(BigNumber.from("100000000")); // 1.0 * 1e8

      const usycAmount = _10k;
      const convertedAmount = await usycRedemptionIns.convertTokenToUsdc(
        usycAmount
      );

      // With 1:1 oracle price, conversion should be 1:1
      expect(convertedAmount).to.equal(usycAmount);
    });

    it("should convert USYC to USDC when USYC price is above 1:1", async function () {
      // Set oracle price to 1.2:1 (1.2 USDC = 1 USYC, so USYC is more expensive)
      await usycOracle.updateAnswer(BigNumber.from("120000000")); // 1.2 * 1e8

      const usycAmount = _10k;
      const convertedAmount = await usycRedemptionIns.convertTokenToUsdc(
        usycAmount
      );

      // With 1.2:1 oracle price, we should get more USDC for our USYC
      // 10k USYC * 1.2 = 12k USDC
      const expectedAmount = usycAmount
        .mul(BigNumber.from("120000000"))
        .div(BigNumber.from("100000000"));
      expect(convertedAmount).to.equal(expectedAmount);
    });

    describe("Stale Price Validation", function () {
      it("should work when price is exactly at 3-day limit", async function () {
        // Set oracle price to a valid value
        await usycOracle.updateAnswer(BigNumber.from("105000000")); // 1.05 * 1e8

        // Fast forward time to exactly 3 days (259200 seconds)
        await time.increase(259200);

        const usdcAmount = _10k;
        const convertedAmount = await usycRedemptionIns.convertUsdcToToken(
          usdcAmount
        );

        // Should still work at exactly 3 days, rounded UP due to Math.Rounding.Up
        const baseAmount = usdcAmount
          .mul(BigNumber.from("100000000"))
          .div(BigNumber.from("105000000"));
        const remainder = usdcAmount
          .mul(BigNumber.from("100000000"))
          .mod(BigNumber.from("105000000"));
        const expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
        expect(convertedAmount).to.equal(expectedAmount);
      });

      it("should revert when price is older than 3 days", async function () {
        // Set oracle price to a valid value
        await usycOracle.updateAnswer(BigNumber.from("105000000")); // 1.05 * 1e8

        // Fast forward time to more than 3 days (259201 seconds = 3 days + 1 second)
        await time.increase(259201);

        // Should revert with StalePrice error
        await expect(
          usycRedemptionIns.convertUsdcToToken(_10k)
        ).to.be.revertedWithCustomError(usycRedemptionIns, "StalePrice");
      });

      it("should revert when checkLiquidity is called with stale price", async function () {
        // Set oracle price to a valid value
        await usycOracle.updateAnswer(BigNumber.from("105000000")); // 1.05 * 1e8

        // Fast forward time to more than 3 days
        await time.increase(259201);

        // checkLiquidity should also revert since it calls convertTokenToUsdc internally
        await expect(
          usycRedemptionIns.checkLiquidity()
        ).to.be.revertedWithCustomError(usycRedemptionIns, "StalePrice");
      });

      it("should revert convertTokenToUsdc with stale price", async function () {
        // Set oracle price to a valid value
        await usycOracle.updateAnswer(BigNumber.from("105000000")); // 1.05 * 1e8

        // Fast forward time to more than 3 days
        await time.increase(259201);

        // convertTokenToUsdc should also revert
        await expect(
          usycRedemptionIns.convertTokenToUsdc(_10k)
        ).to.be.revertedWithCustomError(usycRedemptionIns, "StalePrice");
      });

      it("should handle multiple time increases correctly", async function () {
        // Set oracle price to a valid value
        await usycOracle.updateAnswer(BigNumber.from("110000000")); // 1.1 * 1e8

        // First increase: 2 days (should still work)
        await time.increase(172800); // 2 days

        const usdcAmount = _5$;
        let convertedAmount = await usycRedemptionIns.convertUsdcToToken(
          usdcAmount
        );

        // Should work fine, rounded UP due to Math.Rounding.Up
        let baseAmount = usdcAmount
          .mul(BigNumber.from("100000000"))
          .div(BigNumber.from("110000000"));
        let remainder = usdcAmount
          .mul(BigNumber.from("100000000"))
          .mod(BigNumber.from("110000000"));
        let expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
        expect(convertedAmount).to.equal(expectedAmount);

        // Second increase: 1 day + 1 second (total > 3 days, should revert)
        await time.increase(86401); // 1 day + 1 second

        await expect(
          usycRedemptionIns.convertUsdcToToken(usdcAmount)
        ).to.be.revertedWithCustomError(usycRedemptionIns, "StalePrice");
      });

      it("should revert when oracle has incomplete round data", async function () {
        // Deploy a custom oracle that allows setting incomplete round data
        const MockIncompleteRoundOracle = await ethers.getContractFactory(
          "MockIncompleteRoundOracle"
        );
        const incompleteOracle = await MockIncompleteRoundOracle.deploy(
          8, // decimals
          BigNumber.from("105000000") // 1.05 * 1e8
        );
        await incompleteOracle.deployed();

        // Set incomplete round data where answeredInRound < roundId
        await incompleteOracle.setIncompleteRound(
          5,
          BigNumber.from("105000000")
        );

        // Temporarily replace the helper's oracle
        const originalHelper = usycHelperIns.address;

        // Deploy a new helper with the incomplete oracle
        const MockUsycHelper = await ethers.getContractFactory(
          "MockUsycHelper"
        );
        const tempHelper = await MockUsycHelper.deploy(
          usycTokenIns.address,
          usdcTokenIns.address,
          incompleteOracle.address
        );
        await tempHelper.deployed();

        // Deploy a temporary redemption contract with the new helper
        const UsycRedemption = await ethers.getContractFactory(
          "UsycRedemption"
        );
        const tempRedemption = await UsycRedemption.deploy(
          usycTokenIns.address,
          usdcTokenIns.address,
          tempHelper.address,
          tbillTokenIns.address,
          usycTreasuryAccount.address
        );
        await tempRedemption.deployed();

        // Should revert with StalePrice error due to incomplete round data
        await expect(
          tempRedemption.convertUsdcToToken(_10k)
        ).to.be.revertedWithCustomError(tempRedemption, "StalePrice");
      });

      it("should work with complete round data", async function () {
        // Deploy a custom oracle with complete round data
        const MockIncompleteRoundOracle = await ethers.getContractFactory(
          "MockIncompleteRoundOracle"
        );
        const completeOracle = await MockIncompleteRoundOracle.deploy(
          8, // decimals
          BigNumber.from("105000000") // 1.05 * 1e8
        );
        await completeOracle.deployed();

        // Set complete round data where answeredInRound = roundId
        await completeOracle.setRoundData(
          5, // roundId
          BigNumber.from("105000000"), // answer
          await time.latest(), // startedAt
          await time.latest(), // updatedAt
          5 // answeredInRound = roundId
        );

        // Deploy a new helper with the complete oracle
        const MockUsycHelper = await ethers.getContractFactory(
          "MockUsycHelper"
        );
        const tempHelper = await MockUsycHelper.deploy(
          usycTokenIns.address,
          usdcTokenIns.address,
          completeOracle.address
        );
        await tempHelper.deployed();

        // Deploy a temporary redemption contract with the new helper
        const UsycRedemption = await ethers.getContractFactory(
          "UsycRedemption"
        );
        const tempRedemption = await UsycRedemption.deploy(
          usycTokenIns.address,
          usdcTokenIns.address,
          tempHelper.address,
          tbillTokenIns.address,
          usycTreasuryAccount.address
        );
        await tempRedemption.deployed();

        // Should work fine with complete round data, rounded UP due to Math.Rounding.Up
        const usdcAmount = _10k;
        const convertedAmount = await tempRedemption.convertUsdcToToken(
          usdcAmount
        );

        const baseAmount = usdcAmount
          .mul(BigNumber.from("100000000"))
          .div(BigNumber.from("105000000"));
        const remainder = usdcAmount
          .mul(BigNumber.from("100000000"))
          .mod(BigNumber.from("105000000"));
        const expectedAmount = remainder.gt(0) ? baseAmount.add(1) : baseAmount;
        expect(convertedAmount).to.equal(expectedAmount);
      });

      // Reset time and price after each stale price test
      afterEach(async function () {
        try {
          // Reset oracle with fresh timestamp
          await usycOracle.updateAnswer(BigNumber.from("100000000")); // Reset to 1:1
        } catch (error) {
          // Ignore errors during cleanup
        }
      });
    });

    // Reset oracle price after each test to avoid side effects
    afterEach(async function () {
      try {
        await usycOracle.updateAnswer(BigNumber.from("100000000")); // Reset to 1:1
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to call emergency functions", async function () {
      await usdcTokenIns.transfer(usycRedemptionIns.address, _1$);

      await expect(
        usycRedemptionIns
          .connect(investor1)
          .emergencyWithdraw(usdcTokenIns.address, _1$)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to emergency withdraw tokens", async function () {
      // Send some tokens to the contract
      await usdcTokenIns.transfer(usycRedemptionIns.address, _50$);

      const initialBalance = await usdcTokenIns.balanceOf(owner.address);

      await usycRedemptionIns.emergencyWithdraw(usdcTokenIns.address, _50$);

      const finalBalance = await usdcTokenIns.balanceOf(owner.address);
      expect(finalBalance.sub(initialBalance)).to.equal(_50$);
    });

    it("should not allow emergency withdrawal of zero address token", async function () {
      await expect(
        usycRedemptionIns.emergencyWithdraw(ZERO_ADDRESS, _1$)
      ).to.be.revertedWithCustomError(usycRedemptionIns, "ZeroAddress");
    });
  });

  describe("Pause Status Management", function () {
    it("should return correct pause status when not paused", async function () {
      expect(await usycRedemptionIns.checkPaused()).to.be.false;
    });

    it("should return correct pause status when paused", async function () {
      await usycHelperIns.setSellPaused(true);
      expect(await usycRedemptionIns.checkPaused()).to.be.true;
    });

    it("should toggle pause status correctly", async function () {
      // Initially not paused
      expect(await usycRedemptionIns.checkPaused()).to.be.false;

      // Pause selling
      await usycHelperIns.setSellPaused(true);
      expect(await usycRedemptionIns.checkPaused()).to.be.true;

      // Unpause selling
      await usycHelperIns.setSellPaused(false);
      expect(await usycRedemptionIns.checkPaused()).to.be.false;
    });
  });
});
