const { ethers, network } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("==============================================");
  console.log("DEPLOYMENT STARTED");
  console.log("==============================================");
  console.log("Deployer Address:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("==============================================\n");

  const signerAddress = deployer.address;

  console.log("Deploying AuthorizationManager...");
  const AuthorizationManager = await ethers.getContractFactory("AuthorizationManager");
  const authManager = await AuthorizationManager.deploy(
    signerAddress,
    "SecureVaultAuth",
    "1"
  );
  await authManager.waitForDeployment();

  const authAddress = await authManager.getAddress();
  console.log("✓ AuthorizationManager deployed at:", authAddress);
  console.log("");

  console.log("Deploying SecureVault...");
  const SecureVault = await ethers.getContractFactory("SecureVault");
  const vault = await SecureVault.deploy(authAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✓ SecureVault deployed at:", vaultAddress);
  console.log("");

  const info = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    signer: signerAddress,
    authorizationManager: authAddress,
    secureVault: vaultAddress,
    timestamp: new Date().toISOString()
  };

  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync("deployments/local.json", JSON.stringify(info, null, 2));

  console.log("==============================================");
  console.log("DEPLOYMENT COMPLETED SUCCESSFULLY");
  console.log("==============================================");
  console.log("Deployment info saved to: deployments/local.json");
  console.log("==============================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
