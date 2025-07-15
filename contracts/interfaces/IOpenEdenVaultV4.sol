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
    event SetMgtFeeTreasury(address treasury);
    event UpdateTreasury(address newAddress);
    event UpdateQTreasury(address newAddress);
    event SetBuidl(address buidl, address buidlRedemption);
    event SetBuidlTreasury(address buidlTreasury);

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
    event SetRedemption(address redemptionContract);
    event TotalSupplyCap(uint256 supplyCap);
    event BurnFrom(address indexed from, uint256 amount);
    event MintTo(address indexed to, uint256 amount);
    event ReIssue(
        address indexed oldWallet,
        address indexed newWallet,
        uint256 amount
    );

    error TBillNoPermission(address caller);
    error TBillInvalidateKyc(address sender, address receiver);
    error TBillLessThanFirstDeposit(uint256 amount, uint256 minDeposit);
    error TBillLessThanMin(uint256 amount, uint256 minDeposit);
    error TBillInvalidInput(uint256 amount);
    error TBillUpdateTooEarly(uint256 amount);
    error TBillZeroAddress();
    error TBillReceiveUSDCFailed(uint256 received, uint256 expected);
    error TBillInvalidPrice(int256 answer);
    error TBillPriceOutdated(uint256 updatedAt);
    error TotalSupplyCapExceeded(
        uint256 totalSupply,
        uint256 share,
        uint256 cap
    );
}
