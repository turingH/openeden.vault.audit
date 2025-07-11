// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

interface IBuidlRedemption {
    function redeem(uint256 amount) external;

    function paused() external view returns (bool);

    function settlement() external view returns (address);
}

interface IBuidlSettlement {
    function availableLiquidity() external view returns (uint256);
}
