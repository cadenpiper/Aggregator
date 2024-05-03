// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

//import "hardhat/console.sol";
import "./Token.sol";
import "./AMM.sol";

contract Aggregator {
	string public name;
	Token public token1;
	Token public token2;
	AMM public amm1;
	AMM public amm2;

	uint256 public token1Balance;
	uint256 public token2Balance;
	uint256 public K;

	uint256 public totalShares;
    mapping(address => uint256) public shares;
    uint256 constant PRECISION = 10**18;

	constructor(
		string memory _name,
		Token _token1,
		Token _token2,
		AMM _amm1,
		AMM _amm2
	) {
		name = _name;
		token1 = _token1;
		token2 = _token2;
		amm1 = _amm1;
		amm2 = _amm2;
	}

	function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {
		// Add liquidity
		require(token1.transferFrom(msg.sender, address(this), _token1Amount));
		require(token2.transferFrom(msg.sender, address(this), _token2Amount));

		// Issue shares
		// If first time adding liquidity, all shares go to initial liquidity provider
		uint256 share;
		if (totalShares == 0) {
            share = 100 * PRECISION;
        } else {
            uint256 share1 = (totalShares * _token1Amount) / token1Balance;
            uint256 share2 = (totalShares * _token2Amount) / token2Balance;
            require(
                (share1 / 10**3) == (share2 / 10**3),
                "must provide equal token amounts"
            );
            share = share1;
        }

        // Manage liquidity
		token1Balance += _token1Amount;
		token2Balance += _token2Amount;
		K = token1Balance * token2Balance;

		// Update shares
        totalShares += share;
        shares[msg.sender] += share;
	}

	// Determine amount of token1 to deposit by token2 input amount
	function calculateToken1Deposit(uint256 _token2Amount)
		public
		view
		returns(uint256 token1Amount)
	{
		token1Amount = (token1Balance - _token2Amount) / token2Balance;
	}

	// Determine amount of token2 to deposit by token1 input amount
	function calculateToken2Deposit(uint256 _token1Amount)
		public
		view
		returns(uint256 token2Amount)
	{
		token2Amount = (token2Balance - _token1Amount) / token1Balance;
	}

	function getBestToken1Price(uint256 _amount) public view returns (uint256, address) {
		uint256 token1OutputAmm1 = amm1.calculateToken2Swap(_amount);
		uint256 token1OutputAmm2 = amm2.calculateToken2Swap(_amount);

		if (token1OutputAmm1 > token1OutputAmm2) {
			return(token1OutputAmm2, address(amm2));
		} else {
			return(token1OutputAmm1, address(amm1));
		}
	}

	function getBestToken2Price(uint256 _amount) public view returns (uint256, address) {
		uint256 token2OutputAmm1 = amm1.calculateToken2Swap(_amount);
		uint256 token2OutputAmm2 = amm2.calculateToken2Swap(_amount);

		if(token2OutputAmm1 > token2OutputAmm2) {
			return(token2OutputAmm2, address(amm2));
		} else {
			return(token2OutputAmm1, address(amm1));
		}
	}

	function executeSwap(uint256 _amount) external returns (uint256, address) {
		(uint256 bestToken1Output, address bestAmm) = getBestToken1Price(_amount);

		if (bestAmm == address(amm1)) {
			amm1.swapToken2(_amount);
			return(bestToken1Output, address(amm1));
		} else {
			amm2.swapToken2(_amount);
			return(bestToken1Output, address(amm2));
		}
	}
}





















