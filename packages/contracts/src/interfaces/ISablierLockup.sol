// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal interface for Sablier Lockup v2.0 on Base.
interface ISablierLockup {
    struct Broker {
        address account;
        uint256 fee; // 1e18 = 100%
    }

    struct CreateWithDurations {
        address sender;
        address recipient;
        uint128 totalAmount; // deposit + broker fee
        IERC20 token;
        bool cancelable;
        bool transferable;
        string shape; // <= 32 bytes
        Broker broker;
    }

    struct UnlockAmounts {
        uint128 start;
        uint128 cliff;
    }

    struct Durations {
        uint40 cliff;
        uint40 total;
    }

    function createWithDurationsLL(
        CreateWithDurations calldata params,
        UnlockAmounts calldata unlockAmounts,
        Durations calldata durations
    ) external payable returns (uint256 streamId);
}
