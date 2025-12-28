const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SecureVault Authorization System", function () {
  let authManager, vault, signer, user, recipient;
  let authAddress, vaultAddress;

  beforeEach(async function () {
    [signer, user, recipient] = await ethers.getSigners();

    const Auth = await ethers.getContractFactory("AuthorizationManager");
    authManager = await Auth.deploy(signer.address, "SecureVaultAuth", "1");
    await authManager.waitForDeployment();
    authAddress = await authManager.getAddress();

    const Vault = await ethers.getContractFactory("SecureVault");
    vault = await Vault.deploy(authAddress);
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();
  });

  describe("Initialization", function () {
    it("should initialize contracts correctly", async function () {
      expect(await authManager.isInitialized()).to.be.true;
      expect(await vault.isInitialized()).to.be.true;
      expect(await authManager.signer()).to.equal(signer.address);
      expect(await vault.authManager()).to.equal(authAddress);
    });
  });

  describe("Deposits", function () {
    it("should accept deposits and emit events", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await expect(
        signer.sendTransaction({
          to: vaultAddress,
          value: depositAmount
        })
      ).to.emit(vault, "Deposited")
        .withArgs(signer.address, depositAmount);

      expect(await ethers.provider.getBalance(vaultAddress)).to.equal(depositAmount);
    });

    it("should reject zero deposits", async function () {
      await expect(
        signer.sendTransaction({
          to: vaultAddress,
          value: 0
        })
      ).to.be.revertedWith("Zero deposit");
    });
  });

  describe("Authorized Withdrawals", function () {
    beforeEach(async function () {
      // Deposit funds
      await signer.sendTransaction({
        to: vaultAddress,
        value: ethers.parseEther("10")
      });
    });

    it("should process valid withdrawal authorization", async function () {
      const amount = ethers.parseEther("1");
      const nonce = 1n;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "SecureVaultAuth",
        version: "1",
        chainId,
        verifyingContract: authAddress
      };

      const types = {
        Withdraw: [
          { name: "vault", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "chainId", type: "uint256" }
        ]
      };

      const value = {
        vault: vaultAddress,
        recipient: recipient.address,
        amount,
        nonce,
        chainId
      };

      const sig = await signer.signTypedData(domain, types, value);
      const sigBytes = ethers.getBytes(sig);
      const r = ethers.hexlify(sigBytes.slice(0, 32));
      const s = ethers.hexlify(sigBytes.slice(32, 64));
      const v = sigBytes[64];

      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.changeEtherBalance(recipient, amount);

      expect(await vault.totalWithdrawn(recipient.address)).to.equal(amount);
    });

    it("should reject reused authorization (replay protection)", async function () {
      const amount = ethers.parseEther("1");
      const nonce = 2n;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "SecureVaultAuth",
        version: "1",
        chainId,
        verifyingContract: authAddress
      };

      const types = {
        Withdraw: [
          { name: "vault", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "chainId", type: "uint256" }
        ]
      };

      const value = {
        vault: vaultAddress,
        recipient: recipient.address,
        amount,
        nonce,
        chainId
      };

      const sig = await signer.signTypedData(domain, types, value);
      const sigBytes = ethers.getBytes(sig);
      const r = ethers.hexlify(sigBytes.slice(0, 32));
      const s = ethers.hexlify(sigBytes.slice(32, 64));
      const v = sigBytes[64];

      // First withdrawal succeeds
      await vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s);

      // Second attempt with same signature fails
      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.be.revertedWith("Authorization already used");
    });

    it("should reject invalid signature", async function () {
      const amount = ethers.parseEther("1");
      const nonce = 3n;
      
      // Use invalid signature components
      const v = 27;
      const r = ethers.hexlify(ethers.randomBytes(32));
      const s = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject withdrawal exceeding balance", async function () {
      const amount = ethers.parseEther("100"); // More than deposited
      const nonce = 4n;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "SecureVaultAuth",
        version: "1",
        chainId,
        verifyingContract: authAddress
      };

      const types = {
        Withdraw: [
          { name: "vault", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "chainId", type: "uint256" }
        ]
      };

      const value = {
        vault: vaultAddress,
        recipient: recipient.address,
        amount,
        nonce,
        chainId
      };

      const sig = await signer.signTypedData(domain, types, value);
      const sigBytes = ethers.getBytes(sig);
      const r = ethers.hexlify(sigBytes.slice(0, 32));
      const s = ethers.hexlify(sigBytes.slice(32, 64));
      const v = sigBytes[64];

      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.be.revertedWith("Insufficient vault balance");
    });

    it("should track multiple withdrawals correctly", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("2");
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "SecureVaultAuth",
        version: "1",
        chainId,
        verifyingContract: authAddress
      };

      const types = {
        Withdraw: [
          { name: "vault", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "chainId", type: "uint256" }
        ]
      };

      // First withdrawal
      const value1 = {
        vault: vaultAddress,
        recipient: recipient.address,
        amount: amount1,
        nonce: 5n,
        chainId
      };

      const sig1 = await signer.signTypedData(domain, types, value1);
      const sigBytes1 = ethers.getBytes(sig1);
      const r1 = ethers.hexlify(sigBytes1.slice(0, 32));
      const s1 = ethers.hexlify(sigBytes1.slice(32, 64));
      const v1 = sigBytes1[64];

      await vault.connect(user).withdraw(recipient.address, amount1, 5n, v1, r1, s1);

      // Second withdrawal
      const value2 = {
        vault: vaultAddress,
        recipient: recipient.address,
        amount: amount2,
        nonce: 6n,
        chainId
      };

      const sig2 = await signer.signTypedData(domain, types, value2);
      const sigBytes2 = ethers.getBytes(sig2);
      const r2 = ethers.hexlify(sigBytes2.slice(0, 32));
      const s2 = ethers.hexlify(sigBytes2.slice(32, 64));
      const v2 = sigBytes2[64];

      await vault.connect(user).withdraw(recipient.address, amount2, 6n, v2, r2, s2);

      expect(await vault.totalWithdrawn(recipient.address)).to.equal(
        amount1 + amount2
      );
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await signer.sendTransaction({
        to: vaultAddress,
        value: ethers.parseEther("10")
      });
    });

    it("should reject zero amount withdrawal", async function () {
      const amount = 0n;
      const nonce = 7n;
      
      const v = 27;
      const r = ethers.hexlify(ethers.randomBytes(32));
      const s = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.be.revertedWith("Invalid amount");
    });

    it("should reject zero address recipient", async function () {
      const amount = ethers.parseEther("1");
      const nonce = 8n;
      
      const v = 27;
      const r = ethers.hexlify(ethers.randomBytes(32));
      const s = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        vault.connect(user).withdraw(ethers.ZeroAddress, amount, nonce, v, r, s)
      ).to.be.revertedWith("Invalid recipient");
    });
  });
});
