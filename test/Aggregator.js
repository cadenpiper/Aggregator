const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Aggregator', () => {
	let token1,
			token2,
			amm1

	beforeEach(async () => {
		// Deploy contracts
		const Token = await ethers.getContractFactory('Token')
		const AMM = await ethers.getContractFactory('AMM')

		token1 = await Token.deploy('Honey Token', 'HNY', '1000000')
		await token1.deployed()
		token2 = await Token.deploy('USD Token', 'USD', '1000000')
		await token2.deployed()

		amm1 = await AMM.deploy('Sunflower AMM', token1.address, token2.address)
		await amm1.deployed()
		amm2 = await AMM.deploy('Clover AMM', token1.address, token2.address)
		await amm2.deployed()

	})

	describe('Deployment', () => {
		const decimals = '18'
		const totalSupply = tokens(1000000)
		
		it('has correct names', async () => {
			expect(await token1.name()).to.equal('Honey Token')
			expect(await token2.name()).to.equal('USD Token')
			expect(await amm1.name()).to.equal('Sunflower AMM')
			expect(await amm2.name()).to.equal('Clover AMM')
		})

		it('has correct symbols', async () => {
			expect(await token1.symbol()).to.equal('HNY')
			expect(await token2.symbol()).to.equal('USD')
		})

		it('has correct decimals', async () => {
			expect(await token1.decimals(), token2.decimals()).to.equal(decimals)
		})

		it('has correct totalSupply', async () => {
			expect(await token1.totalSupply(), token2.totalSupply()).to.equal(totalSupply)
		})
	})

})
