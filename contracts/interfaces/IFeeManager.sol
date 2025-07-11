// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;
import "./ITypes.sol";

interface IFeeManager {
    function getMaxWeekendDepositPct()
        external
        view
        returns (uint256 x, uint256 y);

    function getTxFeeWeekend() external view returns (uint256 x);

    function getTxFeeWeekday() external view returns (uint256 x);

    function getMinMaxDeposit()
        external
        view
        returns (uint256 minDeposit, uint256 maxDeposit);

    function getMinMaxWithdraw()
        external
        view
        returns (uint256 minWithdraw, uint256 maxWithdraw);

    function getManagementFeeRate() external view returns (uint256 feeRate);

    function getFirstDeposit() external view returns (uint256 firstDeposit);

    function getMaxHolidayDepositPct()
        external
        view
        returns (uint256 maxDepositPct, uint256 maxDepositAggregatedPct);

    function getMinTxsFee() external view returns (uint256);
}
