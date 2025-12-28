// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AuthorizationManager
/// @notice Validates and tracks one-time withdrawal authorizations
contract AuthorizationManager {
    // EIP-712 domain separator components
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant WITHDRAW_TYPEHASH =
        keccak256(
            "Withdraw(address vault,address recipient,uint256 amount,uint256 nonce,uint256 chainId)"
        );

    address public immutable signer; // off-chain signer
    mapping(bytes32 => bool) public usedAuthorizations;
    bool private initialized;

    event AuthorizationUsed(bytes32 indexed authHash, address indexed vault, address indexed recipient, uint256 amount);

    constructor(address _signer, string memory name, string memory version) {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
        initialized = true;
    }

    /// @notice Ensure constructor-style init can't be re-run via proxies
    function isInitialized() external view returns (bool) {
        return initialized;
    }

    /// @notice Verify and consume a withdrawal authorization
    /// @param vault Vault address expected to call this
    /// @param recipient Recipient of funds
    /// @param amount Amount authorized
    /// @param nonce Unique authorization id
    /// @param v ECDSA v
    /// @param r ECDSA r
    /// @param s ECDSA s
    /// @return valid True if authorization is valid and now consumed
    function verifyAuthorization(
        address vault,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool valid) {
        // Bind to chain and vault
        bytes32 structHash = keccak256(
            abi.encode(
                WITHDRAW_TYPEHASH,
                vault,
                recipient,
                amount,
                nonce,
                block.chainid
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        bytes32 authHash = digest;
        require(!usedAuthorizations[authHash], "Authorization already used");

        address recovered = ecrecover(authHash, v, r, s);
        require(recovered != address(0) && recovered == signer, "Invalid signature");

        // Effects before interaction with vault
        usedAuthorizations[authHash] = true;
        emit AuthorizationUsed(authHash, vault, recipient, amount);

        return true;
    }
}
