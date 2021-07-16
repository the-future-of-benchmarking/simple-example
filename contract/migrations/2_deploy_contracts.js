var BenchMark = artifacts.require("./BenchMark.sol");
const Web3 = require('web3');

module.exports = function(deployer) {
  deployer.deploy(BenchMark, '0x0000000000000000000000000000000000000000000000000000000054455354',
  '0x0',
  '0x2b5e3af16b1880000',
  '0x0000000000000000000000000000000000000000000000004d696f2e20e282ac',
  '0x0000000000000000000000000000000000000000000000000000000054455354',
  '0xaf64',
  '0xdd',
  '0xbec9',
  '0x30',
  '0xe');
};
