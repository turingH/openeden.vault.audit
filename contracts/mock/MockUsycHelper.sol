// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {console} from "hardhat/console.sol";

interface IAggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

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
    uint256 public constant HUNDRED_PCT = 1e18; // 100% in basis points
    uint256 public mockReturnAmount; // For testing specific return amounts

    // Oracle and token decimals for scaling calculations
    uint8 public constant _oracleDecimals = 8; // Chainlink price feed decimals
    uint8 public constant _ytokenDecimals = 6; // USYC decimals
    uint8 public constant _stableDecimals = 6; // USDC decimals

    constructor(address _usyc, address _usdc, address _oracle) {
        usyc = _usyc;
        usdc = _usdc;
        oracle = _oracle;
        sellPaused = false;
        sellFeeRate = 0; // Default no fee
    }

    function _sellPreview(
        uint256 _amount
    )
        internal
        view
        virtual
        returns (uint256 payout, uint256 fee, int256 price)
    {
        // current price in terms of USD
        (, price, , , ) = IAggregatorV3Interface(oracle).latestRoundData();
        payout = _amount.mulDiv(
            uint256(price),
            10 ** _oracleDecimals,
            Math.Rounding.Down
        );

        // scaling to cents
        payout = payout / (10 ** (_ytokenDecimals - 2));

        // scaling to stable decimals
        uint256 stableDecimals = _stableDecimals;
        if (stableDecimals > 2) {
            uint256 scale = 10 ** (stableDecimals - 2);

            payout = payout * scale;
        } else if (stableDecimals < 2) {
            uint256 scale = 10 ** (2 - stableDecimals);

            payout = payout / scale;
        }

        // deducting fee from the payout
        fee = payout.mulDiv(sellFee(), HUNDRED_PCT, Math.Rounding.Down);
        payout -= fee;
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
        (uint256 payout, uint256 fee, ) = _sellPreview(amount);

        // Apply sell fee
        uint256 netUsdcAmount = payout - fee;

        console.log("amount", amount);
        console.log("payout", payout);
        console.log("fee", fee);
        console.log("netUsdcAmount", netUsdcAmount);

        // Transfer net USDC to recipient
        IERC20(usdc).safeTransfer(recipient, netUsdcAmount);

        return netUsdcAmount;
    }

    function sellFee() public view returns (uint256) {
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
