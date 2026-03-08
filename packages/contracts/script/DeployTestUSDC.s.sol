// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TestUSDC} from "../src/TestUSDC.sol";

/// @notice Deploy TestUSDC to Base Sepolia
/// Usage: forge script script/DeployTestUSDC.s.sol --rpc-url base-sepolia --broadcast
contract DeployTestUSDC is Script {
    function run() external {
        vm.startBroadcast();
        TestUSDC token = new TestUSDC();
        console.log("TestUSDC deployed at:", address(token));
        vm.stopBroadcast();
    }
}
