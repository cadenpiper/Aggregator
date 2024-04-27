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

	// Fetch best prices from AMMs
	function token2SwapBestPrice(uint256 _inputAmount)
		public
		view
		returns (uint256, address)
	{
		uint256 outputAmountAmm1 = amm1.calculateToken2Swap(_inputAmount);
		uint256 outputAmountAmm2 = amm2.calculateToken2Swap(_inputAmount);

		if (outputAmountAmm1 > outputAmountAmm2) {
			return (outputAmountAmm1, address(amm1));
		} else {
			return (outputAmountAmm2, address(amm2));
		} 
	}

	function token1SwapBestPrice(uint256 _inputAmount)
		public
		view
		returns (uint256, address)
	{
		uint256 outputAmountAmm1 = amm1.calculateToken1Swap(_inputAmount);
		uint256 outputAmountAmm2 = amm2.calculateToken1Swap(_inputAmount);

		if (outputAmountAmm1 > outputAmountAmm2) {
			return (outputAmountAmm1, address(amm1));
		} else {
			return (outputAmountAmm2, address(amm2));
		}
	}

}
