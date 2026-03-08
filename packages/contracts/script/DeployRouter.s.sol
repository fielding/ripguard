// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RipGuardRouter} from "../src/RipGuardRouter.sol";
import {ISablierLockup} from "../src/interfaces/ISablierLockup.sol";

contract DeployRouter is Script {
    // Base mainnet addresses
    address constant SABLIER_LOCKUP_BASE = 0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B;
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() public {
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();

        RipGuardRouter router = new RipGuardRouter(
            ISablierLockup(SABLIER_LOCKUP_BASE),
            IERC20(USDC_BASE),
            treasury
        );

        console.log("RipGuardRouter deployed at:", address(router));
        console.log("Treasury:", treasury);

        vm.stopBroadcast();
    }
}
