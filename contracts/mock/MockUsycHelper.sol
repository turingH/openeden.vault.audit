// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IPriceFeed {
    function latestAnswer() external view returns (uint256);
}

contract MockUsycHelper {
    using SafeERC20 for IERC20;
    using Math for uint256;

    address public immutable usyc;
    address public immutable usdc;
    address public oracle;
    bool public sellPaused;
    uint256 public scaleFactor = 1e8;
    uint256 public sellFeeRate; // Fee rate in basis points (1e18 = 100%)
    uint256 public constant FEE_MULTIPLIER = 1e18;
    uint256 public mockReturnAmount; // For testing specific return amounts

    constructor(address _usyc, address _usdc, address _oracle) {
        usyc = _usyc;
        usdc = _usdc;
        oracle = _oracle;
        sellPaused = false;
        sellFeeRate = 0; // Default no fee
    }

    function sellFor(
        uint256 amount,
        address recipient
    ) external returns (uint256) {
        require(!sellPaused, "Selling is paused");

        // Transfer USYC from sender to this contract
        IERC20(usyc).safeTransferFrom(msg.sender, address(this), amount);

        // If mockReturnAmount is set, return that amount (for testing)
        if (mockReturnAmount > 0) {
            uint256 returnAmount = mockReturnAmount;
            mockReturnAmount = 0; // Reset after use
            IERC20(usdc).safeTransfer(recipient, returnAmount);
            return returnAmount;
        }

        // Use oracle price for conversion
        uint256 rate = IPriceFeed(oracle).latestAnswer();
        uint256 grossUsdcAmount = amount.mulDiv(rate, scaleFactor);

        // Apply sell fee
        uint256 fee = grossUsdcAmount.mulDiv(sellFeeRate, FEE_MULTIPLIER);
        uint256 netUsdcAmount = grossUsdcAmount - fee;

        // Transfer net USDC to recipient
        IERC20(usdc).safeTransfer(recipient, netUsdcAmount);

        return netUsdcAmount;
    }

    function sellFee() external view returns (uint256) {
        return sellFeeRate;
    }

    function setSellFee(uint256 _feeRate) external {
        sellFeeRate = _feeRate;
    }

    function setSellPaused(bool _paused) external {
        sellPaused = _paused;
    }

    function setOracle(address _oracle) external {
        oracle = _oracle;
    }

    function setMockReturnAmount(uint256 _amount) external {
        mockReturnAmount = _amount;
    }

    // Add USDC to the helper for liquidity
    function addLiquidity(uint256 amount) external {
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
    }

    // Emergency withdraw function for testing
    function emergencyWithdraw(address token, uint256 amount) external {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
