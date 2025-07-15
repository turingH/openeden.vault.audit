// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IRedemption.sol";
import "../interfaces/IPriceFeed.sol";

error UnauthorizedCaller();
error ZeroAddress();
error StalePrice(uint256 updatedAt, uint256 maxAge);
error InvalidPrice(int256 price);

interface IUsycHelper {
    /**
     * @notice Sell USYC tokens and receive USDC
     * @param amount Amount of USYC tokens to sell
     * @param recipient Address to receive USDC
     * @return Amount of USDC received

     */
    function sellFor(
        uint256 amount,
        address recipient
    ) external returns (uint256);

    /**
     * @notice Check if selling is currently paused
     * @return true if selling is paused, false otherwise
     */
    function sellPaused() external view returns (bool);

    function sellFee() external view returns (uint256);

    function oracle() external view returns (address);
}

/**
 * @title UsycRedemption
 * @dev Implements instant redemption of USYC tokens to USDC using USYC's sell function
 * @dev Pausable by the owner
 * @dev Asset token (USDC) is ERC20-compatible
 * @dev USYC token implements IUsyc interface with sell function
 */
contract UsycRedemption is IRedemption, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 public constant MAX_PRICE_AGE = 3 days; // 3-day buffer
    uint256 public minPrice;
    uint256 public scaleFactor;
    uint8 public usycDecimals;
    uint8 public usdcDecimals;

    address public usyc;
    address public usdc;
    address public helper;
    address public tbillVault;
    address public usycTreasury;

    uint256 public constant FEE_MULTIPLIER = 10 ** 18;
    uint256 public constant HUNDRED_PCT = 100 * FEE_MULTIPLIER;

    constructor(
        address _usyc,
        address _usdc,
        address _helper,
        address _tbillVault,
        address _usycTreasury
    ) {
        usyc = _usyc;
        usdc = _usdc;
        helper = _helper;
        tbillVault = _tbillVault;
        usycTreasury = _usycTreasury;

        // Get decimals from both tokens
        usycDecimals = IERC20Metadata(_usyc).decimals();
        usdcDecimals = IERC20Metadata(_usdc).decimals();

        scaleFactor = 10 ** IPriceFeed(IUsycHelper(helper).oracle()).decimals();
        minPrice = 1 * scaleFactor;
    }

    /**
     * @notice Redeem USYC tokens for USDC using USYC's sell function
     * @param _amount Amount of USYC tokens to redeem
     * @return received usdc amount
     */
    // 100
    function redeem(uint256 _amount) external override returns (uint256) {
        if (msg.sender != tbillVault) revert UnauthorizedCaller();

        /*
         Consider 0 fee first, will update in the future
        uint256 sellFeeRate = IUsycHelper(helper).sellFee();

        // Calculate the gross USDC payout needed to receive _amount after fees
        // netPayout = grossPayout * (1 - sellFeeRate / HUNDRED_PCT)
        // So: grossPayout = netPayout / (1 - sellFeeRate / HUNDRED_PCT)
        uint256 grossUsdc = _amount.mulDiv(
            HUNDRED_PCT,
            HUNDRED_PCT - sellFeeRate,
            Math.Rounding.Up
        );

        // Convert the gross USDC amount to USYC tokens
        */
        uint256 amt = convertUsdcToToken(_amount);
        IERC20(usyc).safeTransferFrom(usycTreasury, address(this), amt);

        IERC20(usyc).approve(helper, amt);

        return IUsycHelper(helper).sellFor(amt, tbillVault);
    }

    /**
     * @notice Check the available liquidity for instant redeem.
     * @return liquidity The available liquidity from the redemption contract.
     * @return tAllowance The redemption token allowance for the vault.
     * @return tBalance The redemption token balance in the Treasury.
     * @return tAllowanceInUsdc The redemption token allowance in USDC.
     * @return tBalanceInUsdc The redemption token balance in USDC.
     * @return minimum The minimum of the available liquidity, the redemption token allowance, and the redemption token balance in USDC.
     */
    function checkLiquidity()
        public
        view
        override
        returns (
            uint256 liquidity,
            uint256 tAllowance,
            uint256 tBalance,
            uint256 tAllowanceInUsdc,
            uint256 tBalanceInUsdc,
            uint256 minimum
        )
    {
        liquidity = IERC20(usdc).balanceOf(helper);

        tAllowance = IERC20(usyc).allowance(usycTreasury, address(this));
        tAllowanceInUsdc = convertTokenToUsdc(tAllowance);

        tBalance = IERC20(usyc).balanceOf(usycTreasury);
        tBalanceInUsdc = convertTokenToUsdc(tBalance);

        minimum = liquidity.min(tAllowanceInUsdc.min(tBalanceInUsdc));
    }

    /**
     * @notice Check if USYC selling is currently available
     * @return false if USYC can be sold, true otherwise
     */
    function checkPaused() external view returns (bool) {
        return IUsycHelper(helper).sellPaused();
    }

    function getPrice(address _oracle) public view returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = IPriceFeed(_oracle).latestRoundData();

        // Check if the price data is not older than 3 days
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) {
            revert StalePrice(updatedAt, MAX_PRICE_AGE);
        }

        // Check for incomplete round data
        if (answeredInRound < roundId) {
            revert StalePrice(updatedAt, MAX_PRICE_AGE);
        }

        if (uint256(price) < minPrice) revert InvalidPrice(price);
        return uint256(price);
    }

    function convertUsdcToToken(uint256 _amount) public view returns (uint256) {
        uint256 price = getPrice(IUsycHelper(helper).oracle());
        // Convert USDC amount to USYC token amount accounting for decimal differences
        // Formula: (usdcAmount * 10^usycDecimals * scaleFactor) / (price * 10^usdcDecimals)
        return
            _amount.mulDiv(
                10 ** usycDecimals * scaleFactor,
                price * 10 ** usdcDecimals,
                Math.Rounding.Up
            );
    }

    function convertTokenToUsdc(uint256 _amount) public view returns (uint256) {
        uint256 price = getPrice(IUsycHelper(helper).oracle());
        // Convert USYC token amount to USDC amount accounting for decimal differences
        // Formula: (usycAmount * price * 10^usdcDecimals) / (scaleFactor * 10^usycDecimals)
        return
            _amount.mulDiv(
                price * 10 ** usdcDecimals,
                scaleFactor * 10 ** usycDecimals,
                Math.Rounding.Down
            );
    }

    /**
     * @notice Set the USYC treasury address (only owner)
     * @param _usycTreasury Address of the USYC treasury
     */
    function setUsycTreasury(address _usycTreasury) external onlyOwner {
        if (_usycTreasury == address(0)) revert ZeroAddress();
        usycTreasury = _usycTreasury;
    }

    /**
     * @notice Emergency withdraw function for owner to withdraw stuck tokens
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(owner(), amount);
    }
}
