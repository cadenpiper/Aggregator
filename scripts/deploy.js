const hre = require("hardhat");

async function main() {
  // Deploy tokens
  const Token = await hre.ethers.getContractFactory('Token')

  let token1 = await Token.deploy('Token1', 'TKN1', '1000000')
  await token1.deployed()
  console.log(`\nToken1 address: ${token1.address}`)
  let token2 = await Token.deploy('Token2', 'TKN2', '1000000')
  await token2.deployed()
  console.log(`\nToken2 address: ${token2.address}\n`)

  // Deploy AMMs
  const AMM = await hre.ethers.getContractFactory('AMM')

  let amm1 = await AMM.deploy('Amm1', token1.address, token2.address)
  await amm1.deployed()
  console.log(`Amm1 address: ${amm1.address}\n`)
  let amm2 = await AMM.deploy('Amm2', token1.address, token2.address)
  await amm2.deployed()
  console.log(`Amm2 address: ${amm2.address}\n`)

  // Deploy aggregator
  const Aggregator = await hre.ethers.getContractFactory('Aggregator')

  let aggregator = await Aggregator.deploy(
    'Aggregator',
    token1.address,
    token2.address,
    amm1.address,
    amm2.address,
  )
  await aggregator.deployed()
  console.log(`Aggregator address: ${aggregator.address}\n`)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
