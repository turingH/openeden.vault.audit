// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

enum ServiceFeeType {
    ONCHAIN,
    OFFCHAIN
}

interface IOpenEdenVault {
    event Deposit(address indexed receiver, uint256 assets, uint256 shares);

    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    event SetOplTreasury(address oplTreasury);
    event UpdateTreasury(address newAddress);
    event UpdateQTreasury(address newAddress);

    event SetFeeManager(address feeManager);
    event SetKycManager(address kycManager);
    event SetTimelock(address timelock);
    event SetOperator(address operator, bool status);
    event SetMaintainer(address _maintainer);
    event SetTBillPriceFeed(address priceFeed);
    event SetController(address controller);
    event SetPartnerShip(address partnerShip);
    event SetTimeBuffer(uint256 timeBuffer);

    event ClaimServiceFee(address receiver, uint256 amount);
    event UpdateEpoch(uint256 unClaimedFee, uint256 epoch, bool isWeekend);
    event SetWeekendFlag(bool flag);
    event AddToWithdrawalQueue(
        address sender,
        address receiver,
        uint256 shares,
        bytes32 id
    );
    event ProcessWithdrawalQueue(
        uint256 totalAssets,
        uint256 totalShares,
        uint256 totalFees
    );
    event OffRamp(address treasury, uint256 assets);
    event OffRampQ(address qTreasury, uint256 assets);
    event ProcessDeposit(
        address sender,
        address receiver,
        uint256 assets,
        uint256 shares,
        uint256 oeFee,
        int256 pFee,
        uint256 totalFee,
        address oplTreasury,
        address treasury
    );
    event ProcessWithdraw(
        address sender,
        address receiver,
        uint256 assets,
        uint256 shares,
        uint256 actualAssets,
        uint256 actualShare,
        uint256 oeFee,
        int256 pFee,
        uint256 totalFee,
        bytes32 prevId,
        address oplTreasury
    );
    event ProcessRedeemCancel(
        address sender,
        address receiver,
        uint256 shares,
        bytes32 prevId
    );
    event Cancel(uint256 len, uint256 totalShares);

    error TBillNoPermission(address caller);
    error TBillInvalidateKyc(address sender, address receiver);
    error TBillLessThanFirstDeposit(uint256 amount, uint256 minDeposit);
    error TBillLessThanMin(uint256 amount, uint256 minDeposit);
    error TBillInvalidInput(uint256 amount);
    error TBillUpdateTooEarly(uint256 amount);
    error TBillZeroAddress();
    error TBillReceiveUSDCFailed();
    error TBillInvalidPrice(int256 answer);
    error TBillPriceOutdated(uint256 updatedAt);
}
