"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { parseUnits, formatUnits, keccak256, toHex, type Address, type TransactionReceipt } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  PRESETS,
  USDC_ADDRESS,
  BROKER_FEE,
  SABLIER_LOCKUP,
  TREASURY,
  EXPLORER_URL,
  IS_TESTNET,
  BROKER_FEE_PCT,
} from "@/config/contracts";
import { erc20Abi, sablierLockupAbi, testUsdcAbi } from "@/config/abis";
import { ShareCard } from "@/components/ShareCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { trackLockCreated, trackLockApproved, trackContractError } from "@/lib/analytics";
import { isUserRejection, extractErrorReason } from "@/lib/errors";

type PresetKey = keyof typeof PRESETS;

const USDC_DECIMALS = 6;
const MIN_DEPOSIT = BigInt(1_000_000); // 1 USDC minimum

// Duration options for custom schedule
const DURATION_OPTIONS = [
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
  { label: "14 days", seconds: 1209600 },
  { label: "21 days", seconds: 1814400 },
  { label: "30 days", seconds: 2592000 },
  { label: "60 days", seconds: 5184000 },
  { label: "90 days", seconds: 7776000 },
  { label: "180 days", seconds: 15552000 },
  { label: "365 days", seconds: 31536000 },
];

function parsePositiveDurationParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 86400) return null;
  return parsed;
}

function parseAmountParam(value: string | null): string {
  if (!value) return "";
  return /^(\d+\.?\d{0,6}|\d*\.\d{1,6})$/.test(value) ? value : "";
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days >= 365) return `${Math.floor(days / 365)}y ${days % 365}d`;
  return `${days}d`;
}

const SCALE = BigInt("1000000000000000000"); // 1e18

function computeFee(amount: bigint): bigint {
  // totalAmount = amount * 1e18 / (1e18 - BROKER_FEE)
  // fee = totalAmount - amount
  return (amount * SCALE) / (SCALE - BROKER_FEE) - amount;
}

function computeMaxDeposit(walletBalance: bigint): bigint {
  // Given totalAmount = walletBalance, solve for deposit:
  // deposit = totalAmount * (1e18 - BROKER_FEE) / 1e18
  return (walletBalance * (SCALE - BROKER_FEE)) / SCALE;
}

// ERC-721 Transfer event topic
const TRANSFER_TOPIC = keccak256(toHex("Transfer(address,address,uint256)"));
const ZERO_ADDR_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";

function parseStreamIdFromReceipt(receipt: TransactionReceipt | undefined): bigint {
  if (!receipt) return BigInt(0);
  // Find ERC-721 Transfer (mint) from Sablier: from=0x0, to=recipient, tokenId=streamId
  const mintLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === SABLIER_LOCKUP.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics[1] === ZERO_ADDR_TOPIC &&
      log.topics[3]
  );
  if (!mintLog?.topics[3]) return BigInt(0);
  return BigInt(mintLog.topics[3]);
}

type Step = "schedule" | "confirm" | "approve" | "lock" | "success";

function Spinner() {
  return (
    <svg
      className="w-6 h-6 text-cyan animate-spin"
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

function CreateLockInner() {
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset") as PresetKey | null;
  const customCliffParam = parsePositiveDurationParam(searchParams.get("cliff"));
  const customTotalParam = parsePositiveDurationParam(searchParams.get("total"));
  const isCustomFromQuery = searchParams.get("mode") === "custom" && customTotalParam !== null;
  const amountParam = parseAmountParam(searchParams.get("amount"));

  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  // Schedule state
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | "custom">(
    isCustomFromQuery ? "custom" : presetParam && presetParam in PRESETS ? presetParam : "custom"
  );
  const [customCliff, setCustomCliff] = useState(customCliffParam ?? 0);
  const [customTotal, setCustomTotal] = useState(customTotalParam ?? 604800); // 7 days default

  // Auto-clamp total to be >= cliff, and enforce minimum 1 day
  useEffect(() => {
    if (customTotal < 86400) {
      setCustomTotal(86400);
    } else if (customCliff > customTotal) {
      setCustomTotal(customCliff);
    }
  }, [customCliff, customTotal]);
  const [amountInput, setAmountInput] = useState(amountParam);
  const [step, setStep] = useState<Step>("schedule");
  const [confirmed, setConfirmed] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedPreset("custom");
    setCustomCliff(0);
    setCustomTotal(604800);
    setAmountInput("");
    setStep("schedule");
    setConfirmed(false);
  }, []);

  // Derived schedule values
  const schedule = useMemo(() => {
    if (selectedPreset !== "custom") {
      const p = PRESETS[selectedPreset];
      return {
        cliffSeconds: p.cliffSeconds,
        totalSeconds: p.totalSeconds,
        isLumpSum: p.isLumpSum,
        label: p.label,
      };
    }
    const isLumpSum = customCliff === customTotal && customCliff > 0;
    return {
      cliffSeconds: customCliff,
      // Sablier requires cliff < total strictly; for lump sum (cliff=total) add 1s
      totalSeconds: isLumpSum ? customTotal + 1 : customTotal,
      isLumpSum,
      label: "Custom Schedule",
    };
  }, [selectedPreset, customCliff, customTotal]);

  // Amount parsing
  const depositAmount = useMemo(() => {
    try {
      const trimmed = amountInput.trim();
      if (!trimmed || parseFloat(trimmed) <= 0) return BigInt(0);
      return parseUnits(trimmed, USDC_DECIMALS);
    } catch {
      return BigInt(0);
    }
  }, [amountInput]);

  const fee = useMemo(() => computeFee(depositAmount), [depositAmount]);
  const totalAmount = depositAmount + fee;

  // Unlock amounts for Sablier
  const unlockStart = BigInt(0);
  const unlockCliff = schedule.isLumpSum ? depositAmount : BigInt(0);

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as Address, SABLIER_LOCKUP],
    query: { enabled: isConnected && !!address },
  });

  // Read USDC balance
  const {
    data: balance,
    refetch: refetchBalance,
    isError: isBalanceError,
  } = useReadContract({
    address: USDC_ADDRESS,
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
  } = useWriteContract();

  const { data: lockReceipt, isLoading: isLockConfirming, isSuccess: isLockConfirmed } =
    useWaitForTransactionReceipt({ hash: lockTxHash });

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
    if (!address) return;
    setStep("approve");
    writeApprove({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [SABLIER_LOCKUP, totalAmount],
    });
  }, [writeApprove, totalAmount, address]);

  const handleLock = useCallback(() => {
    if (!address) return;
    setStep("lock");
    writeLock({
      address: SABLIER_LOCKUP,
      abi: sablierLockupAbi,
      functionName: "createWithDurationsLL",
      args: [
        {
          sender: address as Address,
          recipient: address as Address,
          totalAmount,
          token: USDC_ADDRESS,
          cancelable: false,
          transferable: false,
          shape: "RipGuard",
          broker: { account: TREASURY, fee: BROKER_FEE },
        },
        { start: unlockStart, cliff: unlockCliff },
        { cliff: schedule.cliffSeconds, total: schedule.totalSeconds },
      ],
    });
  }, [writeLock, totalAmount, schedule, unlockStart, unlockCliff, address]);

  // Auto-advance steps after tx confirmations
  useEffect(() => {
    if (isApproveConfirmed && step === "approve") {
      // Auto-advance directly to lock — avoids going back to confirm with stale
      // allowance cache which causes a second "Approve USDC" popup
      refetchAllowance().then(() => {
        // Guard: step may have changed while awaiting refetch (e.g. wallet rejection race)
        setStep((currentStep) => {
          if (currentStep === "approve") {
            toast("USDC approved.", "success");
            trackLockApproved(Number(formatUnits(totalAmount, USDC_DECIMALS)));
            handleLock();
          }
          return currentStep;
        });
      });
    }
  }, [isApproveConfirmed, step, refetchAllowance, toast, totalAmount, handleLock]);

  useEffect(() => {
    if (isLockConfirmed && step === "lock" && lockTxHash) {
      setStep("success");
      toast("Lock created!", "success", {
        label: "View on BaseScan",
        href: `${EXPLORER_URL}/tx/${lockTxHash}`,
      });
      trackLockCreated({
        schedule: schedule.label,
        amountUsd: Number(formatUnits(depositAmount, USDC_DECIMALS)),
        cliffSeconds: schedule.cliffSeconds,
        totalSeconds: schedule.totalSeconds,
      });
    }
  }, [isLockConfirmed, step, lockTxHash, toast, schedule, depositAmount]);

  // Reset step if user rejects wallet prompt or tx fails
  useEffect(() => {
    if (isApproveError && step === "approve") {
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
      setStep("schedule");
      setConfirmed(false);
      toast("Wallet disconnected. Please reconnect to continue.", "error");
    }
  }, [isConnected, step, toast]);

  const meetsMinimum = depositAmount >= MIN_DEPOSIT;
  const canProceed =
    depositAmount > 0 && meetsMinimum && schedule.totalSeconds > 0 && isConnected;

  const isValidForm = canProceed && hasEnoughBalance;

  // Freeze form inputs once past the schedule step to prevent amount
  // changes during confirm/approve/lock (race condition with tx values)
  const isFormLocked = step !== "schedule";

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Header />

      {/* Trust signal */}
      <div className="bg-cyan/[0.06] border-b border-cyan/10 px-6 py-2 text-center text-sm text-cyan/60">
        Powered by Sablier v2.0 audited contracts &middot; Non-custodial &middot; Immutable locks
      </div>

      <main className="relative flex-1 flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12 max-w-xl mx-auto w-full">
        {/* Ambient glow — dual layer for richer bloom */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] rounded-full bg-cyan/[0.04] blur-[100px] sm:blur-[140px] pointer-events-none animate-glow-pulse" />
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[200px] h-[200px] sm:w-[350px] sm:h-[350px] rounded-full bg-cyan/[0.06] blur-[60px] sm:blur-[80px] pointer-events-none animate-glow-pulse" style={{ animationDelay: "2s" }} />
        {/* Grid overlay for depth */}
        <div className="absolute inset-0 grid-overlay pointer-events-none" />

        <h2 className="relative text-2xl font-bold mb-8">Create Lock</h2>

        {step === "success" ? (
          <SuccessView
            txHash={lockTxHash!}
            streamId={parseStreamIdFromReceipt(lockReceipt)}
            depositAmount={depositAmount}
            schedule={schedule}
            onCreateAnother={resetForm}
          />
        ) : (
          <div className="relative w-full card-gradient rounded-2xl p-6 sm:p-8 space-y-8">
            {/* Schedule Selection */}
            <section className="w-full space-y-4">
              <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
                Schedule
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).map(
                  ([key, preset]) => (
                    <button
                      key={key}
                      disabled={isFormLocked}
                      onClick={() => {
                        setSelectedPreset(key);
                        setStep("schedule");
                      }}
                      className={`card-gradient rounded-lg p-4 text-left transition-all ${
                        selectedPreset === key
                          ? "!border-cyan/60 !bg-gradient-to-b !from-cyan/[0.08] !to-transparent shadow-[0_0_20px_rgba(0,229,255,0.08)]"
                          : ""
                      } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="font-medium text-sm">{preset.label}</div>
                      <div className="text-xs text-white/40 mt-1">
                        {preset.description}
                      </div>
                    </button>
                  )
                )}
              </div>

              <button
                disabled={isFormLocked}
                onClick={() => {
                  setSelectedPreset("custom");
                  setStep("schedule");
                }}
                className={`w-full card-gradient rounded-lg p-4 text-left transition-all ${
                  selectedPreset === "custom"
                    ? "!border-cyan/60 !bg-gradient-to-b !from-cyan/[0.08] !to-transparent shadow-[0_0_20px_rgba(0,229,255,0.08)]"
                    : ""
                } ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="font-medium text-sm">Custom Schedule</div>
                <div className="text-xs text-white/40 mt-1">
                  Pick your own cliff + vest duration
                </div>
              </button>

              {/* Custom schedule options */}
              {selectedPreset === "custom" && (
                <div className="space-y-3 pl-4 border-l border-white/10">
                  <div>
                    <label htmlFor="cliff-duration" className="block text-xs text-white/50 mb-1">
                      Cliff Duration
                    </label>
                    <div className="relative">
                      <select
                        id="cliff-duration"
                        value={customCliff}
                        disabled={isFormLocked}
                        onChange={(e) =>
                          setCustomCliff(Number(e.target.value))
                        }
                        className={`w-full appearance-none bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-colors cursor-pointer ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <option value={0}>No cliff</option>
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d.seconds} value={d.seconds}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="total-duration" className="block text-xs text-white/50 mb-1">
                      Total Vest Duration
                    </label>
                    <div className="relative">
                      <select
                        id="total-duration"
                        value={customTotal}
                        disabled={isFormLocked}
                        onChange={(e) =>
                          setCustomTotal(Number(e.target.value))
                        }
                        className={`w-full appearance-none bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-colors cursor-pointer ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                      {DURATION_OPTIONS.filter(
                        (d) => d.seconds >= customCliff
                      ).map((d) => (
                        <option key={d.seconds} value={d.seconds}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  {customCliff > customTotal && (
                    <p className="text-xs text-red-400">
                      Cliff can&apos;t be longer than total duration
                    </p>
                  )}
                  {customCliff > 0 && customCliff === customTotal && (
                    <p className="text-xs text-amber-400/80">
                      Cliff equals total — this creates a lump sum lock that unlocks all at once after {Math.floor(customCliff / 86400)}d.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Amount Input */}
            <section className="w-full space-y-3">
              <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
                Amount
              </h3>
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
                    if (/^(\d+\.?\d{0,6}|\d*\.\d{1,6})$/.test(v) || v === "") {
                      setAmountInput(v);
                      setStep("schedule");
                    }
                  }}
                  className={`w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-colors pr-16 sm:pr-20 ${isFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">
                  USDC
                </span>
              </div>
              {isConnected && balance === undefined && !isBalanceError && (
                <div className="text-xs text-white/30 animate-pulse">
                  Loading balance...
                </div>
              )}
              {isConnected && isBalanceError && (
                <div className="flex items-center gap-2 text-xs text-red-400/80">
                  <span>Failed to load balance</span>
                  <button
                    onClick={() => refetchBalance()}
                    className="underline hover:text-red-300 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
              {isConnected && balance !== undefined && (
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>
                    Balance: {formatUnits(balance, USDC_DECIMALS)} USDC
                  </span>
                  <button
                    disabled={isFormLocked || balance === BigInt(0)}
                    onClick={() => {
                      const maxDeposit = computeMaxDeposit(balance);
                      setAmountInput(formatUnits(maxDeposit, USDC_DECIMALS));
                      setStep("schedule");
                    }}
                    className={`text-white/60 hover:text-white underline ${isFormLocked || balance === BigInt(0) ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={`Max lock amount after ${BROKER_FEE_PCT} fee`}
                  >
                    Max{BROKER_FEE > BigInt(0) ? " (net of fee)" : ""}
                  </button>
                </div>
              )}
              {isConnected && depositAmount > 0 && !meetsMinimum && (
                <p className="text-xs text-red-400">
                  Minimum lock amount is 1 USDC
                </p>
              )}
              {isConnected && !hasEnoughBalance && depositAmount > 0 && meetsMinimum && (
                <p className="text-xs text-red-400">
                  Insufficient balance — you have{" "}
                  {balance !== undefined ? formatUnits(balance, USDC_DECIMALS) : "—"} USDC
                  but need {formatUnits(totalAmount, USDC_DECIMALS)} USDC (incl. {BROKER_FEE_PCT} fee)
                </p>
              )}
              {IS_TESTNET && isConnected && (
                <button
                  onClick={() =>
                    writeFaucet({
                      address: USDC_ADDRESS,
                      abi: testUsdcAbi,
                      functionName: "faucet",
                    })
                  }
                  disabled={isFauceting || isFaucetConfirming}
                  className="text-xs text-cyan/70 hover:text-cyan underline transition-colors disabled:opacity-50"
                >
                  {isFauceting
                    ? "Confirm in wallet..."
                    : isFaucetConfirming
                      ? "Minting..."
                      : "Mint 10,000 test USDC"}
                </button>
              )}
            </section>

            {/* Timeline Preview */}
            {depositAmount > 0 && (
              <section className="w-full space-y-3">
                <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
                  Timeline Preview
                </h3>
                <TimelinePreview
                  cliffSeconds={schedule.cliffSeconds}
                  totalSeconds={schedule.totalSeconds}
                  isLumpSum={schedule.isLumpSum}
                  depositAmount={depositAmount}
                />
              </section>
            )}

            {/* Fee Breakdown */}
            {depositAmount > 0 && (
              <section className="w-full border border-white/10 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Lock amount</span>
                  <span>{formatUnits(depositAmount, USDC_DECIMALS)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">
                    Lock fee {BROKER_FEE > BigInt(0) ? `(${BROKER_FEE_PCT})` : IS_TESTNET ? "(disabled on testnet)" : "(waived)"}
                  </span>
                  <span>{formatUnits(fee, USDC_DECIMALS)} USDC</span>
                </div>
                <div className="flex justify-between font-medium border-t border-white/10 pt-2">
                  <span>Total</span>
                  <span>{formatUnits(totalAmount, USDC_DECIMALS)} USDC</span>
                </div>
              </section>
            )}

            {/* Action Buttons */}
            <section className="w-full space-y-3">
              {!isConnected ? (
                <div className="text-center text-white/50 text-sm">
                  Connect your wallet to continue
                </div>
              ) : step === "schedule" || step === "confirm" ? (
                <>
                  {isValidForm ? (
                    <button
                      onClick={() => setStep("confirm")}
                      className="w-full bg-cyan text-black font-semibold rounded-lg py-3 hover:bg-cyan/90 transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
                    >
                      Review Lock
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-white/10 text-white/30 font-semibold rounded-lg py-3 cursor-not-allowed"
                    >
                      {depositAmount === BigInt(0)
                        ? "Enter an amount"
                        : !meetsMinimum
                          ? "Minimum 1 USDC"
                          : !hasEnoughBalance
                            ? "Insufficient balance (incl. fee)"
                            : "Review Lock"}
                    </button>
                  )}
                </>
              ) : step === "approve" ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <Spinner />
                  <div className="text-sm text-white/60">
                    {isApproving
                      ? "Confirm in wallet..."
                      : isApproveConfirming
                        ? "Waiting for confirmation..."
                        : "Approving USDC..."}
                  </div>
                  {isApproveConfirming && approveTxHash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${approveTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white/30 hover:text-cyan/60 transition-colors underline"
                    >
                      View on BaseScan
                    </a>
                  )}
                </div>
              ) : step === "lock" ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <Spinner />
                  <div className="text-sm text-white/60">
                    {isLocking
                      ? "Confirm in wallet..."
                      : isLockConfirming
                        ? "Waiting for confirmation..."
                        : "Creating lock..."}
                  </div>
                  {isLockConfirming && lockTxHash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${lockTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white/30 hover:text-cyan/60 transition-colors underline"
                    >
                      View on BaseScan
                    </a>
                  )}
                </div>
              ) : null}
            </section>

            {/* Confirmation Modal */}
            {step === "confirm" && (
              <ConfirmDialog
                schedule={schedule}
                depositAmount={depositAmount}
                fee={fee}
                totalAmount={totalAmount}
                hasEnoughAllowance={hasEnoughAllowance}
                isApproveInFlight={isApproving || isApproveConfirming}
                isLockInFlight={isLocking || isLockConfirming}
                confirmed={confirmed}
                onConfirmedChange={setConfirmed}
                onApprove={handleApprove}
                onLock={handleLock}
                onCancel={() => {
                  setStep("schedule");
                  setConfirmed(false);
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function TimelinePreview({
  cliffSeconds,
  totalSeconds,
  isLumpSum,
  depositAmount,
}: {
  cliffSeconds: number;
  totalSeconds: number;
  isLumpSum: boolean;
  depositAmount: bigint;
}) {
  const cliffPct = totalSeconds > 0 ? (cliffSeconds / totalSeconds) * 100 : 0;

  return (
    <div className="border border-white/10 rounded-lg p-4 space-y-3">
      {/* Visual bar */}
      <div className="relative h-6 bg-white/5 rounded-full overflow-hidden">
        {cliffSeconds > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-amber-500/30 border-r border-amber-500/50"
            style={{ width: `${cliffPct}%` }}
          />
        )}
        <div
          className="absolute inset-y-0 bg-cyan/30"
          style={{
            left: `${cliffPct}%`,
            width: `${100 - cliffPct}%`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-white/40">
        <span>Now</span>
        {cliffSeconds > 0 && cliffSeconds < totalSeconds && (
          <span>Cliff: {formatDuration(cliffSeconds)}</span>
        )}
        <span>
          {isLumpSum ? "Unlock" : "Fully vested"}: {formatDuration(totalSeconds)}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/50">
        {isLumpSum ? (
          <>
            {formatUnits(depositAmount, USDC_DECIMALS)} USDC unlocks all at
            once after {formatDuration(totalSeconds)}
          </>
        ) : cliffSeconds > 0 ? (
          <>
            Nothing unlocks for {formatDuration(cliffSeconds)}, then{" "}
            {formatUnits(depositAmount, USDC_DECIMALS)} USDC vests linearly
            over {formatDuration(totalSeconds - cliffSeconds)}
          </>
        ) : (
          <>
            {formatUnits(depositAmount, USDC_DECIMALS)} USDC vests linearly
            over {formatDuration(totalSeconds)}
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
  isApproveInFlight,
  isLockInFlight,
  confirmed,
  onConfirmedChange,
  onApprove,
  onLock,
  onCancel,
}: {
  schedule: { label: string; cliffSeconds: number; totalSeconds: number; isLumpSum: boolean };
  depositAmount: bigint;
  fee: bigint;
  totalAmount: bigint;
  hasEnoughAllowance: boolean;
  isApproveInFlight: boolean;
  isLockInFlight: boolean;
  confirmed: boolean;
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
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm lock"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="bg-[#111] border border-white/15 rounded-t-xl sm:rounded-xl max-w-md w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 min-h-0">
          <h3 className="text-lg font-bold">Confirm Lock</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Schedule</span>
              <span>{schedule.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Lock amount</span>
              <span>{formatUnits(depositAmount, USDC_DECIMALS)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Lock fee {BROKER_FEE > BigInt(0) ? `(${BROKER_FEE_PCT})` : IS_TESTNET ? "(disabled on testnet)" : "(waived)"}</span>
              <span>{formatUnits(fee, USDC_DECIMALS)} USDC</span>
            </div>
            <div className="flex justify-between font-medium border-t border-white/10 pt-2">
              <span>Total from wallet</span>
              <span>{formatUnits(totalAmount, USDC_DECIMALS)} USDC</span>
            </div>
            {schedule.cliffSeconds > 0 && (
              <div className="flex justify-between">
                <span className="text-white/50">Cliff</span>
                <span>{formatDuration(schedule.cliffSeconds)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/50">
                {schedule.isLumpSum ? "Unlock after" : "Vest duration"}
              </span>
              <span>{formatDuration(schedule.totalSeconds)}</span>
            </div>
          </div>

          {/* Non-cancelable warning */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            This lock is <strong>non-cancelable</strong> and{" "}
            <strong>non-transferable</strong>. Once created, you cannot withdraw
            early or move the stream. You will only receive funds according to
            the vesting schedule.
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => onConfirmedChange(e.target.checked)}
              className="mt-1 accent-white focus:ring-2 focus:ring-cyan/50 focus:ring-offset-1 focus:ring-offset-black rounded"
            />
            <span className="text-sm text-white/70">
              I understand this lock is permanent and non-cancelable. Locks are
              enforced by Sablier&apos;s audited on-chain contracts.
            </span>
          </label>
        </div>

        <div className="flex gap-3 p-5 sm:p-6 pt-0 sm:pt-0 pb-safe border-t border-white/10 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 border border-white/20 rounded-lg min-h-[44px] py-2.5 text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          {!hasEnoughAllowance ? (
            <button
              onClick={onApprove}
              disabled={!confirmed || isApproveInFlight}
              className="flex-1 bg-cyan text-black font-semibold rounded-lg min-h-[44px] py-2.5 text-sm hover:bg-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
            >
              {isApproveInFlight ? "Approving..." : "Approve USDC"}
            </button>
          ) : (
            <button
              onClick={onLock}
              disabled={!confirmed || isLockInFlight}
              className="flex-1 bg-cyan text-black font-semibold rounded-lg min-h-[44px] py-2.5 text-sm hover:bg-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
            >
              {isLockInFlight ? "Creating..." : "Create Lock"}
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
  onCreateAnother,
}: {
  txHash: `0x${string}`;
  streamId: bigint;
  depositAmount: bigint;
  schedule: { label: string; cliffSeconds: number; totalSeconds: number; isLumpSum: boolean };
  onCreateAnother: () => void;
}) {
  const [createdAtMs] = useState(() => Date.now());
  const now = Math.floor(createdAtMs / 1000);
  const endDate = new Date((now + schedule.totalSeconds) * 1000);

  const nextUnlock = (() => {
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
    <div className="space-y-5 sm:space-y-6 py-4 sm:py-8 w-full">
      <div className="text-center space-y-4">
        {/* Animated shield + check icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-full bg-cyan/[0.08] blur-[40px] animate-glow-pulse" />
          <svg
            className="relative w-20 h-20 glow-cyan animate-success-pop"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M32 4L8 16v16c0 15.46 10.24 29.9 24 33.46C45.76 61.9 56 47.46 56 32V16L32 4Z"
              stroke="#00E5FF"
              strokeWidth="2"
              fill="rgba(0,229,255,0.06)"
            />
            <path
              d="M32 10L12 20v12c0 13.2 8.53 25.5 20 28.6C43.47 57.5 52 45.2 52 32V20L32 10Z"
              stroke="#00E5FF"
              strokeWidth="0.5"
              strokeOpacity="0.3"
              fill="none"
            />
            <path
              d="M22 33l7 7 13-13"
              stroke="#00E5FF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-2xl font-bold">Lock Created!</h3>
        <p className="text-white/50 text-sm max-w-sm mx-auto">
          Your funds are now locked in a Sablier stream. They will vest according
          to your chosen schedule.
        </p>
      </div>

      <ShareCard
        streamId={streamId}
        amountLocked={formatUnits(depositAmount, USDC_DECIMALS)}
        scheduleType={schedule.label}
        endDate={endDate}
        nextUnlock={nextUnlock}
        sablierAddress={SABLIER_LOCKUP}
      />

      <div className="space-y-3 text-center">
        <a
          href={`${EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-white/60 hover:text-white underline"
        >
          View on BaseScan
        </a>
        <Link
          href="/vaults"
          className="inline-block bg-cyan text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-cyan/90 transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
        >
          View Your Vaults
        </Link>
        <button
          onClick={onCreateAnother}
          className="block text-sm text-white/40 hover:text-white/60 underline mx-auto"
        >
          Create another lock
        </button>
      </div>
    </div>
  );
}

export default function CreateLock() {
  return (
    <ErrorBoundary fallbackTitle="Failed to load lock creator">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-white/50">
            Loading...
          </div>
        }
      >
        <CreateLockInner />
      </Suspense>
    </ErrorBoundary>
  );
}
