// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

interface IController {
    function requireNotPausedWithdraw() external view;

    function requireNotPausedDeposit() external view;

    function pausedWithdraw() external view returns (bool);

    function pausedDeposit() external view returns (bool);
}
