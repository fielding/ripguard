"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { parseUnits, formatUnits, keccak256, toHex, type Address, type TransactionReceipt } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import {
  PRESETS,
  IS_TESTNET,
  brokerFeeForTreasury,
  brokerFeePctString,
} from "@/config/contracts";
import { CHAINS, getChainConfig, isSupportedDeploymentChain, DEFAULT_CHAIN_ID } from "@/config/chains";
import { erc20Abi, sablierLockupAbi, testUsdcAbi } from "@/config/abis";
import { ShareCard } from "@/components/ShareCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WrongChainPanel } from "@/components/WrongChainPanel";
import { useToast } from "@/components/Toast";
import { trackLockCreated, trackLockApproved, trackContractError } from "@/lib/analytics";
import { isUserRejection, extractErrorReason } from "@/lib/errors";
import {
  DURATION_OPTIONS,
  ALL_INTERVALS,
  MIN_LOCK_SECONDS,
  getIntervalOptions,
  parsePositiveDurationParam,
  parseAmountParam,
  parseLockUntilInput,
  formatDuration,
  formatTargetDate,
  toDatetimeLocalValue,
  computeFee,
  computeMaxDeposit,
} from "@/lib/schedule";

type PresetKey = keyof typeof PRESETS;
// Infinite allowance. Approving max uint256 once means future locks skip
// the approve step entirely — one signature instead of two on every repeat
// lock. Standard pattern for trusted, non-upgradeable DeFi protocols.
const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

// ERC-721 Transfer event topic
const TRANSFER_TOPIC = keccak256(toHex("Transfer(address,address,uint256)"));
const ZERO_ADDR_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";

function parseStreamIdFromReceipt(
  receipt: TransactionReceipt | undefined,
  sablierAddress: Address
): bigint {
  if (!receipt) return BigInt(0);
  // Find ERC-721 Transfer (mint) from Sablier: from=0x0, to=recipient, tokenId=streamId
  const mintLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === sablierAddress.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics[1] === ZERO_ADDR_TOPIC &&
      log.topics[3]
  );
  if (!mintLog?.topics[3]) return BigInt(0);
  return BigInt(mintLog.topics[3]);
}

type Step = "schedule" | "confirm" | "approve" | "lock" | "success";
type CustomMode = "reloads" | "lockUntil";

// Sensible default for the lock-until picker: 7 days from "now" at the
// minute the page rendered. Captured once per mount so the input doesn't
// re-render and drift each second.
function defaultLockUntilValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setSeconds(0, 0);
  return toDatetimeLocalValue(d);
}

function Spinner() {
  return (
    <svg
      className="w-6 h-6 text-cyan animate-spin glow-cyan"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.2"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="eyebrow flex items-center gap-3">
      <span className="tabular text-cyan/70">{index}</span>
      <span className="h-px w-8 bg-cyan/40" />
      {children}
    </div>
  );
}

// Step 00 — network picker. The only prior way to change chains was the tiny
// chain icon in the wallet button; most users never found it. Surfacing the
// supported chains as switch-on-tap chips makes "you can lock on any of these"
// obvious, and a dashed Solana chip points at the sister deployment.
function NetworkSection({ isFormLocked }: { isFormLocked: boolean }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const { switchChain, isPending } = useSwitchChain({
    mutation: {
      onError: (err) =>
        toast(
          isUserRejection(err)
            ? "You rejected the network switch."
            : extractErrorReason(err),
          "error",
        ),
    },
  });

  // Only chains live on this deployment (mainnet vs testnet).
  const chains = Object.values(CHAINS).filter((c) => c.isTestnet === IS_TESTNET);
  // Solana is a sister deployment — link out so EVM users discover it without
  // expecting an in-wallet chain switch (dashed border + ↗ mark "leaves site").
  const solHref = IS_TESTNET
    ? "https://testnet.sol.ripguard.xyz"
    : "https://sol.ripguard.xyz";
  const currentName = chains.find((c) => c.chainId === chainId)?.name;

  const helper = !isConnected
    ? "Pick where you'll lock — connect your wallet to switch networks."
    : isPending
      ? "Switching network…"
      : currentName
        ? `You're on ${currentName}. Tap another to switch — your amount carries over.`
        : "Your wallet's on a network we don't support here. Tap one to switch.";

  return (
    <section className="space-y-4">
      <SectionLabel index="00">Network</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {chains.map((c) => {
          const active = isConnected && c.chainId === chainId;
          const interactive = isConnected && !active && !isFormLocked && !isPending;
          return (
            <button
              key={c.chainId}
              type="button"
              aria-pressed={active}
              disabled={!interactive}
              onClick={() => switchChain({ chainId: c.chainId })}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] tracking-wide rounded-full border transition-colors min-h-[2.5rem] ${
                active
                  ? "border-cyan/60 bg-cyan/10 text-cyan"
                  : interactive
                    ? "border-line bg-surface text-muted cursor-pointer hover:border-cyan/50 hover:text-cyan hover:bg-surface-strong"
                    : "border-line bg-surface text-muted cursor-default"
              } ${isFormLocked ? "opacity-50" : ""}`}
            >
              {active && (
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-cyan glow-cyan" />
              )}
              {c.shortName}
            </button>
          );
        })}
        <a
          href={solHref}
          title="RipGuard on Solana — opens the Solana app"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] tracking-wide rounded-full border border-dashed border-line text-muted hover:border-cyan/60 hover:text-cyan transition-colors min-h-[2.5rem]"
        >
          Solana
          <span aria-hidden className="text-[11px] -mt-0.5">↗</span>
        </a>
      </div>
      <p className="text-xs text-faint leading-relaxed">{helper}</p>
    </section>
  );
}

function CreateLockInner() {
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset") as PresetKey | null;
  const customCliffParam = parsePositiveDurationParam(searchParams.get("cliff"));
  const customTotalParam = parsePositiveDurationParam(searchParams.get("total"));
  const isCustomFromQuery = searchParams.get("mode") === "custom" && customTotalParam !== null;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  // Defensive lookup: if the wallet is on a chain we don't support, fall
  // back to the deployment's default chain so the page can still render.
  // The wrong-chain panel below blocks any tx attempt on the unsupported chain.
  const {
    sablierLockup,
    usdc: usdcAddress,
    usdcDecimals,
    treasury,
    explorerUrl,
    explorerName,
    usdcNote,
  } = useMemo(
    () =>
      getChainConfig(
        isSupportedDeploymentChain(chainId, IS_TESTNET) ? chainId : DEFAULT_CHAIN_ID,
      ),
    [chainId],
  );
  const brokerFee = brokerFeeForTreasury(treasury);
  const brokerFeePct = brokerFeePctString(brokerFee);
  // 1 USDC minimum, scaled to the chain's decimals (6 on most, 18 on BNB).
  const minDeposit = BigInt(10) ** BigInt(usdcDecimals);

  const amountParam = parseAmountParam(searchParams.get("amount"), usdcDecimals);

  const { toast } = useToast();

  // Schedule state
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | "custom">(
    isCustomFromQuery ? "custom" : presetParam && presetParam in PRESETS ? presetParam : "hourly1d"
  );
  const [customCliff, setCustomCliff] = useState(customCliffParam ?? 0);
  const [customTotal, setCustomTotal] = useState(customTotalParam ?? 3600); // 1 hour default
  const [customInterval, setCustomInterval] = useState(3600); // 1hr default claim interval (display only)
  const [customMode, setCustomMode] = useState<CustomMode>("reloads");
  const [lockUntilInput, setLockUntilInput] = useState<string>(defaultLockUntilValue);
  // Tick "now" once every 30s so the lock-until duration preview
  // ("18d 3h from now") doesn't go stale while the form is open. We don't
  // need per-second precision — the user is picking a target in days/hours.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-clamp total to be >= cliff, and enforce minimum 1 hour.
  // Only relevant in reloads mode; lock-until derives total from the picker.
  useEffect(() => {
    if (customMode !== "reloads") return;
    if (customTotal < 3600) {
      setCustomTotal(3600);
    } else if (customCliff > customTotal) {
      setCustomTotal(customCliff);
    }
  }, [customCliff, customTotal, customMode]);
  const [amountInput, setAmountInput] = useState(amountParam);
  const [step, setStep] = useState<Step>("schedule");
  const [confirmed, setConfirmed] = useState(false);
  // True during the brief pause after approve confirms, before we fire
  // the lock tx. Lets the wallet's RPC catch up to the approve's state.
  const [isPrimingLock, setIsPrimingLock] = useState(false);

  // Guards against double-firing writeContract calls. `approveInFlightRef`
  // blocks rapid double-clicks on the Approve USDC button. `lockInFlightRef`
  // blocks rapid double-clicks on the Lock it in button. `autoLockFiredRef`
  // ensures the approve->lock auto-progress effect only fires once per flow.
  const approveInFlightRef = useRef(false);
  const lockInFlightRef = useRef(false);
  const autoLockFiredRef = useRef(false);
  // Timeout ID for the approve->lock priming delay. Stored in a ref so it
  // survives the re-render triggered by setStep("lock") inside the effect
  // that owns it. If we returned cleanup from that effect, React would
  // clear the timeout the moment deps change (including the setStep call
  // we just made), and writeLock would never fire.
  const primingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPrimingTimeout = useCallback(() => {
    if (primingTimeoutRef.current !== null) {
      clearTimeout(primingTimeoutRef.current);
      primingTimeoutRef.current = null;
    }
  }, []);

  // Unmount-only cleanup for any pending priming timeout.
  useEffect(() => clearPrimingTimeout, [clearPrimingTimeout]);

  // Parsed lock-until target (null when the picker is empty / past /
  // too soon). Memoized to one read of `nowMs` per tick so the rest of
  // the form sees a stable view of the schedule.
  const lockUntilParsed = useMemo(
    () =>
      selectedPreset === "custom" && customMode === "lockUntil"
        ? parseLockUntilInput(lockUntilInput, nowMs)
        : null,
    [selectedPreset, customMode, lockUntilInput, nowMs],
  );

  // Derived schedule values
  const schedule = useMemo<{
    cliffSeconds: number;
    totalSeconds: number;
    isLumpSum: boolean;
    label: string;
    targetMs: number | null;
  }>(() => {
    if (selectedPreset !== "custom") {
      const p = PRESETS[selectedPreset];
      return {
        cliffSeconds: p.cliffSeconds,
        totalSeconds: p.totalSeconds,
        isLumpSum: p.isLumpSum,
        label: p.label,
        targetMs: null,
      };
    }
    if (customMode === "lockUntil") {
      // Picker not yet valid → totalSeconds = 0 keeps `canProceed` false
      // so the action button stays disabled until they pick a real date.
      if (!lockUntilParsed) {
        return {
          cliffSeconds: 0,
          totalSeconds: 0,
          isLumpSum: true,
          label: "Lock until …",
          targetMs: null,
        };
      }
      const total = lockUntilParsed.durationSeconds;
      // Sablier requires cliff < total strictly. The one-second gap is
      // negligible vs the unlock date; the user sees a clean lump-sum.
      return {
        cliffSeconds: total - 1,
        totalSeconds: total,
        isLumpSum: true,
        label: `Lock until ${formatTargetDate(lockUntilParsed.targetMs)}`,
        targetMs: lockUntilParsed.targetMs,
      };
    }
    const cliffEqualsTotal = customCliff === customTotal && customCliff > 0;
    return {
      cliffSeconds: customCliff,
      // Sablier requires cliff < total strictly; add 1s so linear stream amount is non-zero
      totalSeconds: cliffEqualsTotal ? customTotal + 1 : customTotal,
      isLumpSum: false, // Never set unlockCliff=totalAmount — Sablier rejects zero linear stream amount
      label: "Custom Reloads",
      targetMs: null,
    };
  }, [selectedPreset, customMode, customCliff, customTotal, lockUntilParsed]);

  // Amount parsing
  const depositAmount = useMemo(() => {
    try {
      const trimmed = amountInput.trim();
      if (!trimmed || parseFloat(trimmed) <= 0) return BigInt(0);
      return parseUnits(trimmed, usdcDecimals);
    } catch {
      return BigInt(0);
    }
  }, [amountInput, usdcDecimals]);

  const fee = useMemo(() => computeFee(depositAmount, brokerFee), [depositAmount, brokerFee]);
  const totalAmount = depositAmount + fee;

  // Unlock amounts for Sablier
  const unlockStart = BigInt(0);
  const unlockCliff = schedule.isLumpSum ? depositAmount : BigInt(0);

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as Address, sablierLockup],
    query: { enabled: isConnected && !!address },
  });

  // Read USDC balance
  const {
    data: balance,
    refetch: refetchBalance,
    isError: isBalanceError,
  } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    query: { enabled: isConnected && !!address },
  });

  const hasEnoughAllowance =
    allowance !== undefined && allowance >= totalAmount && totalAmount > 0;
  const hasEnoughBalance =
    balance !== undefined && balance >= totalAmount && totalAmount > 0;

  // Approve tx
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
    isError: isApproveError,
    error: approveError,
    reset: resetApproveWrite,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // Lock tx
  const {
    writeContract: writeLock,
    data: lockTxHash,
    isPending: isLocking,
    isError: isLockError,
    error: lockError,
    reset: resetLockWrite,
  } = useWriteContract();

  const { data: lockReceipt, isLoading: isLockConfirming, isSuccess: isLockConfirmed } =
    useWaitForTransactionReceipt({ hash: lockTxHash });

  const resetForm = useCallback(() => {
    setSelectedPreset("hourly1d");
    setCustomCliff(0);
    setCustomTotal(3600);
    setCustomMode("reloads");
    setLockUntilInput(defaultLockUntilValue());
    setAmountInput("");
    setStep("schedule");
    setConfirmed(false);
    setIsPrimingLock(false);
    approveInFlightRef.current = false;
    lockInFlightRef.current = false;
    autoLockFiredRef.current = false;
    clearPrimingTimeout();
    // Clear wagmi mutation state so stale isSuccess/data from the previous
    // flow can't trigger the success effect on the next flow's first render.
    resetApproveWrite();
    resetLockWrite();
  }, [clearPrimingTimeout, resetApproveWrite, resetLockWrite]);

  // Testnet faucet
  const {
    writeContract: writeFaucet,
    isPending: isFauceting,
    isError: isFaucetError,
    error: faucetError,
    data: faucetTxHash,
  } = useWriteContract();

  const { isLoading: isFaucetConfirming, isSuccess: isFaucetConfirmed } =
    useWaitForTransactionReceipt({ hash: faucetTxHash });

  useEffect(() => {
    if (isFaucetConfirmed) {
      refetchBalance();
      toast("10,000 test USDC minted!", "success");
    }
  }, [isFaucetConfirmed, refetchBalance, toast]);

  useEffect(() => {
    if (isFaucetError) {
      if (isUserRejection(faucetError)) {
        toast("You rejected the faucet request.", "error");
      } else {
        toast(extractErrorReason(faucetError), "error");
      }
    }
  }, [isFaucetError, faucetError, toast]);

  const handleApprove = useCallback(() => {
    if (!address || approveInFlightRef.current) return;
    approveInFlightRef.current = true;
    autoLockFiredRef.current = false; // fresh approve flow, allow auto-lock
    // Clear stale success/error state from any previous approve so the
    // post-confirm effect doesn't fire against leftover data.
    resetApproveWrite();
    setStep("approve");
    writeApprove({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "approve",
      // Infinite allowance so future locks skip the approve step entirely.
      // Users can still manually edit the cap down in MetaMask at sign time.
      args: [sablierLockup, MAX_UINT256],
    });
  }, [writeApprove, address, resetApproveWrite, usdcAddress, sablierLockup]);

  const handleLock = useCallback(() => {
    if (!address || lockInFlightRef.current) return;
    lockInFlightRef.current = true;
    // Clear stale success/error state from any previous lock so the
    // post-confirm effect doesn't fire against leftover data.
    resetLockWrite();
    setStep("lock");
    writeLock({
      address: sablierLockup,
      abi: sablierLockupAbi,
      functionName: "createWithDurationsLL",
      args: [
        {
          sender: address as Address,
          recipient: address as Address,
          totalAmount,
          token: usdcAddress,
          cancelable: false,
          transferable: false,
          shape: "RipGuard",
          broker: { account: treasury, fee: brokerFee },
        },
        { start: unlockStart, cliff: unlockCliff },
        { cliff: schedule.cliffSeconds, total: schedule.totalSeconds },
      ],
    });
  }, [
    writeLock,
    totalAmount,
    schedule,
    unlockStart,
    unlockCliff,
    address,
    resetLockWrite,
    sablierLockup,
    usdcAddress,
    treasury,
    brokerFee,
  ]);

  // Auto-advance from approve to lock after approval confirms. We skip
  // re-opening the confirm dialog because (a) the user already consented
  // when they clicked Approve USDC, and (b) bouncing through the dialog
  // caused a timing race where hasEnoughAllowance could be stale against
  // the just-refetched allowance state, triggering a second spurious
  // approve popup in the wallet.
  //
  // Firing writeLock immediately after the approve confirms also hits a
  // race: the wallet's own RPC node may not yet see the approve tx's
  // allowance update, so viem's gas estimation simulates the lock call
  // as reverting, returns a garbage gas estimate, and the wallet rejects
  // with "exceeds max transaction gas limit". To avoid this we transition
  // to the lock step immediately (so the spinner stays continuous) and
  // delay the actual writeLock call by a beat, giving the RPC time to
  // catch up to the approve tx's block.
  useEffect(() => {
    if (
      !isApproveConfirmed ||
      step !== "approve" ||
      !address ||
      autoLockFiredRef.current
    ) {
      return;
    }

    autoLockFiredRef.current = true;
    approveInFlightRef.current = false;
    // Fire-and-forget refetch so allowance state stays accurate if the
    // user ends up back at the dialog after a lock error.
    refetchAllowance();
    // Clear any stale lock mutation state before the auto-progress fires
    // a new writeLock, so the post-confirm success effect doesn't trip on
    // leftover isSuccess/lockTxHash from a previous lock flow.
    resetLockWrite();
    toast("USDC approved. Locking in…", "success");
    trackLockApproved(Number(formatUnits(totalAmount, usdcDecimals)));
    setStep("lock");
    setIsPrimingLock(true);

    // NOTE: intentionally no cleanup return from this effect. The setStep
    // above changes `step`, which is in our deps, so React would re-run
    // the effect and clear the timeout before it fires. The timeout lives
    // in a ref and is cleaned up only on unmount (see clearPrimingTimeout
    // effect above).
    primingTimeoutRef.current = setTimeout(() => {
      primingTimeoutRef.current = null;
      setIsPrimingLock(false);
      lockInFlightRef.current = true;
      writeLock({
        address: sablierLockup,
        abi: sablierLockupAbi,
        functionName: "createWithDurationsLL",
        args: [
          {
            sender: address as Address,
            recipient: address as Address,
            totalAmount,
            token: usdcAddress,
            cancelable: false,
            transferable: false,
            shape: "RipGuard",
            broker: { account: treasury, fee: brokerFee },
          },
          { start: unlockStart, cliff: unlockCliff },
          { cliff: schedule.cliffSeconds, total: schedule.totalSeconds },
        ],
      });
    }, 1500);
  }, [
    isApproveConfirmed,
    step,
    address,
    totalAmount,
    schedule,
    unlockStart,
    unlockCliff,
    writeLock,
    refetchAllowance,
    resetLockWrite,
    toast,
    sablierLockup,
    usdcAddress,
    treasury,
    brokerFee,
    usdcDecimals,
  ]);

  useEffect(() => {
    if (isLockConfirmed && step === "lock" && lockTxHash && lockReceipt) {
      lockInFlightRef.current = false;
      setStep("success");
      toast("Lock created!", "success", {
        label: `View on ${explorerName}`,
        href: `${explorerUrl}/tx/${lockTxHash}`,
      });
      trackLockCreated({
        schedule: schedule.label,
        amountUsd: Number(formatUnits(depositAmount, usdcDecimals)),
        cliffSeconds: schedule.cliffSeconds,
        totalSeconds: schedule.totalSeconds,
      });

      // Remember the picked preset so /vaults can show the casino-voice label
      // instead of the generic schedule-type fallback. Key includes chainId
      // because Sablier stream IDs reset per chain — without it, a stream #5
      // on Arbitrum would steal the label of stream #5 on Base.
      try {
        const streamId = parseStreamIdFromReceipt(lockReceipt, sablierLockup);
        if (streamId > BigInt(0) && typeof window !== "undefined") {
          window.localStorage.setItem(
            `ripguard:lock:${chainId}:${streamId.toString()}`,
            schedule.label
          );
        }
      } catch {
        // localStorage unavailable; /vaults falls back to schedule-type label
      }
    }
  }, [
    isLockConfirmed,
    step,
    lockTxHash,
    lockReceipt,
    toast,
    schedule,
    depositAmount,
    chainId,
    sablierLockup,
    explorerUrl,
    explorerName,
    usdcDecimals,
  ]);

  // Reset step if user rejects wallet prompt or tx fails
  useEffect(() => {
    if (isApproveError && step === "approve") {
      approveInFlightRef.current = false;
      autoLockFiredRef.current = false;
      setStep("confirm");
      refetchAllowance();
      refetchBalance();
      if (isUserRejection(approveError)) {
        toast("You rejected the approval request.", "error");
      } else {
        toast(extractErrorReason(approveError), "error");
      }
      trackContractError({ action: "approve", error: isUserRejection(approveError) ? "User rejected" : extractErrorReason(approveError), contract: "USDC" });
    }
  }, [isApproveError, approveError, step, toast, refetchAllowance, refetchBalance]);

  useEffect(() => {
    if (isLockError && step === "lock") {
      lockInFlightRef.current = false;
      setIsPrimingLock(false);
      setStep("confirm");
      refetchBalance();
      refetchAllowance();
      if (isUserRejection(lockError)) {
        toast("You rejected the lock request.", "error");
      } else {
        toast(extractErrorReason(lockError), "error");
      }
      trackContractError({ action: "createLock", error: isUserRejection(lockError) ? "User rejected" : extractErrorReason(lockError), contract: "SablierLockup" });
    }
  }, [isLockError, lockError, step, toast, refetchBalance, refetchAllowance]);

  // Reset form if wallet disconnects mid-transaction
  useEffect(() => {
    if (!isConnected && step !== "schedule") {
      approveInFlightRef.current = false;
      lockInFlightRef.current = false;
      autoLockFiredRef.current = false;
      clearPrimingTimeout();
      resetApproveWrite();
      resetLockWrite();
      setIsPrimingLock(false);
      setStep("schedule");
      setConfirmed(false);
      toast("Wallet disconnected. Please reconnect to continue.", "error");
    }
  }, [isConnected, step, toast, clearPrimingTimeout, resetApproveWrite, resetLockWrite]);

  // Reset form if the wallet's chain changes mid-flow. Locks the user into
  // resigning the flow on the new chain so token addresses, treasury, fee,
  // and decimals can't desync between the rendered totals and the queued tx.
  // The riskiest path is the approve→lock priming timeout — without this
  // guard a chain switch in that window would fire writeLock against the
  // old chain's Sablier address while the wallet is on the new chain.
  const lastChainIdRef = useRef(chainId);
  useEffect(() => {
    if (lastChainIdRef.current === chainId) return;
    lastChainIdRef.current = chainId;
    if (step !== "schedule" && step !== "success") {
      resetForm();
      toast("Network changed. Review the lock again on the new chain.", "error");
    }
  }, [chainId, step, resetForm, toast]);

  const meetsMinimum = depositAmount >= minDeposit;
  const canProceed =
    depositAmount > 0 && meetsMinimum && schedule.totalSeconds > 0 && isConnected;

  const isValidForm = canProceed && hasEnoughBalance;

  // Freeze form inputs once past the schedule step to prevent amount
  // changes during confirm/approve/lock (race condition with tx values)
  const isFormLocked = step !== "schedule";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Trust signal */}
      <div className="border-b border-line px-6 py-2.5 text-center text-xs tabular text-subtle">
        RipGuard is the UI. Sablier is the bank. Non-custodial. Immutable.
      </div>

      <main className="relative flex-1 px-5 sm:px-8 pt-14 sm:pt-20 pb-24 sm:pb-32">
        {/* Ambient glow — quiet backdrop */}
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[520px] bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,oklch(0.30_0.060_200/0.40),transparent_70%)]" />
          <div className="absolute inset-0 grid-overlay" />
        </div>

        <div className="relative mx-auto max-w-2xl w-full">
          <WrongChainPanel>
          {step === "success" ? (
            <SuccessView
              txHash={lockTxHash!}
              streamId={parseStreamIdFromReceipt(lockReceipt, sablierLockup)}
              depositAmount={depositAmount}
              schedule={schedule}
              usdcDecimals={usdcDecimals}
              sablierAddress={sablierLockup}
              explorerUrl={explorerUrl}
              explorerName={explorerName}
              onCreateAnother={resetForm}
            />
          ) : (
            <>
              <div className="mb-14">
                <div className="eyebrow mb-5 flex items-center gap-3">
                  <span className="h-px w-10 bg-cyan/60" />
                  New lock
                </div>
                <h1 className="text-display max-w-xl">
                  Lock the win
                  <br />
                  <span className="text-cyan">before you touch it.</span>
                </h1>
                <p className="mt-5 text-muted leading-relaxed max-w-[52ch]">
                  One signature. Routes directly into Sablier. Non-cancelable.
                  Non-transferable. No going back.
                </p>
              </div>

              <div className="space-y-14 sm:space-y-16">
                {/* Network — step 00, so picking a chain is the first, most
                    visible decision rather than a hidden wallet-icon toggle. */}
                <NetworkSection isFormLocked={isFormLocked} />

                {/* Amount Input — first so the calculator reacts to it */}
                <section className="space-y-4">
                  <SectionLabel index="01">Amount</SectionLabel>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Amount in USDC"
                      placeholder="0.00"
                      value={amountInput}
                      disabled={isFormLocked}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseAmountParam(v, usdcDecimals) || v === "") {
                          setAmountInput(v);
                          setStep("schedule");
                        }
                      }}
                      className={`w-full bg-surface border border-line rounded-lg px-5 py-5 text-3xl font-display tabular tracking-tight focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors pr-20 ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-subtle text-sm font-semibold tracking-wider">
                      USDC
                    </span>
                  </div>
                  {isConnected && balance === undefined && !isBalanceError && (
                    <div className="text-xs text-faint animate-pulse">
                      Loading balance…
                    </div>
                  )}
                  {isConnected && isBalanceError && (
                    <div className="flex items-center gap-2 text-xs text-danger">
                      <span>Failed to load balance.</span>
                      <button
                        onClick={() => refetchBalance()}
                        className="underline hover:text-foreground transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {isConnected && balance !== undefined && (
                    <div className="flex items-center justify-between text-xs text-faint tabular">
                      <span>
                        Balance: {formatUnits(balance, usdcDecimals)} USDC
                      </span>
                      <button
                        disabled={isFormLocked || balance === BigInt(0)}
                        onClick={() => {
                          const maxDeposit = computeMaxDeposit(balance, brokerFee);
                          setAmountInput(formatUnits(maxDeposit, usdcDecimals));
                          setStep("schedule");
                        }}
                        className={`inline-flex items-center min-h-[2.75rem] px-2 -my-2 -mr-2 text-muted hover:text-cyan underline transition-colors ${isFormLocked || balance === BigInt(0) ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={`Max lock amount after ${brokerFeePct} fee`}
                      >
                        Max{brokerFee > BigInt(0) ? " (net of fee)" : ""}
                      </button>
                    </div>
                  )}
                  {isConnected && depositAmount > 0 && !meetsMinimum && (
                    <p className="text-xs text-danger">
                      Minimum lock is 1 USDC. Start with $5 if this is your first one.
                    </p>
                  )}
                  {isConnected && balance !== undefined && !hasEnoughBalance && depositAmount > 0 && meetsMinimum && (
                    <p className="text-xs text-danger">
                      Not enough in the wallet. You have{" "}
                      {formatUnits(balance, usdcDecimals)} USDC, need{" "}
                      {formatUnits(totalAmount, usdcDecimals)} USDC (incl. {brokerFeePct} fee).
                    </p>
                  )}
                  {usdcNote && (
                    <p className="text-[11px] text-faint leading-relaxed">
                      {usdcNote}
                    </p>
                  )}
                  {IS_TESTNET && isConnected && (
                    <button
                      onClick={() =>
                        writeFaucet({
                          address: usdcAddress,
                          abi: testUsdcAbi,
                          functionName: "faucet",
                        })
                      }
                      disabled={isFauceting || isFaucetConfirming}
                      className="inline-flex items-center min-h-[2.75rem] px-2 -mx-2 text-xs text-cyan/80 hover:text-cyan underline transition-colors disabled:opacity-50"
                    >
                      {isFauceting
                        ? "Confirm in wallet…"
                        : isFaucetConfirming
                          ? "Minting…"
                          : "Mint 10,000 test USDC"}
                    </button>
                  )}
                </section>

                {/* Schedule Selection */}
                <section className="space-y-5">
                  <SectionLabel index="02">Reload</SectionLabel>

                  {/* Three-tab control: Presets · Custom · Lock until.
                      Flattened to the top level so the two custom modes are
                      first-class — no tabs nested inside the builder. */}
                  <div
                    role="tablist"
                    aria-label="Schedule type"
                    className="grid grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedPreset !== "custom"}
                      disabled={isFormLocked}
                      onClick={() => {
                        if (selectedPreset === "custom") setSelectedPreset("hourly1d");
                        setStep("schedule");
                      }}
                      className={`px-3 py-3 text-[13px] sm:text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                        selectedPreset !== "custom"
                          ? "bg-cyan/[0.10] text-cyan"
                          : "bg-background text-muted hover:bg-surface hover:text-foreground"
                      } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedPreset === "custom" && customMode === "reloads"}
                      disabled={isFormLocked}
                      onClick={() => {
                        setSelectedPreset("custom");
                        setCustomMode("reloads");
                        setStep("schedule");
                      }}
                      className={`px-3 py-3 text-[13px] sm:text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                        selectedPreset === "custom" && customMode === "reloads"
                          ? "bg-cyan/[0.10] text-cyan"
                          : "bg-background text-muted hover:bg-surface hover:text-foreground"
                      } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      Custom
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedPreset === "custom" && customMode === "lockUntil"}
                      disabled={isFormLocked}
                      onClick={() => {
                        setSelectedPreset("custom");
                        setCustomMode("lockUntil");
                        setStep("schedule");
                      }}
                      className={`px-3 py-3 text-[13px] sm:text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                        selectedPreset === "custom" && customMode === "lockUntil"
                          ? "bg-cyan/[0.10] text-cyan"
                          : "bg-background text-muted hover:bg-surface hover:text-foreground"
                      } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      Lock until
                    </button>
                  </div>

                  {/* Custom schedule builder — "Custom" (steady reloads) vs
                      "Lock until" is chosen by the top-level tabs above, so
                      there's no nested toggle here. */}
                  {selectedPreset === "custom" && (
                    <div className="space-y-5 border border-line rounded-lg p-5 bg-surface">
                      {customMode === "lockUntil" ? (
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="lock-until" className="eyebrow block mb-2">
                              Unlock on
                            </label>
                            <input
                              id="lock-until"
                              type="datetime-local"
                              value={lockUntilInput}
                              disabled={isFormLocked}
                              min={toDatetimeLocalValue(new Date(nowMs + MIN_LOCK_SECONDS * 1000))}
                              onChange={(e) => setLockUntilInput(e.target.value)}
                              className={`w-full bg-background border border-line rounded-lg px-4 py-3 text-sm tabular focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                            />
                          </div>
                          {lockUntilParsed ? (
                            <p className="text-xs text-muted leading-relaxed">
                              Single unlock on{" "}
                              <span className="text-foreground">
                                {formatTargetDate(lockUntilParsed.targetMs)}
                              </span>
                              . Locked for{" "}
                              <span className="text-foreground tabular">
                                {formatDuration(lockUntilParsed.durationSeconds)}
                              </span>{" "}
                              from now. No reloads, no early exit.
                            </p>
                          ) : (
                            <p className="text-xs text-danger leading-relaxed">
                              Pick a date at least 1 hour from now.
                            </p>
                          )}
                          <p className="text-[11px] text-faint leading-relaxed">
                            Good for rent, bills, or any single-date deadline.
                            Cadence and waiting period don&apos;t apply.
                          </p>
                        </div>
                      ) : (
                        <>
                      {/* Total duration */}
                      <div>
                        <label htmlFor="total-duration" className="eyebrow block mb-2">
                          Reload window
                        </label>
                        <div className="relative">
                          <select
                            id="total-duration"
                            value={customTotal}
                            disabled={isFormLocked}
                            onChange={(e) => {
                              const newTotal = Number(e.target.value);
                              setCustomTotal(newTotal);
                              // Auto-adjust interval if it no longer fits
                              const validIntervals = getIntervalOptions(newTotal);
                              if (validIntervals.length > 0 && !validIntervals.find((i) => i.seconds === customInterval)) {
                                setCustomInterval(validIntervals[0].seconds);
                              }
                            }}
                            className={`w-full appearance-none bg-background border border-line rounded-lg px-4 py-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors cursor-pointer ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {DURATION_OPTIONS.filter(
                              (d) => d.seconds >= customCliff
                            ).map((d) => (
                              <option key={d.seconds} value={d.seconds}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>

                      {/* Claim interval — dynamic based on duration */}
                      <div>
                        <label className="eyebrow block mb-2">
                          Reload cadence
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {getIntervalOptions(customTotal).map((i) => (
                            <button
                              key={i.seconds}
                              type="button"
                              disabled={isFormLocked}
                              onClick={() => setCustomInterval(i.seconds)}
                              className={`inline-flex items-center min-h-[2.75rem] px-4 rounded-lg text-xs font-semibold tabular border transition-colors ${
                                customInterval === i.seconds
                                  ? "border-cyan bg-cyan/10 text-cyan"
                                  : "border-line bg-background text-muted hover:border-line-strong hover:text-foreground"
                              } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              {i.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cliff (advanced, collapsed) */}
                      <details className="group">
                        <summary className="text-xs text-faint cursor-pointer hover:text-muted transition-colors">
                          Advanced: add a waiting period before reloads start
                        </summary>
                        <div className="mt-3">
                          <div className="relative">
                            <select
                              id="cliff-duration"
                              value={customCliff}
                              disabled={isFormLocked}
                              onChange={(e) =>
                                setCustomCliff(Number(e.target.value))
                              }
                              className={`w-full appearance-none bg-background border border-line rounded-lg px-4 py-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors cursor-pointer ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <option value={0}>No wait</option>
                              {DURATION_OPTIONS.filter((d) => d.seconds < customTotal).map((d) => (
                                <option key={d.seconds} value={d.seconds}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      </details>

                      {customCliff > customTotal && (
                        <p className="text-xs text-danger">
                          The wait can&apos;t be longer than the reload window.
                        </p>
                      )}
                        </>
                      )}
                    </div>
                  )}

                  {selectedPreset !== "custom" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line rounded-lg overflow-hidden">
                      {(Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).map(
                        ([key, preset]) => {
                          const selected = selectedPreset === key;
                          return (
                            <button
                              key={key}
                              disabled={isFormLocked}
                              onClick={() => {
                                setSelectedPreset(key);
                                setStep("schedule");
                              }}
                              className={`relative p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                                selected
                                  ? "bg-cyan/[0.08] text-foreground"
                                  : "bg-background text-foreground hover:bg-surface"
                              } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-display text-base tracking-tight">{preset.label}</div>
                                  <div className="text-xs text-muted mt-1 leading-relaxed">
                                    {preset.description}
                                  </div>
                                </div>
                                {selected && (
                                  <span className="eyebrow text-cyan shrink-0">On</span>
                                )}
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>

                {/* Payout Preview */}
                {depositAmount > 0 && (
                  <section className="space-y-4">
                    <SectionLabel index="03">Payout</SectionLabel>
                    <TimelinePreview
                      cliffSeconds={schedule.cliffSeconds}
                      totalSeconds={schedule.totalSeconds}
                      isLumpSum={schedule.isLumpSum}
                      targetMs={schedule.targetMs}
                      depositAmount={depositAmount}
                      usdcDecimals={usdcDecimals}
                    />
                    {!schedule.isLumpSum && (
                      <VestingCalculator
                        depositAmount={depositAmount}
                        totalSeconds={schedule.totalSeconds}
                        cliffSeconds={schedule.cliffSeconds}
                        intervalSeconds={selectedPreset === "custom" ? customInterval : 3600}
                        usdcDecimals={usdcDecimals}
                      />
                    )}
                  </section>
                )}

                {/* Fee Breakdown */}
                {depositAmount > 0 && (
                  <section className="border border-line rounded-lg p-5 space-y-2.5 text-sm tabular">
                    <div className="flex justify-between">
                      <span className="text-muted">Lock amount</span>
                      <span className="text-foreground">{formatUnits(depositAmount, usdcDecimals)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">
                        Lock fee {brokerFee > BigInt(0) ? `(${brokerFeePct})` : IS_TESTNET ? "(disabled on testnet)" : "(waived)"}
                      </span>
                      <span className="text-foreground">{formatUnits(fee, usdcDecimals)} USDC</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-line pt-3 mt-1">
                      <span>Total from wallet</span>
                      <span>{formatUnits(totalAmount, usdcDecimals)} USDC</span>
                    </div>
                  </section>
                )}

                {/* Action Buttons */}
                <section>
                  {!isConnected ? (
                    <div className="text-center text-muted text-sm">
                      Connect your wallet to continue.
                    </div>
                  ) : step === "schedule" || step === "confirm" ? (
                    <>
                      {isValidForm ? (
                        <button
                          onClick={() => setStep("confirm")}
                          className="btn-primary btn-lg w-full"
                        >
                          Review the lock
                        </button>
                      ) : (
                        <button
                          disabled
                          className="btn-secondary btn-lg w-full opacity-40 cursor-not-allowed"
                        >
                          {depositAmount === BigInt(0)
                            ? "Enter an amount"
                            : !meetsMinimum
                              ? "Minimum 1 USDC"
                              : !hasEnoughBalance
                                ? "Not enough in the wallet"
                                : selectedPreset === "custom" &&
                                    customMode === "lockUntil" &&
                                    !lockUntilParsed
                                  ? "Pick a date at least 1 hour out"
                                  : "Review the lock"}
                        </button>
                      )}
                    </>
                  ) : step === "approve" ? (
                    (() => {
                      const approveStatus = isApproving
                        ? "Confirm in wallet…"
                        : isApproveConfirming
                          ? "Waiting for confirmation…"
                          : "Approving USDC…";
                      return (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Spinner />
                      <div
                        key={approveStatus}
                        className="text-sm text-muted animate-text-fade-in"
                      >
                        {approveStatus}
                      </div>
                      <div className="text-xs text-faint max-w-[36ch] text-center leading-relaxed animate-fade-in-up">
                        Just permission. The lock is the next signature.
                      </div>
                      {isApproveConfirming && approveTxHash && (
                        <a
                          href={`${explorerUrl}/tx/${approveTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center min-h-[2.75rem] px-2 text-sm text-faint hover:text-cyan underline transition-colors"
                        >
                          View on {explorerName}
                        </a>
                      )}
                    </div>
                      );
                    })()
                  ) : step === "lock" ? (
                    (() => {
                      const lockStatus = isPrimingLock
                        ? "Lining up the lock…"
                        : isLocking
                          ? "Confirm in wallet…"
                          : isLockConfirming
                            ? "Waiting for confirmation…"
                            : "Writing the lock to Sablier…";
                      return (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Spinner />
                      <div
                        key={lockStatus}
                        className="text-sm text-muted animate-text-fade-in"
                      >
                        {lockStatus}
                      </div>
                      <div className="text-xs text-faint max-w-[36ch] text-center leading-relaxed space-y-0.5">
                        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
                          Routes directly into Sablier.
                        </div>
                        <div className="animate-fade-in-up" style={{ animationDelay: "90ms" }}>
                          Enforced on-chain.
                        </div>
                        <div
                          className="text-muted animate-fade-in-up"
                          style={{ animationDelay: "180ms" }}
                        >
                          No going back. Your future self thanks you.
                        </div>
                      </div>
                      {isLockConfirming && lockTxHash && (
                        <a
                          href={`${explorerUrl}/tx/${lockTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center min-h-[2.75rem] px-2 text-sm text-faint hover:text-cyan underline transition-colors"
                        >
                          View on {explorerName}
                        </a>
                      )}
                    </div>
                      );
                    })()
                  ) : null}
                </section>
              </div>

              {/* Confirmation Modal */}
              {step === "confirm" && (
                <ConfirmDialog
                  schedule={schedule}
                  depositAmount={depositAmount}
                  fee={fee}
                  totalAmount={totalAmount}
                  hasEnoughAllowance={hasEnoughAllowance}
                  confirmed={confirmed}
                  usdcDecimals={usdcDecimals}
                  brokerFee={brokerFee}
                  brokerFeePct={brokerFeePct}
                  onConfirmedChange={setConfirmed}
                  onApprove={handleApprove}
                  onLock={handleLock}
                  onCancel={() => {
                    setStep("schedule");
                    setConfirmed(false);
                  }}
                />
              )}
            </>
          )}
          </WrongChainPanel>
        </div>
      </main>
    </div>
  );
}

function VestingCalculator({
  depositAmount,
  totalSeconds,
  cliffSeconds,
  intervalSeconds,
  usdcDecimals,
}: {
  depositAmount: bigint;
  totalSeconds: number;
  cliffSeconds: number;
  intervalSeconds: number;
  usdcDecimals: number;
}) {
  const vestSeconds = totalSeconds - cliffSeconds;
  const totalIntervals = vestSeconds > 0 ? Math.floor(vestSeconds / intervalSeconds) : 0;
  const perInterval = totalIntervals > 0
    ? Number(formatUnits(depositAmount, usdcDecimals)) / totalIntervals
    : 0;
  const intervalLabel = ALL_INTERVALS.find((i) => i.seconds === intervalSeconds)?.label ?? formatDuration(intervalSeconds);
  const pctPerInterval = totalIntervals > 0 ? (100 / totalIntervals) : 0;

  // Show first few intervals as a mini schedule
  const previewCount = Math.min(totalIntervals, 5);
  const previewRows = Array.from({ length: previewCount }, (_, i) => {
    const elapsed = cliffSeconds + (i + 1) * intervalSeconds;
    const cumulative = perInterval * (i + 1);
    return { elapsed, cumulative, payout: perInterval };
  });

  return (
    <div className="space-y-5">
      {/* Headline payout */}
      <div>
        <div className="font-display text-4xl sm:text-5xl text-cyan tabular leading-none">
          ${perInterval.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="mt-3 text-xs text-muted tabular">
          every {intervalLabel} ({pctPerInterval.toFixed(1)}%) · {totalIntervals} reloads over {formatDuration(totalSeconds)}
        </div>
      </div>

      {/* Mini schedule table */}
      {previewRows.length > 0 && (
        <div className="space-y-1 border-t border-line pt-5">
          <div className="grid grid-cols-3 eyebrow text-faint">
            <span>Time</span>
            <span className="text-right">Payout</span>
            <span className="text-right">Cumulative</span>
          </div>
          {previewRows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 text-xs tabular text-muted py-0.5">
              <span>{formatDuration(row.elapsed)}</span>
              <span className="text-right text-cyan">
                +${row.payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-right text-foreground">
                ${row.cumulative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          {totalIntervals > previewCount && (
            <div className="text-[10px] text-faint text-center pt-2 tabular">
              … {totalIntervals - previewCount} more reloads
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelinePreview({
  cliffSeconds,
  totalSeconds,
  isLumpSum,
  targetMs,
  depositAmount,
  usdcDecimals,
}: {
  cliffSeconds: number;
  totalSeconds: number;
  isLumpSum: boolean;
  targetMs: number | null;
  depositAmount: bigint;
  usdcDecimals: number;
}) {
  const cliffPct = totalSeconds > 0 ? (cliffSeconds / totalSeconds) * 100 : 0;
  // Lock-until is a pure wait — show the bar fully filled with the "wait"
  // color so the visual matches the framing ("nothing until [date]").
  const isLockUntil = isLumpSum && targetMs !== null;

  return (
    <div className="border border-line rounded-lg p-5 space-y-3">
      {/* Visual bar */}
      <div className="relative h-6 bg-surface rounded-full overflow-hidden">
        {cliffSeconds > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-warning/30 border-r border-warning/60"
            style={{ width: `${cliffPct}%` }}
          />
        )}
        <div
          className="absolute inset-y-0 bg-cyan/40"
          style={{
            left: `${cliffPct}%`,
            width: `${100 - cliffPct}%`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-faint tabular">
        <span>Now</span>
        {!isLockUntil && cliffSeconds > 0 && cliffSeconds < totalSeconds && (
          <span>Wait: {formatDuration(cliffSeconds)}</span>
        )}
        <span>
          {isLockUntil
            ? `Unlocks ${formatTargetDate(targetMs)}`
            : isLumpSum
              ? `Unlock: ${formatDuration(totalSeconds)}`
              : `Fully reloaded: ${formatDuration(totalSeconds)}`}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted leading-relaxed">
        {isLockUntil ? (
          <>
            {formatUnits(depositAmount, usdcDecimals)} USDC unlocks in one drop
            on {formatTargetDate(targetMs)}.
          </>
        ) : isLumpSum ? (
          <>
            {formatUnits(depositAmount, usdcDecimals)} USDC unlocks in one drop
            after {formatDuration(totalSeconds)}.
          </>
        ) : cliffSeconds > 0 ? (
          <>
            Nothing for {formatDuration(cliffSeconds)}. Then{" "}
            {formatUnits(depositAmount, usdcDecimals)} USDC drips out over{" "}
            {formatDuration(totalSeconds - cliffSeconds)}.
          </>
        ) : (
          <>
            {formatUnits(depositAmount, usdcDecimals)} USDC drips out over{" "}
            {formatDuration(totalSeconds)}.
          </>
        )}
      </p>
    </div>
  );
}

function ConfirmDialog({
  schedule,
  depositAmount,
  fee,
  totalAmount,
  hasEnoughAllowance,
  confirmed,
  usdcDecimals,
  brokerFee,
  brokerFeePct,
  onConfirmedChange,
  onApprove,
  onLock,
  onCancel,
}: {
  schedule: {
    label: string;
    cliffSeconds: number;
    totalSeconds: number;
    isLumpSum: boolean;
    targetMs: number | null;
  };
  depositAmount: bigint;
  fee: bigint;
  totalAmount: bigint;
  hasEnoughAllowance: boolean;
  confirmed: boolean;
  usdcDecimals: number;
  brokerFee: bigint;
  brokerFeePct: string;
  onConfirmedChange: (v: boolean) => void;
  onApprove: () => void;
  onLock: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ESC key to dismiss + lock body scroll + focus trap
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus first focusable element
    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prev;
      previousFocusRef.current?.focus();
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-background/92 backdrop-blur-sm px-0 sm:px-4 animate-backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm lock"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="bg-surface-strong border border-line-strong rounded-t-xl sm:rounded-xl max-w-md w-full max-h-[90vh] flex flex-col animate-dialog-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-7 space-y-5 sm:space-y-6 overflow-y-auto flex-1 min-h-0">
          <div>
            <div className="eyebrow mb-3">Last step</div>
            <h3 className="text-h2">
              Lock it in.
            </h3>
          </div>

          <div className="space-y-2.5 text-sm tabular">
            <div className="flex justify-between">
              <span className="text-muted">Reload</span>
              <span className="text-foreground">{schedule.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Lock amount</span>
              <span className="text-foreground">{formatUnits(depositAmount, usdcDecimals)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Lock fee {brokerFee > BigInt(0) ? `(${brokerFeePct})` : IS_TESTNET ? "(disabled on testnet)" : "(waived)"}</span>
              <span className="text-foreground">{formatUnits(fee, usdcDecimals)} USDC</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-line pt-3 mt-1">
              <span>Total from wallet</span>
              <span>{formatUnits(totalAmount, usdcDecimals)} USDC</span>
            </div>
            {schedule.targetMs !== null ? (
              <div className="flex justify-between pt-2">
                <span className="text-muted">Unlocks on</span>
                <span className="text-foreground">{formatTargetDate(schedule.targetMs)}</span>
              </div>
            ) : (
              <>
                {schedule.cliffSeconds > 0 && (
                  <div className="flex justify-between pt-2">
                    <span className="text-muted">Wait</span>
                    <span className="text-foreground">{formatDuration(schedule.cliffSeconds)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">
                    {schedule.isLumpSum ? "Unlock after" : "Reload window"}
                  </span>
                  <span className="text-foreground">{formatDuration(schedule.totalSeconds)}</span>
                </div>
              </>
            )}
          </div>

          {/* Non-cancelable warning */}
          <div className="bg-danger/10 border border-danger/25 rounded-lg p-4 text-sm text-danger leading-relaxed">
            <strong className="font-semibold">Non-cancelable. Non-transferable.</strong>
            {" "}Once you sign, there is no early exit, no support ticket, no
            undo. The degen in the middle is going to beg. The answer is no.
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => onConfirmedChange(e.target.checked)}
              className="mt-1 accent-cyan focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 rounded"
            />
            <span className="text-sm text-muted leading-relaxed">
              I understand. Enforced on-chain by Sablier. No going back.
            </span>
          </label>
        </div>

        <div className="flex gap-3 p-6 sm:p-7 pt-0 sm:pt-0 pb-safe border-t border-line shrink-0">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          {!hasEnoughAllowance ? (
            <button
              onClick={onApprove}
              disabled={!confirmed}
              className="btn-primary flex-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Approve USDC
            </button>
          ) : (
            <button
              onClick={onLock}
              disabled={!confirmed}
              className="btn-primary flex-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Lock it in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessView({
  txHash,
  streamId,
  depositAmount,
  schedule,
  usdcDecimals,
  sablierAddress,
  explorerUrl,
  explorerName,
  onCreateAnother,
}: {
  txHash: `0x${string}`;
  streamId: bigint;
  depositAmount: bigint;
  schedule: {
    label: string;
    cliffSeconds: number;
    totalSeconds: number;
    isLumpSum: boolean;
    targetMs: number | null;
  };
  usdcDecimals: number;
  sablierAddress: Address;
  explorerUrl: string;
  explorerName: string;
  onCreateAnother: () => void;
}) {
  // Capture "now" once at mount via a lazy initializer — calling Date.now()
  // directly in render is impure (react-hooks/purity) and would drift the
  // displayed end date across re-renders.
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const endDate =
    schedule.targetMs !== null
      ? new Date(schedule.targetMs)
      : new Date((now + schedule.totalSeconds) * 1000);

  const nextUnlock = (() => {
    if (schedule.targetMs !== null) {
      return formatTargetDate(schedule.targetMs);
    }
    if (schedule.isLumpSum) {
      const d = Math.floor(schedule.totalSeconds / 86400);
      return `${d}d`;
    }
    if (schedule.cliffSeconds > 0) {
      const d = Math.floor(schedule.cliffSeconds / 86400);
      return `Cliff in ${d}d`;
    }
    return "Streaming now";
  })();

  return (
    <div className="space-y-10 py-4 sm:py-8 w-full max-w-[600px] mx-auto">
      <div className="space-y-6">
        {/* Animated shield + check icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full bg-cyan/[0.10] blur-[50px] animate-glow-pulse" />
          {/* Follow-through halo: a thin cyan ring that expands out once and
              fades, landing just after the shield pop settles. */}
          <div
            className="absolute w-20 h-20 rounded-full border-2 border-cyan animate-shield-halo"
            style={{ animationDelay: "280ms" }}
            aria-hidden="true"
          />
          <svg
            className="relative w-20 h-20 text-cyan glow-cyan animate-success-pop"
            viewBox="0 0 64 66"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M32 4L8 16v16c0 15.46 10.24 29.9 24 33.46C45.76 61.9 56 47.46 56 32V16L32 4Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="currentColor"
              fillOpacity="0.08"
            />
            <path
              d="M22 33l7 7 13-13"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div className="eyebrow mb-3 text-cyan/70">Locked</div>
          <h2 className="text-display max-w-xl">
            Your past self just paid
            <br />
            <span className="text-cyan">your future self back.</span>
          </h2>
          <p className="mt-5 text-muted leading-relaxed max-w-[52ch]">
            In Sablier. Non-cancelable. Non-transferable. The degen in the
            middle can&apos;t touch it. Come back and claim on the schedule you set.
          </p>
        </div>
      </div>

      <ShareCard
        streamId={streamId}
        amountLocked={formatUnits(depositAmount, usdcDecimals)}
        scheduleType={schedule.label}
        endDate={endDate}
        nextUnlock={nextUnlock}
        sablierAddress={sablierAddress}
      />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/vaults" className="btn-primary btn-lg flex-1">
            See your vaults
          </Link>
          <button
            onClick={onCreateAnother}
            className="btn-secondary btn-lg flex-1"
          >
            Lock another win
          </button>
        </div>
        <a
          href={`${explorerUrl}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-faint hover:text-cyan underline transition-colors text-center"
        >
          View transaction on {explorerName}
        </a>
      </div>
    </div>
  );
}

export default function CreateLock() {
  return (
    <ErrorBoundary fallbackTitle="Failed to load lock creator">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-muted">
            Loading…
          </div>
        }
      >
        <CreateLockInner />
      </Suspense>
    </ErrorBoundary>
  );
}
