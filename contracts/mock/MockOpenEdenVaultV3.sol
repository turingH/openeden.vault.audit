// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import "../OpenEdenVaultV2.sol";

contract MockOpenEdenVaultV3 is OpenEdenVaultV2 {
    function version() public pure returns (string memory) {
        return "vault version3";
    }
}
