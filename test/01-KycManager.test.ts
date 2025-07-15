import { ethers, upgrades } from "hardhat";
import { expect } from "chai";

const KycType = {
  NON_KYC: 0,
  US_KYC: 1,
  GENERAL_KYC: 2,
};

describe("KycManager (UUPS + Roles)", function () {
  let kycManager;
  let owner, granter, revoker, banner, unbanner, addr1, addr2;

  const ZERO_ADDRESS = ethers.constants.AddressZero;

  beforeEach(async function () {
    [owner, granter, revoker, banner, unbanner, addr1, addr2] =
      await ethers.getSigners();

    const KycManagerFactory = await ethers.getContractFactory("KycManager");
    kycManager = await upgrades.deployProxy(KycManagerFactory, [
      owner.address,
      granter.address,
      revoker.address,
      banner.address,
      unbanner.address,
    ]);
    await kycManager.deployed();
  });

  describe("KYC Operations", function () {
    it("Should grant KYC with correct role", async function () {
      await kycManager
        .connect(granter)
        .grantKycInBulk([addr1.address], [KycType.US_KYC]);
      const userInfo = await kycManager.getUserInfo(addr1.address);
      expect(userInfo.kycType).to.equal(KycType.US_KYC);
    });

    it("Should revert grant KYC without role", async function () {
      await expect(
        kycManager
          .connect(addr1)
          .grantKycInBulk([addr2.address], [KycType.US_KYC])
      ).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await kycManager.GRANT_ROLE()}`
      );
    });

    it("Should revoke KYC with correct role", async function () {
      await kycManager
        .connect(granter)
        .grantKycInBulk([addr1.address], [KycType.US_KYC]);
      await kycManager.connect(revoker).revokeKycInBulk([addr1.address]);
      const userInfo = await kycManager.getUserInfo(addr1.address);
      expect(userInfo.kycType).to.equal(KycType.NON_KYC);
    });

    it("Should revert invalid inputs and unauthorized access", async function () {
      await expect(
        kycManager
          .connect(granter)
          .grantKycInBulk([addr1.address, addr2.address], [KycType.US_KYC])
      ).to.be.revertedWith("invalid input");

      await expect(
        kycManager.connect(granter).grantKycInBulk([addr1.address], [5])
      ).to.be.reverted;

      await expect(
        kycManager
          .connect(granter)
          .grantKycInBulk([addr1.address], [KycType.NON_KYC])
      ).to.be.revertedWith("invalid kyc type");

      await expect(
        kycManager.connect(revoker).revokeKycInBulk([ZERO_ADDRESS])
      ).to.be.revertedWith("invalid address");
    });
  });

  describe("Ban Operations", function () {
    it("Should ban and unban with correct roles", async function () {
      await kycManager.connect(banner).bannedInBulk([addr1.address]);
      expect((await kycManager.getUserInfo(addr1.address)).isBanned).to.equal(
        true
      );

      await kycManager.connect(unbanner).unBannedInBulk([addr1.address]);
      expect((await kycManager.getUserInfo(addr1.address)).isBanned).to.equal(
        false
      );
    });

    it("Should revert ban/unban by unauthorized account", async function () {
      await expect(
        kycManager.connect(addr1).bannedInBulk([addr2.address])
      ).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await kycManager.BAN_ROLE()}`
      );

      await kycManager.connect(banner).bannedInBulk([addr1.address]);
      await expect(
        kycManager.connect(addr1).unBannedInBulk([addr1.address])
      ).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await kycManager.UNBAN_ROLE()}`
      );
    });
  });

  describe("Strict Mode Operations", function () {
    it("Should allow only admin to toggle strict mode", async function () {
      await expect(kycManager.connect(addr1).setStrict(true)).to.be.reverted;

      await kycManager.connect(owner).setStrict(true);
      expect(await kycManager.isStrict()).to.equal(true);
    });

    it("Should check US and non-US KYC properly", async function () {
      expect(await kycManager.isUSKyc(addr1.address)).to.equal(false);
      expect(await kycManager.isNonUSKyc(addr1.address)).to.equal(false);

      await kycManager
        .connect(granter)
        .grantKycInBulk([addr1.address], [KycType.GENERAL_KYC]);

      expect(await kycManager.isUSKyc(addr1.address)).to.equal(false);
      expect(await kycManager.isNonUSKyc(addr1.address)).to.equal(true);
    });
  });
});
