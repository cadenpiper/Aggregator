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

	let transaction

	beforeEach(async () => {
		// Set up accounts
		accounts = await ethers.getSigners()
		deployer = accounts[0]
		liquidityProvider = accounts[1]
		investor1 = accounts[2]

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

    // Deploy aggregator contract
    const Aggregator = await ethers.getContractFactory('Aggregator')
    aggregator = await Aggregator.deploy(
    	'aggregator',
    	token1.address,
    	token2.address,
    	amm1.address,
    	amm2.address
    )
    await aggregator.deployed()

    // Transfer tokens to users
    // Liquidity provider
    transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(400000))
    await transaction.wait()
    transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(400000))
    await transaction.wait()
    // Investor #1
    transaction = await token1.connect(deployer).transfer(investor1.address, tokens(400000))
    await transaction.wait()
    transaction = await token2.connect(deployer).transfer(investor1.address, tokens(400000))
    await transaction.wait()
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

	describe('Calculating Deposits', () => {
		let transaction

		beforeEach(async () => {
			// Liquidity provider approves tokens
			transaction = await token1.connect(liquidityProvider).approve(amm1.address, tokens(5000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm1.address, tokens(5000))
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm2.address, tokens(5000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm2.address, tokens(5000))
			await transaction.wait()

			// Liquidity provider adds liquidity to both amms
			transaction = await amm1.connect(liquidityProvider).addLiquidity(tokens(250), tokens(750))
			await transaction.wait()
			transaction = await amm2.connect(liquidityProvider).addLiquidity(tokens(750), tokens(250))
			await transaction.wait()
		})

		it('calculates best token1 deposit output', async () => {
			const[outputAmount, amm] = await aggregator.calculateBestToken1Deposit(tokens(200))
			expect(amm).to.equal(amm2.address)
		})

		it('calculates best token2 deposit output', async () => {
			const[outputAmount, amm] = await aggregator.calculateBestToken2Deposit(tokens(200))
			expect(amm).to.equal(amm1.address)
		})
	})

	describe('Calculating Swap Prices', () => {
		let transaction

		beforeEach(async () => {
			// Liquidity provider approves tokens for AMMs
			transaction = await token1.connect(liquidityProvider).approve(amm1.address, tokens(20000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm1.address, tokens(20000))
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm2.address, tokens(20000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm2.address, tokens(20000))
			await transaction.wait()

			// Liquidity provider adds liquidity for both AMMs
			transaction = await amm1.connect(liquidityProvider).addLiquidity(tokens(5000), tokens(5000))
			await transaction.wait()
			transaction = await amm2.connect(liquidityProvider).addLiquidity(tokens(1000), tokens(5000))
			await transaction.wait()
		})

		it('gets best token2 price and amm', async () => {
			const token2OutputAmm1 = await amm1.calculateToken1Swap(tokens(100))
			const token2OutputAmm2 = await amm2.calculateToken1Swap(tokens(100))

			const[bestToken2Output, bestAmm] = await aggregator.getBestToken1Price(tokens(100))

			/*console.log(`AMM1 token2 output: ${ethers.utils.formatEther(token2OutputAmm1)}`)
			console.log(`AMM2 token2 output: ${ethers.utils.formatEther(token2OutputAmm2)}`)
			
			console.log(`Best token2 output: ${ethers.utils.formatEther(bestToken2Output)}`)
			console.log(`Corresponding AMM: ${bestAmm}`)*/
		})

		it('gets best token1 price and amm', async () => {
			const token1OutputAmm1 = await amm1.calculateToken2Swap(tokens(100))
			const token1OutputAmm2 = await amm2.calculateToken2Swap(tokens(100))

			const[bestToken1Output, bestAmm] = await aggregator.getBestToken2Price(tokens(100))

			/*console.log(`AMM1 token1 output: ${ethers.utils.formatEther(token1OutputAmm1)}`)
			console.log(`AMM2 token1 output: ${ethers.utils.formatEther(token1OutputAmm2)}`)
			
			console.log(`Best token1 output: ${ethers.utils.formatEther(bestToken1Output)}`)
			console.log(`Corresponding AMM: ${bestAmm}`)*/
		})
	})

	describe('Adding Liquidity', () => {
		let transaction

		beforeEach(async () => {
			// Liqudity provider approves tokens for aggregator
			transaction = await token1.connect(liquidityProvider).approve(aggregator.address, tokens(500))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(aggregator.address, tokens(500))
			await transaction.wait()
		})

		it('adds liquidity', async () => {
			// amm1 balances before adding liquidity
			const amm1Token1BalanceBefore = await amm1.token1Balance()
			const amm1Token2BalanceBefore = await amm1.token2Balance()

			// Add liquidity
			transaction = await aggregator.connect(liquidityProvider).addLiquidity(tokens(500), tokens(500))
			await transaction.wait()

			// amm2 balances after adding liquidity
			const amm1Token1BalanceAfter = await amm1.token1Balance()
			const amm1Token2BalanceAfter = await amm1.token2Balance()

			expect(amm1Token1BalanceAfter).to.be.gt(amm1Token1BalanceBefore)
			expect(amm1Token2BalanceAfter).to.be.gt(amm1Token2BalanceBefore)
		})
	})

	describe('Swapping Tokens', () => {
		let transaction

		beforeEach(async () => {
			// Liquidity provider approves tokens for aggregator and AMMs
			transaction = await token1.connect(liquidityProvider).approve(aggregator.address, tokens(100000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(aggregator.address, tokens(100000))
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm1.address, tokens(100000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm1.address, tokens(100000))
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm2.address, tokens(100000))
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm2.address, tokens(100000))
			await transaction.wait()

			// Liquidity provider adds liquidity to aggregator and AMMs
			transaction = await amm1.connect(liquidityProvider).addLiquidity(tokens(10000), tokens(50000))
			await transaction.wait()
			transaction = await amm2.connect(liquidityProvider).addLiquidity(tokens(50000), tokens(10000))
			await transaction.wait()

			// Investor #1 approves aggregator and AMMs to spend tokens
			transaction = await token1.connect(investor1).approve(aggregator.address, tokens(10000))
			await transaction.wait()
			transaction = await token2.connect(investor1).approve(aggregator.address, tokens(10000))
			await transaction.wait()
			transaction = await token1.connect(investor1).approve(amm1.address, tokens(10000))
			await transaction.wait()
			transaction = await token2.connect(investor1).approve(amm1.address, tokens(10000))
			await transaction.wait()
			transaction = await token1.connect(investor1).approve(amm2.address, tokens(10000))
			await transaction.wait()
			transaction = await token2.connect(investor1).approve(amm2.address, tokens(10000))
			await transaction.wait()
		})

		it('swaps token1 for best price', async () => {
			// Locate amm with best swap price for token1
			const [output, amm] = await aggregator.getBestToken1Price(tokens(500))
			expect(await amm).to.equal(amm1.address)

			// Check amm1 balance before swapping
			const amm1BalanceBefore = await amm1.token1Balance()

			// Swap tokens
			transaction = await aggregator.connect(investor1).executeSwapToken1(tokens(500))
			await transaction.wait()

			// Check amm1 balance after swapping
			const amm1BalanceAfter = await amm1.token1Balance()
			expect(amm1BalanceAfter).to.be.gt(amm1BalanceBefore)
		})

		it('swaps token2 for best price', async () => {
			// Locate amm with best swap price for token2
			const [output, amm] = await aggregator.getBestToken2Price(tokens(500))
			expect(await amm).to.equal(amm2.address)

			// Check amm2 balance before swapping
			const amm2BalanceBefore = await amm2.token2Balance()

			// Swap tokens
			transaction = await aggregator.connect(investor1).executeSwapToken2(tokens(500))
			await transaction.wait()

			// Check amm2 balance after swapping
			const amm2BalanceAfter = await amm2.token2Balance()
			expect(amm2BalanceAfter).to.be.gt(amm2BalanceBefore)
		})
	})
	
})
