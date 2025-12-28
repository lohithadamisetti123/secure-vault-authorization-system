# Secure Vault Authorization System

A production-grade multi-contract vault system demonstrating secure authorization flows, EIP-712 signed permissions, and single-use enforcement for Web3 applications.

## 🏗️ Architecture

The system consists of two smart contracts with clear separation of concerns:

### **AuthorizationManager.sol**
- Validates withdrawal permissions using EIP-712 typed signatures
- Tracks authorization consumption to prevent replay attacks
- Binds permissions to specific vault, chain, recipient, and amount
- Uses ecrecover for cryptographic signature verification

### **SecureVault.sol**
- Holds pooled native currency (ETH)
- Accepts deposits from any address
- Executes withdrawals only after authorization validation
- Maintains internal accounting of withdrawals per recipient

## 🔒 Security Features

- **Single-use authorizations**: Each signature can only be used once via nonce-based tracking
- **Context binding**: Authorizations are bound to vault address and chain ID
- **Reentrancy protection**: Follows checks-effects-interactions pattern
- **Signature verification**: Off-chain signed permissions verified on-chain
- **Initialization guards**: Prevents re-initialization of contracts
- **Balance protection**: Vault balance cannot go negative
- **Authorization scope**: Permissions strictly scoped to vault, recipient, amount, and nonce

## 📂 Repository Structure

```
/
├── contracts/
│   ├── AuthorizationManager.sol    # Permission validation & tracking
│   └── SecureVault.sol             # Fund custody & withdrawal execution
├── scripts/
│   └── deploy.js                   # Automated deployment script
├── tests/
│   └── system.spec.js              # Comprehensive test suite
├── docker/
│   ├── Dockerfile                  # Container configuration
│   └── entrypoint.sh               # Deployment automation
├── docker-compose.yml              # Multi-container orchestration
├── hardhat.config.js               # Hardhat configuration
├── package.json                    # Dependencies & scripts
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- Docker & docker-compose (for containerized deployment)
- Git

### Local Setup

```
# Clone repository
git clone https://github.com/lohithadamisetti123/secure-vault-authorization-system.git
cd secure-vault-authorization-system

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test
```

### Docker Deployment (Recommended)

The easiest way to run the complete system:

```
# Build and start blockchain + deploy contracts
docker-compose up --build

# View logs in real-time
docker-compose logs -f deployer

# In another terminal, check deployment info
cat deployments/local.json
```

This will:
1. Start a local Ganache blockchain on port 8545
2. Compile smart contracts
3. Deploy AuthorizationManager and SecureVault
4. Output deployment addresses to `deployments/local.json`
5. Keep containers running for interaction

**Expected Output:**
```
==============================================
DEPLOYMENT STARTED
==============================================
Deployer Address: 0x...
Network: localhost
Chain ID: 31337
==============================================

Deploying AuthorizationManager...
✓ AuthorizationManager deployed at: 0x...

Deploying SecureVault...
✓ SecureVault deployed at: 0x...

==============================================
DEPLOYMENT COMPLETED SUCCESSFULLY
==============================================
```

### Manual Deployment

```
# Terminal 1: Start local Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy

# Check deployment info
cat deployments/local.json
```

### Interacting with the Blockchain

The RPC endpoint is available at:
```
http://localhost:8545
```

You can connect using:
- Hardhat console: `npx hardhat console --network localhost`
- Web3.js or ethers.js scripts
- MetaMask (add custom network with RPC URL above)

## 🧪 Testing

The test suite covers:
- Contract initialization and immutability
- Deposit functionality and events
- Valid withdrawal authorization flow
- Replay attack prevention (single-use enforcement)
- Invalid signature rejection
- Insufficient balance handling
- Edge cases and failure modes

```
# Run all tests
npm run test

# Run with gas reporting
REPORT_GAS=true npm run test

# Run with coverage
npx hardhat coverage
```

**Expected output:**
```
  SecureVault Authorization System
    Initialization
      ✓ should initialize contracts correctly (XXms)
    Deposits
      ✓ should accept deposits and emit events (XXms)
      ✓ should reject zero deposits (XXms)
    Authorized Withdrawals
      ✓ should process valid withdrawal authorization (XXms)
      ✓ should reject reused authorization (replay protection) (XXms)
      ✓ should reject invalid signature (XXms)
      ✓ should reject withdrawal exceeding balance (XXms)

  7 passing (XXXms)
```

## 📝 Authorization Flow

### Overview

The system uses EIP-712 for structured, typed signing of authorization messages. This provides:
- Human-readable signatures in wallets
- Domain separation preventing signature reuse across different contracts
- Type safety for authorization parameters

### 1. Off-chain: Generate Signature

The authorized signer (set during AuthorizationManager deployment) creates a typed signature:

```
const { ethers } = require("ethers");

// Connect to provider
const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = await provider.getSigner(0); // First account

// Get deployed addresses from deployments/local.json
const authManagerAddress = "0x...";
const vaultAddress = "0x...";

// EIP-712 Domain
const domain = {
  name: "SecureVaultAuth",
  version: "1",
  chainId: 31337, // Ganache default
  verifyingContract: authManagerAddress
};

// EIP-712 Types
const types = {
  Withdraw: [
    { name: "vault", type: "address" },
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "chainId", type: "uint256" }
  ]
};

// Authorization data
const value = {
  vault: vaultAddress,
  recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Example recipient
  amount: ethers.parseEther("1.0"),
  nonce: 1, // Must be unique per authorization
  chainId: 31337
};

// Sign typed data
const signature = await signer.signTypedData(domain, types, value);
console.log("Signature:", signature);

// Split signature into v, r, s
const sig = ethers.Signature.from(signature);
console.log("v:", sig.v);
console.log("r:", sig.r);
console.log("s:", sig.s);
```

### 2. On-chain: Execute Withdrawal

Any address can submit the authorization to trigger the withdrawal:

```
// Get vault contract
const Vault = await ethers.getContractFactory("SecureVault");
const vault = Vault.attach(vaultAddress);

// Split signature
const sig = ethers.Signature.from(signature);

// Execute withdrawal
const tx = await vault.withdraw(
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // recipient
  ethers.parseEther("1.0"),                      // amount
  1,                                              // nonce
  sig.v,                                          // signature v
  sig.r,                                          // signature r
  sig.s                                           // signature s
);

await tx.wait();
console.log("Withdrawal successful!");
```

### 3. Flow Diagram

```
┌─────────────┐
│  Off-chain  │
│   Signer    │
└──────┬──────┘
       │
       │ 1. Signs typed data (EIP-712)
       │    - vault address
       │    - recipient
       │    - amount
       │    - nonce
       │    - chainId
       │
       ▼
┌─────────────────┐
│   Signature     │
│   (v, r, s)     │
└────────┬────────┘
         │
         │ 2. Submit to SecureVault
         │
         ▼
┌─────────────────┐      3. Verify      ┌──────────────────────┐
│  SecureVault    │◄──────────────────►│ AuthorizationManager │
│                 │                     │                      │
│  - Checks       │  4. Returns true    │  - Recovers signer   │
│  - Updates      │     if valid        │  - Checks nonce      │
│  - Transfers    │                     │  - Marks as used     │
└────────┬────────┘                     └──────────────────────┘
         │
         │ 5. Transfer ETH to recipient
         │
         ▼
┌─────────────────┐
│   Recipient     │
│   Receives ETH  │
└─────────────────┘
```

## 🔐 Security Considerations

### Replay Protection
Each authorization includes a unique `nonce`. Once used, the authorization hash is stored in `usedAuthorizations` mapping, preventing reuse.

### Context Binding
Authorizations are bound to:
- **Vault address**: Prevents use on different vault instances
- **Chain ID**: Prevents replay across different networks
- **Recipient**: Funds can only go to intended address
- **Amount**: Exact amount is enforced

### Signature Verification
The AuthorizationManager uses `ecrecover` to verify that the signature was created by the authorized signer address set during deployment.

### Checks-Effects-Interactions Pattern
The vault follows CEI pattern:
1. **Checks**: Validates authorization via AuthorizationManager
2. **Effects**: Updates `totalWithdrawn` mapping
3. **Interactions**: Transfers ETH to recipient

This prevents reentrancy attacks.

### Initialization Protection
Both contracts have `initialized` boolean that prevents re-initialization, protecting against proxy-based attacks.

## 📊 Contract Events

### AuthorizationManager Events

```
event AuthorizationUsed(
    bytes32 indexed authHash,
    address indexed vault,
    address indexed recipient,
    uint256 amount
);
```

### SecureVault Events

```
event Deposited(address indexed from, uint256 amount);
event Withdrawn(address indexed to, uint256 amount);
```

## 🛠️ Development Commands

```
# Compile contracts
npm run compile

# Run tests
npm run test

# Start local node
npm run node

# Deploy to local node
npm run deploy

# Run linter (if configured)
npm run lint

# Format code (if configured)
npm run format
```

## 📦 Deployment Information

After running `docker-compose up` or `npm run deploy`, check `deployments/local.json`:

```
{
  "network": "localhost",
  "chainId": "31337",
  "deployer": "0x...",
  "signer": "0x...",
  "authorizationManager": "0x...",
  "secureVault": "0x...",
  "timestamp": "2025-12-28T09:30:00.000Z"
}
```

## 🔍 Verification Steps

### 1. Verify Deployment
```
# Check if contracts are deployed
cat deployments/local.json

# Verify blockchain is running
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 2. Test Deposit
```
npx hardhat console --network localhost
```

```
const vault = await ethers.getContractAt("SecureVault", "VAULT_ADDRESS");
const [signer] = await ethers.getSigners();

// Deposit 1 ETH
const tx = await signer.sendTransaction({
  to: vault.address,
  value: ethers.parseEther("1")
});
await tx.wait();

// Check balance
const balance = await ethers.provider.getBalance(vault.address);
console.log("Vault balance:", ethers.formatEther(balance), "ETH");
```

### 3. Test Authorized Withdrawal
Use the code from "Authorization Flow" section above.

## 🐛 Troubleshooting

### Docker Issues

**Problem**: Containers fail to start
```
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose up --build
```

**Problem**: Port 8545 already in use
```
# Find process using port
netstat -ano | findstr :8545

# Kill process or change port in docker-compose.yml
```

### Deployment Issues

**Problem**: Deployment fails
- Check `deployer` container logs: `docker-compose logs deployer`
- Ensure blockchain container is healthy: `docker-compose ps`
- Verify `deployments` folder has write permissions

**Problem**: Tests fail
- Run `npm install` to ensure dependencies are installed
- Check Hardhat version compatibility
- Verify you're using Node.js v18+

## 📚 Additional Resources

- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Security Best Practices](https://docs.openzeppelin.com/contracts/4.x/)
- [Ethereum Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)

