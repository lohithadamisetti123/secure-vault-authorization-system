// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthorizationManager.sol";

/// @title SecureVault
/// @notice Holds funds and executes authorized withdrawals
contract SecureVault {
    AuthorizationManager public immutable authManager;
    address public immutable owner;

    mapping(address => uint256) public totalWithdrawn;
    bool private initialized;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _authManager) {
        require(_authManager != address(0), "Invalid auth manager");
        authManager = AuthorizationManager(_authManager);
        owner = msg.sender;
        initialized = true;
    }

    receive() external payable {
        require(msg.value > 0, "Zero deposit");
        emit Deposited(msg.sender, msg.value);
    }

    function isInitialized() external view returns (bool) {
        return initialized;
    }

    /// @notice Execute an authorized withdrawal
    /// @dev Any caller can trigger it; permission comes from the signed authorization
    function withdraw(
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient vault balance");

        // 1. Ask AuthorizationManager to verify & consume
        bool ok = authManager.verifyAuthorization(
            address(this),
            recipient,
            amount,
            nonce,
            v,
            r,
            s
        );
        require(ok, "Authorization failed");

        // 2. Update internal accounting (effects)
        totalWithdrawn[recipient] += amount;

        // 3. Transfer value (interaction)
        (bool sent, ) = payable(recipient).call{value: amount}("");
        require(sent, "Transfer failed");

        emit Withdrawn(recipient, amount);
    }
}
