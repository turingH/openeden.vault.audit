// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./interfaces/IKycManager.sol";

contract KycManager is IKycManager, AccessControlUpgradeable, UUPSUpgradeable {
    event GrantKyc(address _investor, KycType _kycType);
    event RevokeKyc(address _investor, KycType _kycType);
    event Banned(address _investor, bool _status);
    event SetStrict(bool _status);

    mapping(address => User) public userList;
    bool public strictOn;

    // UPGRADE_ROLE: 0x9f3d5d22c4a6169a2df1a6fcfef2d23531d84d6822c2171fc3c3b307e8c9b164
    bytes32 public constant UPGRADE_ROLE = keccak256("UPGRADE_ROLE");

    // GRANT_ROLE:   0x43010b2b7c5fd837ab1091fd76bfa28d2be87e12752631b3a6f4718a61864d8f
    bytes32 public constant GRANT_ROLE = keccak256("GRANT_ROLE");

    // REVOKE_ROLE:  0x537a84e3dd8b4ff21fbb65a53f4158974b5e7261a6ae274c928fdc7e011a9b9d
    bytes32 public constant REVOKE_ROLE = keccak256("REVOKE_ROLE");

    // BAN_ROLE:     0xf5f7b4ab29de4404f775f791cc8dcbff2448fd0ec05c5bacc7bc0f2d90f4d65a
    bytes32 public constant BAN_ROLE = keccak256("BAN_ROLE");

    // UNBAN_ROLE:   0x8f87fbd1a23bfb18f1e0a2f2b1457a2e39e1f93780036fcdb3e5cc1f48e3a8b6
    bytes32 public constant UNBAN_ROLE = keccak256("UNBAN_ROLE");

    modifier onlyNonZeroAddress(address _investor) {
        require(_investor != address(0), "invalid address");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _granter,
        address _revoker,
        address _banner,
        address _unbanner
    ) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(UPGRADE_ROLE, _admin);
        _setupRole(GRANT_ROLE, _granter);
        _setupRole(REVOKE_ROLE, _revoker);
        _setupRole(BAN_ROLE, _banner);
        _setupRole(UNBAN_ROLE, _unbanner);
        strictOn = true;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADE_ROLE) {}

    /*//////////////////////////////////////////////////////////////
                          GRANT KYC
    //////////////////////////////////////////////////////////////*/
    function grantKycInBulk(
        address[] calldata _investors,
        KycType[] calldata _kycTypes
    ) external onlyRole(GRANT_ROLE) {
        require(_investors.length == _kycTypes.length, "invalid input");
        for (uint256 i = 0; i < _investors.length; i++) {
            _grantKyc(_investors[i], _kycTypes[i]);
        }
    }

    function _grantKyc(
        address _investor,
        KycType _kycType
    ) internal onlyNonZeroAddress(_investor) {
        require(
            KycType.US_KYC == _kycType || KycType.GENERAL_KYC == _kycType,
            "invalid kyc type"
        );
        userList[_investor].kycType = _kycType;
        emit GrantKyc(_investor, _kycType);
    }

    /*//////////////////////////////////////////////////////////////
                          REVOKE KYC
    //////////////////////////////////////////////////////////////*/
    function revokeKycInBulk(
        address[] calldata _investors
    ) external onlyRole(REVOKE_ROLE) {
        for (uint256 i = 0; i < _investors.length; i++) {
            _revokeKyc(_investors[i]);
        }
    }

    function _revokeKyc(
        address _investor
    ) internal onlyNonZeroAddress(_investor) {
        emit RevokeKyc(_investor, userList[_investor].kycType);
        userList[_investor].kycType = KycType.NON_KYC;
    }

    /*//////////////////////////////////////////////////////////////
                          BAN KYC
    //////////////////////////////////////////////////////////////*/
    function bannedInBulk(
        address[] calldata _investors
    ) external onlyRole(BAN_ROLE) {
        for (uint256 i = 0; i < _investors.length; i++) {
            _bannedInternal(_investors[i], true);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          UNBAN KYC
    //////////////////////////////////////////////////////////////*/
    function unBannedInBulk(
        address[] calldata _investors
    ) external onlyRole(UNBAN_ROLE) {
        for (uint256 i = 0; i < _investors.length; i++) {
            _bannedInternal(_investors[i], false);
        }
    }

    function _bannedInternal(
        address _investor,
        bool _status
    ) internal onlyNonZeroAddress(_investor) {
        userList[_investor].isBanned = _status;
        emit Banned(_investor, _status);
    }

    function setStrict(bool _status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        strictOn = _status;
        emit SetStrict(_status);
    }

    /*//////////////////////////////////////////////////////////////
                            USED BY INTERFACE
    //////////////////////////////////////////////////////////////*/
    function getUserInfo(
        address _investor
    ) external view returns (User memory user) {
        user = userList[_investor];
    }

    function onlyNotBanned(address _investor) external view {
        require(!userList[_investor].isBanned, "user is banned");
    }

    function onlyKyc(address _investor) external view {
        require(
            KycType.NON_KYC != userList[_investor].kycType,
            "not a kyc user"
        );
    }

    function isBanned(address _investor) external view returns (bool) {
        return userList[_investor].isBanned;
    }

    function isKyc(address _investor) external view returns (bool) {
        return KycType.NON_KYC != userList[_investor].kycType;
    }

    function isUSKyc(address _investor) external view returns (bool) {
        return KycType.US_KYC == userList[_investor].kycType;
    }

    function isNonUSKyc(address _investor) external view returns (bool) {
        return KycType.GENERAL_KYC == userList[_investor].kycType;
    }

    function isStrict() external view returns (bool) {
        return strictOn;
    }
}
