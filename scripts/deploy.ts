import { ethers } from 'hardhat';

async function main() {
  const BattlePass = await ethers.getContractFactory('BattlePass');
  const battlePass = await BattlePass.deploy();

  await battlePass.deployed();

  console.log(`Battle pass deployed`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
