const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens
const shares = ether

describe('Aggregator', () => {
	let token1,
			token2,
			amm1,
			amm2

	let accounts,
			deployer,
			liquidityProvider

	beforeEach(async () => {
		// Setup accounts
		accounts = await ethers.getSigners()
		deployer = accounts[0]
		liquidityProvider = accounts[1]

		// Deploy contracts
		const Token = await ethers.getContractFactory('Token')
		const AMM = await ethers.getContractFactory('AMM')
		const Aggregator = await ethers.getContractFactory('Aggregator')

		token1 = await Token.deploy('Honey Token', 'HNY', '1000000')
		await token1.deployed()
		token2 = await Token.deploy('USD Token', 'USD', '1000000')
		await token2.deployed()

		amm1 = await AMM.deploy('Sunflower AMM', token1.address, token2.address)
		await amm1.deployed()
		amm2 = await AMM.deploy('Clover AMM', token1.address, token2.address)
		await amm2.deployed()

		// Send tokens to liquidity provider
		let transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(200000))
		await transaction.wait()
		transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(200000))
		await transaction.wait()

		aggregator = await Aggregator.deploy(
			'Hive Aggregator',
			token1.address,
			token2.address,
			amm1.address,
			amm2.address
		)
		await aggregator.deployed()
	})

	describe('Deployment', () => {
		const decimals = '18'
		const totalSupply = tokens(1000000)
		
		it('has correct names', async () => {
			expect(await token1.name()).to.equal('Honey Token')
			expect(await token2.name()).to.equal('USD Token')
			expect(await amm1.name()).to.equal('Sunflower AMM')
			expect(await amm2.name()).to.equal('Clover AMM')
			expect(await aggregator.name()).to.equal('Hive Aggregator')
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

		it('tracks token addresses', async () => {
			expect(await amm1.token1()).to.equal(token1.address)
			expect(await amm1.token2()).to.equal(token2.address)
			expect(await amm2.token1()).to.equal(token1.address)
			expect(await amm2.token2()).to.equal(token2.address)
			expect(await aggregator.token1()).to.equal(token1.address)
			expect(await aggregator.token2()).to.equal(token2.address)
		})

		it('tracks amm addresses', async () => {
			expect(await aggregator.amm1()).to.equal(amm1.address)
			expect(await aggregator.amm2()).to.equal(amm2.address)
		})
	})

	describe('AMM Liquidity', () => {
		let amount, transaction

		beforeEach(async () => {
			amount = tokens(100000)
			amount1 = tokens(100)

			// Liquidity provider approves tokens for amm1 & amm2
			transaction = await token1.connect(liquidityProvider).approve(amm1.address, amount)
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm1.address, amount)
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm2.address, amount)
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm2.address, amount)
			await transaction.wait()

			// Liquidity provider adds liquidity for amm1 & amm2
			transaction = await amm1.connect(liquidityProvider).addLiquidity(amount, amount)
			await transaction.wait()
			transaction = await amm2.connect(liquidityProvider).addLiquidity(amount, amount)
			await transaction.wait()
		})

		it('approves and adds liquidity for both AMMs', async () => {
			expect(await token1.balanceOf(amm1.address)).to.equal(amount)
			expect(await token2.balanceOf(amm1.address)).to.equal(amount)
			expect(await token1.balanceOf(amm2.address)).to.equal(amount)
			expect(await token2.balanceOf(amm2.address)).to.equal(amount)
		})

		it('tracks user shares', async () => {
			expect(await amm1.shares(liquidityProvider.address)).to.equal(tokens(100))
			expect(await amm2.shares(liquidityProvider.address)).to.equal(tokens(100))
		})
	})

	describe('Fetching Best Swap Prices', () => {
		let amount,
				amount1

		beforeEach(async () => {
			amount = tokens(250)
			amount1 = tokens(500)

			// Liquidity provider approves tokens for amm1 & amm2
			transaction = await token1.connect(liquidityProvider).approve(amm1.address, amount)
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm1.address, amount1)
			await transaction.wait()
			transaction = await token1.connect(liquidityProvider).approve(amm2.address, amount1)
			await transaction.wait()
			transaction = await token2.connect(liquidityProvider).approve(amm2.address, amount)
			await transaction.wait()

			// Liquidity provider adds liquidity for amm1 & amm2
			transaction = await amm1.connect(liquidityProvider).addLiquidity(amount, amount1)
			await transaction.wait()
			transaction = await amm2.connect(liquidityProvider).addLiquidity(amount1, amount)
			await transaction.wait()
		})

		it('calculates best price and amm for token2 swap', async () => {
			let [token2BestSwapPrice, bestAmm] = await aggregator.token2SwapBestPrice(amount)

			// token2 liquidity for amm1 & amm2
			expect(await amm1.token2Balance()).to.equal(tokens(500))
			expect(await amm2.token2Balance()).to.equal(tokens(250))

			console.log(`Best token2 swap price: ${ethers.utils.formatEther(token2BestSwapPrice)}`)
			expect(await token2BestSwapPrice).to.equal(tokens(250))

			if (await bestAmm === amm1.address) {
				console.log(`Best token2 swap price at: ${await amm1.name()}`)
			} else {
				console.log(`Best token2 swap price at: ${await amm2.name()}`)
			}
		})

		it('calculates best price and amm for token1 swap', async () => {
			let [token1BestSwapPrice, bestAmm] = await aggregator.token1SwapBestPrice(amount)

			// token1 liquidity for amm1 & amm2
			expect(await amm1.token2Balance()).to.equal(tokens(500))
			expect(await amm2.token2Balance()).to.equal(tokens(250))

			console.log(`Best token1 swap price: ${ethers.utils.formatEther(token1BestSwapPrice)}`)
			expect(await token1BestSwapPrice).to.equal(tokens(250))

			if (await bestAmm === amm1.address) {
				console.log(`Best token1 swap price at: ${await amm1.name()}`)
			} else {
				console.log(`Best token1 swap price at: ${await amm1.name()}`)
			}
		})
	})

})
