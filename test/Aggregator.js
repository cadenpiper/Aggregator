const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens
const shares = ether

describe('Aggregator', () => {
	let accounts,
			deployer,
			liquidityProvider,
			investor1

	let token1,
			token2,
			amm1,
			amm2,
			aggregator

	beforeEach(async () => {
		// Set up accounts
		accounts = await ethers.getSigners()
		deployer = accounts[0]
		liquidityProvider = accounts[1]

		// Deploy token contracts
		const Token = await ethers.getContractFactory('Token')
		token1 = await Token.deploy('token1', 'TKN1', '1000000')
		await token1.deployed()
		token2 = await Token.deploy('token2', 'TKN2', '1000000')
		await token2.deployed()

    // Deploy amm contracts
    const AMM = await ethers.getContractFactory('AMM')
    amm1 = await AMM.deploy('amm1', token1.address, token2.address)
    await amm1.deployed()
    amm2 = await AMM.deploy('amm2', token1.address, token2.address)
    await amm2.deployed()

    // Deploy aggregator
    const Aggregator = await ethers.getContractFactory('Aggregator')
    aggregator = await Aggregator.deploy(
    	'aggregator',
    	token1.address,
    	token2.address,
    	amm1.address,
    	amm2.address
    )
    await aggregator.deployed()
	})

	describe('Deployment', () => {
		it('has correct name', async () => {
			expect(await aggregator.name()).to.equal('aggregator')
		})

		it('tracks token addresses', async () => {
			expect(await aggregator.token1()).to.equal(token1.address)
			expect(await aggregator.token2()).to.equal(token2.address)
		})

		it('tracks amm addresses', async () => {
			expect(await aggregator.amm1()).to.equal(amm1.address)
			expect(await aggregator.amm2()).to.equal(amm2.address)
		})
	})

	describe('Liquidity', () => {
		let transaction

		beforeEach(async () => {
			// Transfer tokens to liquidity provider to provide liquidity
			transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(10000))
			await transaction.wait()
			transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(10000))
			await transaction.wait()

			// Approve tokens
			transaction = await token1.connect(liquidityProvider).approve(aggregator.address, tokens(10000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(aggregator.address, tokens(10000))
			await transaction.wait()

			// Add liquidity
			transaction = await aggregator.connect(liquidityProvider).addLiquidity(tokens(500), tokens(500))
			await transaction.wait()
		})

		it('receives liquidity', async () => {
			expect(await token1.balanceOf(liquidityProvider.address)).to.equal(tokens(9500))
			expect(await token1.allowance(liquidityProvider.address, aggregator.address)).to.equal(tokens(9500))

			expect(await aggregator.token1Balance()).to.equal(tokens(500))
			expect(await aggregator.token2Balance()).to.equal(tokens(500))
		})

		it('calculates shares', async () => {
			expect(await aggregator.shares(liquidityProvider.address)).to.equal(tokens(100))
			expect(await aggregator.totalShares()).to.equal(tokens(100))
		})

		it('calculates deposits', async () => {
			expect(await aggregator.calculateToken1Deposit(tokens(500)))
			expect(await aggregator.calculateToken2Deposit(tokens(500)))
		})
	})

	describe('Calculating Swap Prices', () => {
		let transaction

		beforeEach(async () => {
			
			transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(10000))
			await transaction.wait()
			transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(10000))
			await transaction.wait()

			transaction = await token1.connect(liquidityProvider).approve(amm1.address, tokens(1000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm1.address, tokens(1000))
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm2.address, tokens(1000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm2.address, tokens(1000))
			await transaction.wait()

			transaction = await amm1.connect(liquidityProvider).addLiquidity(tokens(500), tokens(1000))
			await transaction.wait()
			transaction = await amm2.connect(liquidityProvider).addLiquidity(tokens(1000), tokens(500))
			await transaction.wait()
		})

		it('gets best token1 price and amm', async () => {
			const[bestToken1Output, bestAmm] = await aggregator.getBestToken1Price(tokens(100))

			expect(await bestToken1Output).to.be.gt(0)
			expect(await bestAmm).to.not.be.null
		})

		it('gets best token2 price and amm', async () => {
			const[bestToken2Output, bestAmm] = await aggregator.getBestToken2Price(tokens(100))

			expect(await bestToken2Output).to.be.gt(0)
			expect(await bestAmm).to.not.be.null
		})
	})
	
})
