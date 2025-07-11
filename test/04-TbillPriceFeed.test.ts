import { expect } from "chai";
import { ethers } from "hardhat";

describe("TBillPriceOracle", function () {
  let TBillPriceOracle, tbillPriceOracle, owner, operator, addr1, addr2;
  const decimals = 8; // Set to 8
  const maxPriceDeviation = 15; // Set to 15 bps
  const initPrice = ethers.utils.parseUnits("1.001", 8); // Set to 1.001 in 8 decimals
  const closeNavPrice = ethers.utils.parseUnits("1.002", 8); // Set to 1.002 in 8 decimals

  beforeEach(async function () {
    TBillPriceOracle = await ethers.getContractFactory("TBillPriceOracle");
    [owner, operator, addr1, addr2] = await ethers.getSigners();
    tbillPriceOracle = await TBillPriceOracle.deploy(
      decimals,
      maxPriceDeviation,
      initPrice,
      closeNavPrice,
      operator.address,
      owner.address
    );
  });

  describe("Getters", function () {
    it("should return the correct decimals", async function () {
      const result = await tbillPriceOracle.decimals();
      expect(result).to.equal(8);
    });

    it("should return the initial latest round", async function () {
      const result = await tbillPriceOracle.latestRound();
      expect(result).to.equal(1);
    });

    it("should return the correct latest round data", async function () {
      const [roundId, answer, startedAt, updatedAt, answeredInRound] =
        await tbillPriceOracle.latestRoundData();
      expect(roundId).to.equal(1);
      expect(answer).to.equal(ethers.utils.parseUnits("1.001", 8));
      // Add more checks as per your requirements
    });

    it("should return the correct latest answer", async function () {
      const result = await tbillPriceOracle.latestAnswer();
      expect(result).to.equal(ethers.utils.parseUnits("1.001", 8));
    });

    it("should return the correct close nav price", async function () {
      const result = await tbillPriceOracle.closeNavPrice();
      expect(result).to.equal(ethers.utils.parseUnits("1.002", 8));
    });

    it("should return the correct max price deviation", async function () {
      const result = await tbillPriceOracle.maxPriceDeviation();
      expect(result).to.equal(15);
    });
  });

  describe("Update Max Price Deviation", function () {
    it("should update max price deviation", async function () {
      const newDeviation = 20; // Set to 20 bps
      await tbillPriceOracle.updateMaxPriceDeviation(newDeviation);
      const result = await tbillPriceOracle.maxPriceDeviation();
      expect(result).to.equal(20);
    });

    it("should revert when called by non-admin", async function () {
      await expect(
        tbillPriceOracle.connect(addr1).updateMaxPriceDeviation(20)
      ).to.be.revertedWith("Caller is not an admin");
    });
  });

  describe("Update Price", function () {
    it("should update price", async function () {
      const TBillPriceOracle2 = await ethers.getContractFactory(
        "TBillPriceOracle"
      );
      await expect(
        TBillPriceOracle2.deploy(
          decimals,
          maxPriceDeviation,
          initPrice,
          closeNavPrice,
          operator.address,
          "0x0000000000000000000000000000000000000000"
        )
      ).to.revertedWith("invalid admin address");
    });
    it("should update price", async function () {
      const newPrice = ethers.utils.parseUnits("1.002", 8); // Set to 1.002 in 8 decimals
      await tbillPriceOracle.updatePrice(newPrice);
      await tbillPriceOracle.connect(operator).updatePrice(newPrice);
      const result = await tbillPriceOracle.latestAnswer();
      expect(result).to.equal(newPrice);
    });

    it("should revert when price deviation is too much", async function () {
      const newPrice = ethers.utils.parseUnits("1.005", 8); // Set to 1.005 in 8 decimals
      await expect(tbillPriceOracle.updatePrice(newPrice)).to.be.revertedWith(
        "Price update deviates too much"
      );
    });

    it("should revert when called by non-admin or non-operator", async function () {
      await expect(
        tbillPriceOracle
          .connect(addr1)
          .updatePrice(ethers.utils.parseUnits("1.002", 8))
      ).to.be.revertedWith("Caller is not an admin or operator");
    });
  });

  describe("Update Close Nav Price", function () {
    it("should update close nav price", async function () {
      const newPrice = ethers.utils.parseUnits("1.003", 8); // Set to 1.003 in 8 decimals
      await tbillPriceOracle.updateCloseNavPrice(newPrice);
      const result = await tbillPriceOracle.closeNavPrice();
      expect(result).to.equal(newPrice);
    });

    it("should revert when price deviation is too much", async function () {
      const newPrice = ethers.utils.parseUnits("1.005", 8); // Set to 1.005 in 8 decimals
      await expect(
        tbillPriceOracle.updateCloseNavPrice(newPrice)
      ).to.be.revertedWith("CloseNavPrice update deviates too much");
    });

    it("should revert when called by non-admin or non-operator", async function () {
      await expect(
        tbillPriceOracle
          .connect(addr1)
          .updateCloseNavPrice(ethers.utils.parseUnits("1.002", 8))
      ).to.be.revertedWith("Caller is not an admin or operator");
    });
  });

  describe("Update Close Nav Price Manually", function () {
    it("should update close nav price manually", async function () {
      const newPrice = ethers.utils.parseUnits("1.004", 8); // Set to 1.004 in 8 decimals
      await tbillPriceOracle.updateCloseNavPriceManually(newPrice);
      const result = await tbillPriceOracle.closeNavPrice();
      expect(result).to.equal(newPrice);
    });

    it("should revert when called by non-admin", async function () {
      await expect(
        tbillPriceOracle
          .connect(addr1)
          .updateCloseNavPriceManually(ethers.utils.parseUnits("1.004", 8))
      ).to.be.revertedWith("Caller is not an admin");
    });
  });

  describe("isValidPriceUpdate", function () {
    it("should return true for valid price update", async function () {
      const newPrice = ethers.utils.parseUnits("1.001", 8); // Set to 1.001 in 8 decimals
      const result = await tbillPriceOracle.isValidPriceUpdate(newPrice);
      expect(result).to.be.true;
    });

    it("should return false for invalid price update", async function () {
      const newPrice = ethers.utils.parseUnits("1.005", 8); // Set to 1.005 in 8 decimals
      const result = await tbillPriceOracle.isValidPriceUpdate(newPrice);
      expect(result).to.be.false;
    });
  });
});
