// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RipGuardRouter} from "../src/RipGuardRouter.sol";
import {ISablierLockup} from "../src/interfaces/ISablierLockup.sol";

/// @dev Mock Sablier that records calls and returns a stream ID.
contract MockSablierLockup {
    uint256 public nextStreamId = 1;

    address public lastSender;
    address public lastRecipient;
    uint128 public lastTotalAmount;
    address public lastToken;
    bool public lastCancelable;
    bool public lastTransferable;
    address public lastBrokerAccount;
    uint256 public lastBrokerFee;
    uint128 public lastUnlockStart;
    uint128 public lastUnlockCliff;
    uint40 public lastCliffDuration;
    uint40 public lastTotalDuration;

    function createWithDurationsLL(
        ISablierLockup.CreateWithDurations calldata params,
        ISablierLockup.UnlockAmounts calldata unlockAmounts,
        ISablierLockup.Durations calldata durations
    ) external payable returns (uint256 streamId) {
        // Pull the deposit from the router (simulates Sablier behavior)
        IERC20(params.token).transferFrom(msg.sender, address(this), params.totalAmount);

        lastSender = params.sender;
        lastRecipient = params.recipient;
        lastTotalAmount = params.totalAmount;
        lastToken = address(params.token);
        lastCancelable = params.cancelable;
        lastTransferable = params.transferable;
        lastBrokerAccount = params.broker.account;
        lastBrokerFee = params.broker.fee;
        lastUnlockStart = unlockAmounts.start;
        lastUnlockCliff = unlockAmounts.cliff;
        lastCliffDuration = durations.cliff;
        lastTotalDuration = durations.total;

        streamId = nextStreamId++;
    }
}

/// @dev Minimal ERC20 for testing.
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract RipGuardRouterTest is Test {
    RipGuardRouter public router;
    MockSablierLockup public mockLockup;
    MockUSDC public usdc;
    address public treasury = makeAddr("treasury");
    address public user = makeAddr("user");

    function setUp() public {
        mockLockup = new MockSablierLockup();
        usdc = new MockUSDC();
        router = new RipGuardRouter(
            ISablierLockup(address(mockLockup)),
            IERC20(address(usdc)),
            treasury
        );

        // Fund user
        usdc.mint(user, 100_000e6);
    }

    function test_createLinearLock_basic() public {
        uint128 amount = 1000e6; // 1000 USDC

        vm.startPrank(user);
        usdc.approve(address(router), amount);
        uint256 streamId = router.createLinearLock(amount, 7 days, 30 days, 0, 0);
        vm.stopPrank();

        assertEq(streamId, 1);
        assertEq(mockLockup.lastTotalAmount(), amount);
        assertEq(mockLockup.lastSender(), user);
        assertEq(mockLockup.lastRecipient(), user);
        assertFalse(mockLockup.lastCancelable());
        assertFalse(mockLockup.lastTransferable());
        assertEq(mockLockup.lastBrokerAccount(), treasury);
        assertEq(mockLockup.lastBrokerFee(), 5e15);
        assertEq(mockLockup.lastCliffDuration(), uint40(7 days));
        assertEq(mockLockup.lastTotalDuration(), uint40(30 days));
    }

    function test_createLinearLock_lumpSum() public {
        uint128 amount = 500e6;

        vm.startPrank(user);
        usdc.approve(address(router), amount);
        // Lump sum: unlock everything at cliff = total
        uint256 streamId = router.createLinearLock(amount, 30 days, 30 days, 0, amount);
        vm.stopPrank();

        assertEq(streamId, 1);
        assertEq(mockLockup.lastUnlockCliff(), amount);
        assertEq(mockLockup.lastCliffDuration(), uint40(30 days));
    }

    function test_revert_zeroAmount() public {
        vm.prank(user);
        vm.expectRevert("amount=0");
        router.createLinearLock(0, 0, 30 days, 0, 0);
    }

    function test_revert_badDurations() public {
        vm.prank(user);
        vm.expectRevert("bad durations");
        router.createLinearLock(100e6, 30 days, 7 days, 0, 0); // cliff > total
    }

    function test_revert_badUnlock() public {
        vm.prank(user);
        vm.expectRevert("bad unlock");
        router.createLinearLock(100e6, 0, 30 days, 60e6, 60e6); // unlockStart + unlockCliff > totalAmount
    }

    function test_revert_zeroTotalSeconds() public {
        vm.prank(user);
        vm.expectRevert("bad durations");
        router.createLinearLock(100e6, 0, 0, 0, 0);
    }

    function test_constructor_revert_zeroLockup() public {
        vm.expectRevert("zero lockup");
        new RipGuardRouter(ISablierLockup(address(0)), IERC20(address(usdc)), treasury);
    }

    function test_constructor_revert_zeroToken() public {
        vm.expectRevert("zero token");
        new RipGuardRouter(ISablierLockup(address(mockLockup)), IERC20(address(0)), treasury);
    }

    function test_constructor_revert_zeroTreasury() public {
        vm.expectRevert("zero treasury");
        new RipGuardRouter(ISablierLockup(address(mockLockup)), IERC20(address(usdc)), address(0));
    }

    function test_approvalResetAfterCreate() public {
        uint128 amount = 1000e6;

        vm.startPrank(user);
        usdc.approve(address(router), amount);
        router.createLinearLock(amount, 0, 30 days, 0, 0);
        vm.stopPrank();

        // Approval should be reset to 0
        assertEq(usdc.allowance(address(router), address(mockLockup)), 0);
    }

}
