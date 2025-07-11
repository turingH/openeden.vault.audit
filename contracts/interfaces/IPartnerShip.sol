// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;
import "./ITypes.sol";

interface IPartnerShip {
    function getFeeByChildAndAction(
        address child,
        ActionType action
    ) external view returns (uint256 _fee);

    function isChildHasParent(address child) external view returns (bool);
}
