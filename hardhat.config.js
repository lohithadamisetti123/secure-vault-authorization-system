import "@nomicfoundation/hardhat-toolbox";

export default {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://blockchain:8545"
    }
  }
};
