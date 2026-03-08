// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISablierLockup} from "./interfaces/ISablierLockup.sol";

/// @title RipGuardRouter
/// @notice Stateless fee-collecting wrapper around Sablier Lockup v2.0.
///         Never holds funds beyond a single transaction.
contract RipGuardRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    ISablierLockup public immutable LOCKUP;
    IERC20 public immutable TOKEN; // USDC only at launch
    address public immutable TREASURY; // audit fund wallet

    /// @dev 0.5% = 0.005 * 1e18 = 5e15
    uint256 public constant BROKER_FEE = 5e15;

    event RipGuardLockCreated(
        address indexed user,
        uint256 indexed streamId,
        uint128 totalAmount,
        uint40 cliffSeconds,
        uint40 totalSeconds
    );

    constructor(ISablierLockup lockup, IERC20 token, address treasury) {
        require(address(lockup) != address(0), "zero lockup");
        require(address(token) != address(0), "zero token");
        require(treasury != address(0), "zero treasury");

        LOCKUP = lockup;
        TOKEN = token;
        TREASURY = treasury;
    }

    /// @notice Create a non-cancelable, non-transferable linear lock via Sablier.
    /// @param totalAmount Total USDC including the 0.5% broker fee.
    /// @param cliffSeconds Cliff duration (0 for no cliff).
    /// @param totalSeconds Total vesting duration (must be > 0 and >= cliffSeconds).
    /// @param unlockStart Amount unlocked immediately at stream start.
    /// @param unlockCliff Amount unlocked at cliff.
    /// @return streamId The Sablier stream ID.
    function createLinearLock(
        uint128 totalAmount,
        uint40 cliffSeconds,
        uint40 totalSeconds,
        uint128 unlockStart,
        uint128 unlockCliff
    ) external nonReentrant returns (uint256 streamId) {
        require(totalAmount > 0, "amount=0");
        require(totalSeconds > 0 && totalSeconds >= cliffSeconds, "bad durations");
        require(uint256(unlockStart) + uint256(unlockCliff) <= totalAmount, "bad unlock");

        // Pull funds from user
        TOKEN.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Approve Sablier for totalAmount (deposit + broker fee)
        TOKEN.forceApprove(address(LOCKUP), totalAmount);

        ISablierLockup.CreateWithDurations memory p = ISablierLockup.CreateWithDurations({
            sender: msg.sender,
            recipient: msg.sender,
            totalAmount: totalAmount,
            token: TOKEN,
            cancelable: false,
            transferable: false,
            shape: "RipGuard",
            broker: ISablierLockup.Broker({account: TREASURY, fee: BROKER_FEE})
        });

        streamId = LOCKUP.createWithDurationsLL(
            p,
            ISablierLockup.UnlockAmounts({start: unlockStart, cliff: unlockCliff}),
            ISablierLockup.Durations({cliff: cliffSeconds, total: totalSeconds})
        );

        // Reset approval
        TOKEN.forceApprove(address(LOCKUP), 0);

        emit RipGuardLockCreated(msg.sender, streamId, totalAmount, cliffSeconds, totalSeconds);
    }
}
