// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IRedemption {
    function redeem(uint256 amount) external;

    function settlement() external view returns (address);
}

/**
 * @title Redemption
 * @dev Pausable by the Pauser
 * @dev Asset token is ERC20-compatible
 * @dev Liquidity token is ERC20-compatible
 */
contract MockBuidlRedemption is IRedemption {
    using SafeERC20 for IERC20;

    address public buidl;
    address public asset;

    constructor(address _buidl, address _asset) {
        buidl = _buidl;
        asset = _asset;
    }

    /**
     * @notice Enforces the caller must hold the asset
     */
    modifier onlyAssetHolder() {
        require(IERC20(buidl).balanceOf(msg.sender) > 0, "Not asset holder");
        _;
    }

    function redeem(uint256 amount) external override onlyAssetHolder {
        IERC20(buidl).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).transfer(msg.sender, amount);
    }

    function settlement() external view override returns (address) {
        return address(this);
    }

    function availableLiquidity() external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }
}
