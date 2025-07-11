import { ethers } from "hardhat";
import { expect } from "chai";

// Define KycType enum
const KycType = {
  NON_KYC: 0,
  US_KYC: 1,
  GENERAL_KYC: 2,
};

describe("KycManager", function () {
  let KycManager, kycManager, owner, addr1, addr2;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    KycManager = await ethers.getContractFactory("KycManager");
    [owner, addr1, addr2] = await ethers.getSigners();
    kycManager = await KycManager.deploy();
    await kycManager.deployed();
  });

  describe("Kyc Operations", function () {
    it("Should grant KYC correctly", async function () {
      await kycManager
        .connect(owner)
        .grantKycInBulk([addr1.address], [KycType.US_KYC]);
      const userInfo = await kycManager.getUserInfo(addr1.address);
      expect(userInfo.kycType).to.equal(KycType.US_KYC);
    });

    it("Should not allow non-owner to grant KYC", async function () {
      await expect(
        kycManager
          .connect(addr1)
          .grantKycInBulk([addr2.address], [KycType.US_KYC])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revoke KYC correctly", async function () {
      await kycManager
        .connect(owner)
        .grantKycInBulk([addr1.address], [KycType.US_KYC]);
      await kycManager.connect(owner).revokeKycInBulk([addr1.address]);
      const userInfo = await kycManager.getUserInfo(addr1.address);
      expect(userInfo.kycType).to.equal(KycType.NON_KYC);
    });

    it("Should not allow non-owner to revoke KYC", async function () {
      await kycManager
        .connect(owner)
        .grantKycInBulk([addr1.address], [KycType.US_KYC]);
      await expect(
        kycManager.connect(addr1).revokeKycInBulk([addr1.address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Abnormal cases", async function () {
      await expect(
        kycManager.grantKycInBulk(
          [addr1.address, addr2.address],
          [KycType.US_KYC]
        )
      ).to.be.revertedWith("invalid input");

      try {
        await kycManager.grantKycInBulk([addr1.address], [5]);
        expect.fail("Transaction should have reverted");
      } catch (error) {
        // Check if the error message indicates a revert
        expect(error.message).to.match(/revert/);
      }

      await expect(
        kycManager.grantKycInBulk([addr1.address], [KycType.NON_KYC])
      ).to.revertedWith("invalid kyc type");

      await expect(
        kycManager.revokeKycInBulk([ZERO_ADDRESS])
      ).to.be.revertedWith("invalid address");

      await expect(kycManager.bannedInBulk([ZERO_ADDRESS])).to.be.revertedWith(
        "invalid address"
      );
    });
  });

  describe("Ban Operations", function () {
    it("Should ban user correctly", async function () {
      await kycManager.connect(owner).bannedInBulk([addr1.address]);
      const userInfo = await kycManager.getUserInfo(addr1.address);
      expect(userInfo.isBanned).to.equal(true);
    });

    it("Should not allow non-owner to ban user", async function () {
      await expect(
        kycManager.connect(addr1).bannedInBulk([addr2.address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should unban user correctly", async function () {
      await kycManager.connect(owner).bannedInBulk([addr1.address]);
      await kycManager.connect(owner).unBannedInBulk([addr1.address]);
      const userInfo = await kycManager.getUserInfo(addr1.address);
      expect(userInfo.isBanned).to.equal(false);
    });

    it("Should not allow non-owner to unban user", async function () {
      await kycManager.connect(owner).bannedInBulk([addr1.address]);
      await expect(
        kycManager.connect(addr1).unBannedInBulk([addr1.address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Strict Mode Operations", function () {
    it("Should set strict mode correctly", async function () {
      await expect(kycManager.connect(addr1).setStrict(true)).to.revertedWith(
        "Ownable: caller is not the owner"
      );

      await kycManager.connect(owner).setStrict(true);
      const isStrict = await kycManager.isStrict();
      expect(isStrict).to.be.equal(true);
    });
    it("check us kyc", async function () {
      await kycManager.connect(owner).setStrict(true);
      const usKyc = await kycManager.isUSKyc(addr1.address);
      expect(usKyc).to.be.equal(false);
    });

    it("Check non us kyc", async function () {
      await kycManager.connect(owner).setStrict(true);
      const nonUsKyc = await kycManager.isNonUSKyc(addr1.address);
      expect(nonUsKyc).to.be.equal(false);
    });

    it("Check non us kyc", async function () {
      await kycManager.connect(owner).setStrict(true);
      const nonUsKyc = await kycManager.isNonUSKyc(addr1.address);
      expect(nonUsKyc).to.be.equal(false);
    });
  });
});
