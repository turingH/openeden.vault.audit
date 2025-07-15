// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRedemption.sol";

contract MockTBILL is ERC20, Ownable {
    using MathUpgradeable for uint256;

    uint256 public constant _tbillDecimalScaleFactor = 10 ** 6;
    uint256 public _tbillUsdcRate;
    address public _usdc;
    address public _buidl;
    address public _redeemer;
    address public _treasury;

    error TBillReceiveUSDCFailed();

    constructor(
        address usdc,
        address buidl,
        address redeemer,
        address treasury
    ) ERC20("Mock TBILL", "TBILL") {
        _usdc = usdc;
        _buidl = buidl;
        _redeemer = redeemer;
        _treasury = treasury;
        _mint(msg.sender, 100000000000000000000000000000 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // _rate: 1.01 * 10 ** 6;
    function setTbillUsdcRate(uint256 _rate) external onlyOwner {
        _tbillUsdcRate = _rate;
    }

    function tbillUsdcRate() public view returns (uint256 rate) {
        return _tbillUsdcRate;
    }

    function setUsdc(address _usdcAddr) external onlyOwner {
        _usdc = _usdcAddr;
    }

    function setBuidl(address _buidlAddr) external onlyOwner {
        _buidl = _buidlAddr;
    }

    function setRedeemer(address _redeemerAddr) external onlyOwner {
        _redeemer = _redeemerAddr;
    }

    function redeemIns(
        uint256 _shares,
        address _receiver
    ) external returns (uint256) {
        uint256 _assets = _convertToAssets(_shares);
        _burn(msg.sender, _shares);

        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(_buidl),
            _treasury,
            address(this),
            _assets
        );

        // 3. redeem BUIDL to USDC
        SafeERC20Upgradeable.safeApprove(
            IERC20Upgradeable(_buidl),
            address(_redeemer),
            _assets
        );

        uint256 before = onchainAssets();
        IRedemption(_redeemer).redeem(_assets);
        if (before + _assets != onchainAssets())
            revert TBillReceiveUSDCFailed();

        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(_usdc),
            _receiver,
            _assets
        );
        return _assets;
    }

    function onchainAssets() public view returns (uint256 assetAmt) {
        return IERC20Upgradeable(_usdc).balanceOf(address(this));
    }

    /**
     * @dev Converts the number of shares to asset amount.
     * @param _shares Number of shares to convert.
     * @return assets Equivalent asset amount.
     */
    function _convertToAssets(
        uint256 _shares
    ) internal view returns (uint256 assets) {
        assets = _shares.mulDiv(tbillUsdcRate(), _tbillDecimalScaleFactor);
    }

    /**
     * @dev Converts asset amount to the equivalent number of shares.
     * @param _assets Asset amount to convert.
     * @return shares Equivalent number of shares.
     */
    function _convertToShares(
        uint256 _assets
    ) internal view returns (uint256 shares) {
        shares = _assets.mulDiv(_tbillDecimalScaleFactor, tbillUsdcRate());
    }
}
