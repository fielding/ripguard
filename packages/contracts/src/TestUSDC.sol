// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestUSDC — mintable mock for Base Sepolia testing
/// @notice Anyone can mint. DO NOT use in production.
contract TestUSDC is ERC20 {
    constructor() ERC20("Test USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint test tokens to any address. No restrictions.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Convenience: mint 10,000 USDC to caller.
    function faucet() external {
        _mint(msg.sender, 10_000e6);
    }
}
