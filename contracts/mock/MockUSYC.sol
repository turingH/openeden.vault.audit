// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSYC is ERC20 {
    constructor() ERC20("Mock USYC", "USYC") {
        _mint(msg.sender, 1000000000 * 10 ** decimals()); // 1 billion tokens
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
