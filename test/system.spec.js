import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

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

      await vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s);

      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.be.revertedWith("Authorization already used");
    });

    it("should reject invalid signature", async function () {
      const amount = ethers.parseEther("1");
      const nonce = 3n;
      
      const v = 27;
      const r = ethers.hexlify(ethers.randomBytes(32));
      const s = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        vault.connect(user).withdraw(recipient.address, amount, nonce, v, r, s)
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject withdrawal exceeding balance", async function () {
      const amount = ethers.parseEther("100");
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
  });
});
