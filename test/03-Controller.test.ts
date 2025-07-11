import { ethers } from "hardhat";
import { expect } from "chai";

describe("Controller", function () {
  let Controller, controller, owner, operator, addr1, addr2;

  beforeEach(async function () {
    Controller = await ethers.getContractFactory("Controller");
    [owner, operator, addr1, addr2] = await ethers.getSigners();
    controller = await Controller.deploy(operator.address, owner.address);
  });

  describe("Permissions", function () {
    it("deploy admin with zero address", async function () {
      const Controller2 = await ethers.getContractFactory("Controller");
      await expect(
        Controller2.deploy(
          operator.address,
          "0x0000000000000000000000000000000000000000"
        )
      ).to.revertedWith("invalid admin address");
    });

    it("should grant OPERATOR_ROLE to the operator", async function () {
      const hasOperatorRole = await controller.hasRole(
        await controller.OPERATOR_ROLE(),
        operator.address
      );
      expect(hasOperatorRole).to.be.true;
    });

    it("should grant DEFAULT_ADMIN_ROLE to the owner", async function () {
      const hasAdminRole = await controller.hasRole(
        await controller.DEFAULT_ADMIN_ROLE(),
        owner.address
      );
      expect(hasAdminRole).to.be.true;
    });

    it("should revert when non-operator tries to pause deposit", async function () {
      await expect(controller.connect(addr1).pauseDeposit()).to.be.revertedWith(
        "permission denied"
      );
    });

    it("should revert when non-operator tries to pause withdraw", async function () {
      await expect(
        controller.connect(addr1).pauseWithdraw()
      ).to.be.revertedWith("permission denied");
    });

    it("should revert when non-operator tries to unpause deposit", async function () {
      await expect(
        controller.connect(addr1).unpauseDeposit()
      ).to.be.revertedWith("permission denied");
    });

    it("should revert when non-operator tries to unpause withdraw", async function () {
      await expect(
        controller.connect(addr1).unpauseWithdraw()
      ).to.be.revertedWith("permission denied");
    });

    it("should revert when non-operator tries to pause all", async function () {
      await expect(controller.connect(addr1).pauseAll()).to.be.revertedWith(
        "permission denied"
      );
    });

    it("should revert if requireNotPausedWithdraw is called when paused", async function () {
      await controller.pauseWithdraw();
      await expect(controller.requireNotPausedWithdraw()).to.be.revertedWith(
        "Pausable: withdraw paused"
      );
    });

    it("should revert if requireNotPausedDeposit is called when paused", async function () {
      await controller.pauseDeposit();
      await expect(controller.requireNotPausedDeposit()).to.be.revertedWith(
        "Pausable: deposit paused"
      );
    });

    it("should not revert if requireNotPausedWithdraw is called when not paused", async function () {
      await controller.requireNotPausedWithdraw(); // This should not revert
    });

    it("should not revert if requireNotPausedDeposit is called when not paused", async function () {
      await controller.requireNotPausedDeposit(); // This should not revert
    });
  });

  describe("Pause Functions", function () {
    it("should pause deposit when called by operator", async function () {
      await controller.pauseDeposit();
      const depositPaused = await controller.pausedDeposit();
      expect(depositPaused).to.be.true;
    });

    it("should pause withdraw when called by operator", async function () {
      await controller.pauseWithdraw();
      const withdrawPaused = await controller.pausedWithdraw();
      expect(withdrawPaused).to.be.true;
    });

    it("should pause both deposit and withdraw when called by operator", async function () {
      await controller.pauseAll();
      const depositPaused = await controller.pausedDeposit();
      const withdrawPaused = await controller.pausedWithdraw();
      expect(depositPaused).to.be.true;
      expect(withdrawPaused).to.be.true;
    });

    it("should return false for depositPaused and withdrawPaused initially", async function () {
      const depositPaused = await controller.pausedDeposit();
      const withdrawPaused = await controller.pausedWithdraw();
      expect(depositPaused).to.be.false;
      expect(withdrawPaused).to.be.false;
    });

    it("should revert when non-operator tries to pause deposit", async function () {
      await expect(controller.connect(addr1).pauseDeposit()).to.be.revertedWith(
        "permission denied"
      );
    });

    it("should revert when non-operator tries to pause withdraw", async function () {
      await expect(
        controller.connect(addr1).pauseWithdraw()
      ).to.be.revertedWith("permission denied");
    });
  });

  describe("Unpause Functions", function () {
    it("should unpause deposit when called by operator", async function () {
      await controller.connect(operator).pauseDeposit();
      await controller.connect(operator).unpauseDeposit();
      const depositPaused = await controller.pausedDeposit();
      expect(depositPaused).to.be.false;
    });

    it("should unpause withdraw when called by operator", async function () {
      await controller.connect(operator).pauseWithdraw();
      await controller.connect(operator).unpauseWithdraw();
      const withdrawPaused = await controller.pausedWithdraw();
      expect(withdrawPaused).to.be.false;
    });

    it("should unpause both deposit and withdraw when called by operator", async function () {
      await controller.connect(operator).pauseAll();
      let withdrawPaused = await controller.pausedWithdraw();
      let depositPaused = await controller.pausedDeposit();
      expect(withdrawPaused).to.be.true;
      expect(depositPaused).to.be.true;

      await controller.connect(operator).unpauseWithdraw();
      await controller.connect(operator).unpauseDeposit();
      depositPaused = await controller.pausedDeposit();
      withdrawPaused = await controller.pausedWithdraw();
      expect(depositPaused).to.be.false;
      expect(withdrawPaused).to.be.false;
    });
  });
});
