import { expect } from "chai";
import { ethers } from "hardhat";

describe("PartnerShip", function () {
  let PartnerShip;
  let partnerShip;
  let owner;
  let child1, child2, parent;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const depositFee = 100;
  const redeemFee = 50;
  const negativeDepositFee = -100;
  const negativeRedeemFee = -50;

  beforeEach(async function () {
    [owner, child1, child2, parent] = await ethers.getSigners();

    PartnerShip = await ethers.getContractFactory("PartnerShip");
    partnerShip = await PartnerShip.deploy();
    await partnerShip.deployed();
  });

  it("should create partnership and emit PartnerShipCreated event", async function () {
    await partnerShip.createPartnerShip(
      [child1.address, child2.address],
      parent.address
    );

    expect(await partnerShip.getParent(child1.address)).to.equal(
      parent.address
    );
    expect(await partnerShip.getParent(child2.address)).to.equal(
      parent.address
    );
  });

  it("should update partnership fees and emit PartnerShipFeesUpdated event", async function () {
    await partnerShip.createPartnerShip([child1.address], parent.address);
    await partnerShip.updatePartnerShipFees(
      parent.address,
      depositFee,
      redeemFee
    );

    const [updatedDepositFee, updatedRedeemFee] =
      await partnerShip.getParentFees(parent.address);
    expect(updatedDepositFee).to.equal(depositFee);
    expect(updatedRedeemFee).to.equal(redeemFee);
  });

  it("should update partnership with negative fees", async function () {
    await partnerShip.createPartnerShip([child1.address], parent.address);
    await partnerShip.updatePartnerShipFees(
      parent.address,
      negativeDepositFee,
      negativeRedeemFee
    );

    const [updatedDepositFee, updatedRedeemFee] =
      await partnerShip.getParentFees(parent.address);

    expect(updatedDepositFee).to.equal(negativeDepositFee);
    expect(updatedRedeemFee).to.equal(negativeRedeemFee);
  });

  it("should get the fee by child and action type with negative values", async function () {
    await partnerShip.createPartnerShip([child1.address], parent.address);
    await partnerShip.updatePartnerShipFees(
      parent.address,
      negativeDepositFee,
      negativeRedeemFee
    );

    const depositChildFee = await partnerShip.getFeeByChildAndAction(
      child1.address,
      0 // ActionType.DEPOSIT
    );
    const redeemChildFee = await partnerShip.getFeeByChildAndAction(
      child1.address,
      1 // ActionType.REDEEM
    );

    expect(depositChildFee).to.equal(negativeDepositFee);
    expect(redeemChildFee).to.equal(negativeRedeemFee);
  });

  it("should check if the child has a parent", async function () {
    await partnerShip.createPartnerShip([child1.address], parent.address);

    expect(await partnerShip.isChildHasParent(child1.address)).to.equal(true);
    expect(await partnerShip.isChildHasParent(child2.address)).to.equal(false);
  });

  it("should revert if child address is zero when creating partnership", async function () {
    await expect(
      partnerShip.createPartnerShip([ZERO_ADDRESS], parent.address)
    ).to.be.revertedWith("PartnerShip: child is zero address");
  });

  it("should revert if updating fees for non-existing parent", async function () {
    await expect(
      partnerShip.updatePartnerShipFees(ZERO_ADDRESS, depositFee, redeemFee)
    ).to.be.revertedWith("PartnerShip: parent is zero address");
  });

  it("should revert if non-owner tries to create partnership", async function () {
    await expect(
      partnerShip
        .connect(child1)
        .createPartnerShip([child1.address], parent.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should revert if non-owner tries to update fees", async function () {
    await expect(
      partnerShip
        .connect(child1)
        .updatePartnerShipFees(parent.address, depositFee, redeemFee)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});
