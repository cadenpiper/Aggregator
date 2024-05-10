// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Token.sol";
import "./AMM.sol";

contract Aggregator is ReentrancyGuard {
	string public name;
	Token public token1;
	Token public token2;
	AMM public amm1;
	AMM public amm2;
	address public owner;

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
		owner = msg.sender;
	}

	// Determines how much of token1 to deposit with token2
    function calculateToken1Deposit(uint256 _token2Amount)
        public
        view
        returns (uint256 token1Amount)
    {
        token1Amount = (token1Balance * _token2Amount) / token2Balance;
    }

	// Determines how much of token2 to deposit with token1
    function calculateToken2Deposit(uint256 _token1Amount)
        public
        view
        returns (uint256 token2Amount)
    {
        token2Amount = (token2Balance * _token1Amount) / token1Balance;
    }

    function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {
        // Deposit Tokens
        require(
            token1.transferFrom(msg.sender, address(this), _token1Amount),
            "failed to transfer token 1"
        );
        require(
            token2.transferFrom(msg.sender, address(this), _token2Amount),
            "failed to transfer token 2"
        );

        // Issue Shares
        uint256 share;

        // If first time adding liquidity, make share 100
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

        // Manage Pool
        token1Balance += _token1Amount;
        token2Balance += _token2Amount;
        K = token1Balance * token2Balance;

        // Updates shares
        totalShares += share;
        shares[msg.sender] += share;
    }

	// Determines best token2 output with token1 input
	function getBestToken1Price(uint256 _token1Amount)
		public
		view
		returns (uint256, address)
	{
		uint256 token2OutputAmm1 = amm1.calculateToken1Swap(_token1Amount);
		uint256 token2OutputAmm2 = amm2.calculateToken1Swap(_token1Amount);

		if (token2OutputAmm1 > token2OutputAmm2) {
			return(token2OutputAmm1, address(amm1));
		} else {
			return(token2OutputAmm2, address(amm2));
		}
	}

	// Determines best token1 output with token2 input
	function getBestToken2Price(uint256 _token2Amount)
		public
		view
		returns (uint256, address)
	{
		uint256 token1OutputAmm1 = amm1.calculateToken2Swap(_token2Amount);
		uint256 token1OutputAmm2 = amm2.calculateToken2Swap(_token2Amount);

		if (token1OutputAmm1 > token1OutputAmm2) {
			return(token1OutputAmm1, address(amm1));
		} else {
			return(token1OutputAmm2, address(amm2));
		}
	}

	// Swaps token1 for best price --- receives token2
	function executeSwapToken1(uint256 _token1Amount)
		external
		returns (uint256, uint256)
	{
		(uint256 expectedToken2Output, address amm) = getBestToken1Price(_token1Amount);

		token1.approve(address(this), _token1Amount);
		token1.transferFrom(msg.sender, address(this), _token1Amount);

		if (amm == address(amm1)) {
			token1.approve(address(amm1), _token1Amount);
			uint256 token2Output = amm1.swapToken1(_token1Amount);
			token2.transfer(msg.sender, token2Output);
			return (expectedToken2Output, token2Output);
		} else {
			token1.approve(address(amm2), _token1Amount);
			uint256 token2Output = amm2.swapToken1(_token1Amount);
			token2.transfer(msg.sender, token2Output);
			return (expectedToken2Output, token2Output);
		}
	}

	// Swaps token1 for best price --- receives token2
	function executeSwapToken2(uint256 _token2Amount)
		external
		returns (uint256, uint256)
	{
		(uint256 expectedToken1Output, address amm) = getBestToken2Price(_token2Amount);

		token2.approve(address(this), _token2Amount);
		token2.transferFrom(msg.sender, address(this), _token2Amount);

		if (amm == address(amm1)) {
			token2.approve(address(amm1), _token2Amount);
			uint256 token1Output = amm1.swapToken2(_token2Amount);
			token1.transfer(msg.sender, token1Output);
			return (expectedToken1Output, token1Output);
		} else {
			token2.approve(address(amm2), _token2Amount);
			uint256 token1Output = amm2.swapToken2(_token2Amount);
			token1.transfer(msg.sender, token1Output);
			return (expectedToken1Output, token1Output);
		}
	}
}
