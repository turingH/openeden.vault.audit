// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;
import "./ITypes.sol";

interface IPartnerShipV4 {
    function getFeeByChildAndAction(
        address child,
        ActionType action
    ) external view returns (int256 _fee);

    function isChildHasParent(address child) external view returns (bool);
}
