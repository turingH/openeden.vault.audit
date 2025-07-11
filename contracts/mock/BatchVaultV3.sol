// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IOpenEdenVaultTest {
    function deposit(uint256 _assets, address _receiver) external;

    function redeem(uint256 _shares, address _receiver) external;

    function processWithdrawalQueue(uint _len) external;

    function offRamp(uint256 _amt) external;

    function offRampQ(address _token, uint256 _amt) external;
}

contract BatchVaultV3 {
    /**
  1. kyc this contract
  2. approve usdc to this contract (owner: operators)
  3. approve this to vaultV3
  4. transfer usdc into address(this)
   */
    address public vaultV3;
    address public usdc;
    address[] public kycList;
    address public subsidyOperator;
    address public onRampOperator;

    constructor(
        address _vaultV3,
        address _usdc,
        address _subsidyOperator,
        address _onRampOperator
    ) {
        require(
            _vaultV3 != address(0) &&
                _usdc != address(0) &&
                _subsidyOperator != address(0) &&
                _onRampOperator != address(0),
            "BatchTestV3: zero address"
        );
        vaultV3 = _vaultV3;
        usdc = _usdc;
        subsidyOperator = _subsidyOperator;
        onRampOperator = _onRampOperator;
    }

    function approveV3() public {
        ERC20(usdc).approve(vaultV3, type(uint256).max);
    }

    function setKyc(address[] memory _kycList) external {
        for (uint i = 0; i < _kycList.length; i++) {
            kycList.push(_kycList[i]);
        }
    }

    function setVaultV3(address _vaultV3) external {
        vaultV3 = _vaultV3;
    }

    function setSubsidyOperator(address _subsidyOperator) external {
        subsidyOperator = _subsidyOperator;
    }

    function setOnRampOperator(address _onRampOperator) external {
        onRampOperator = _onRampOperator;
    }

    // sender is address(this), need to kyc first
    function batchDeposit(uint256 _depositAmt, uint256 _num) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
        }
    }

    function batchRedeem(uint256 _redeemAmt, uint256 _num) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).redeem(_redeemAmt, msg.sender);
        }
    }

    function mixDepositRedeem(
        uint256 _depositAmt,
        uint256 _redeemAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
            IOpenEdenVaultTest(vaultV3).redeem(_redeemAmt, msg.sender);
        }
    }

    function depositOnRamp(
        uint256 _depositAmt,
        uint256 _onRampAmt,
        uint256 _subsidyAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
            ERC20(usdc).transferFrom(onRampOperator, vaultV3, _onRampAmt);
            ERC20(usdc).transferFrom(subsidyOperator, vaultV3, _subsidyAmt);
        }
    }

    function depositOnRampSubsidy(
        uint256 _depositAmt,
        uint256 _onRampAmt,
        uint256 _subsidyAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
            ERC20(usdc).transferFrom(onRampOperator, vaultV3, _onRampAmt);
            ERC20(usdc).transferFrom(subsidyOperator, vaultV3, _subsidyAmt);
        }
    }

    function depositOffRamp(
        uint256 _depositAmt,
        uint256 _offRampAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
            IOpenEdenVaultTest(vaultV3).offRamp(_offRampAmt);
        }
    }

    function redeemOffRamp(
        uint256 _redeemAmt,
        uint256 _offRampAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).redeem(_redeemAmt, msg.sender);
            IOpenEdenVaultTest(vaultV3).offRamp(_offRampAmt);
        }
    }

    function depositOffRampQ(
        uint256 _depositAmt,
        uint256 _offRampAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
            IOpenEdenVaultTest(vaultV3).offRampQ(usdc, _offRampAmt);
        }
    }

    function depositProcessWithdrawalQueue(
        uint256 _depositAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).deposit(_depositAmt, msg.sender);
            IOpenEdenVaultTest(vaultV3).processWithdrawalQueue(0);
        }
    }

    function redeemProcessWithdrawalQueue(
        uint256 _redeemAmt,
        uint256 _num
    ) external {
        for (uint i = 0; i < _num; i++) {
            IOpenEdenVaultTest(vaultV3).redeem(_redeemAmt, msg.sender);
            IOpenEdenVaultTest(vaultV3).processWithdrawalQueue(0);
        }
    }
}
