"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { parseUnits, formatUnits, keccak256, toHex, type Address, type TransactionReceipt } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import Image from "next/image";
import {
  PRESETS,
  USDC_ADDRESS,
  BROKER_FEE,
  SABLIER_LOCKUP,
  TREASURY,
  EXPLORER_URL,
  IS_TESTNET,
} from "@/config/contracts";
import { erc20Abi, sablierLockupAbi, testUsdcAbi } from "@/config/abis";
import { ShareCard } from "@/components/ShareCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";

type PresetKey = keyof typeof PRESETS;

const USDC_DECIMALS = 6;

// Duration options for custom schedule
const DURATION_OPTIONS = [
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
  { label: "14 days", seconds: 1209600 },
  { label: "30 days", seconds: 2592000 },
  { label: "60 days", seconds: 5184000 },
  { label: "90 days", seconds: 7776000 },
  { label: "180 days", seconds: 15552000 },
  { label: "365 days", seconds: 31536000 },
];

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

function CreateLockInner() {
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset") as PresetKey | null;

  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  // Schedule state
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | "custom">(
    presetParam && presetParam in PRESETS ? presetParam : "custom"
  );
  const [customCliff, setCustomCliff] = useState(0);
  const [customTotal, setCustomTotal] = useState(604800); // 7 days default

  // Auto-clamp total to be >= cliff
  useEffect(() => {
    if (customCliff > customTotal) {
      setCustomTotal(customCliff);
    }
  }, [customCliff, customTotal]);
  const [amountInput, setAmountInput] = useState("");
  const [step, setStep] = useState<Step>("schedule");

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
    return {
      cliffSeconds: customCliff,
      totalSeconds: customTotal,
      isLumpSum: customCliff === customTotal && customCliff > 0,
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
  const { data: balance, refetch: refetchBalance } = useReadContract({
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
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // Lock tx
  const {
    writeContract: writeLock,
    data: lockTxHash,
    isPending: isLocking,
    isError: isLockError,
  } = useWriteContract();

  const { data: lockReceipt, isLoading: isLockConfirming, isSuccess: isLockConfirmed } =
    useWaitForTransactionReceipt({ hash: lockTxHash });

  // Testnet faucet
  const {
    writeContract: writeFaucet,
    isPending: isFauceting,
    data: faucetTxHash,
  } = useWriteContract();

  const { isSuccess: isFaucetConfirmed } = useWaitForTransactionReceipt({
    hash: faucetTxHash,
  });

  useEffect(() => {
    if (isFaucetConfirmed) {
      refetchBalance();
    }
  }, [isFaucetConfirmed, refetchBalance]);

  const handleApprove = useCallback(() => {
    setStep("approve");
    writeApprove({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [SABLIER_LOCKUP, totalAmount],
    });
  }, [writeApprove, totalAmount]);

  const handleLock = useCallback(() => {
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
      refetchAllowance();
      setStep("confirm");
      toast("USDC approved. Ready to lock.", "success");
    }
  }, [isApproveConfirmed, step, refetchAllowance, toast]);

  useEffect(() => {
    if (isLockConfirmed && step === "lock" && lockTxHash) {
      setStep("success");
      toast("Lock created!", "success", {
        label: "View on BaseScan",
        href: `${EXPLORER_URL}/tx/${lockTxHash}`,
      });
    }
  }, [isLockConfirmed, step, lockTxHash, toast]);

  // Reset step if user rejects wallet prompt
  useEffect(() => {
    if (isApproveError && step === "approve") {
      setStep("confirm");
      toast("Approval rejected or failed.", "error");
    }
  }, [isApproveError, step, toast]);

  useEffect(() => {
    if (isLockError && step === "lock") {
      setStep("confirm");
      toast("Lock creation failed or was rejected.", "error");
    }
  }, [isLockError, step, toast]);

  const canProceed =
    depositAmount > 0 && schedule.totalSeconds > 0 && isConnected;

  const isValidForm = canProceed && hasEnoughBalance;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/[0.06] relative z-10 backdrop-blur-xl bg-black/60">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-icon.png" alt="RipGuard" width={26} height={26} className="glow-cyan" />
          <span className="text-lg font-bold tracking-tight">RipGuard</span>
        </Link>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>

      {/* Beta warning */}
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-2 text-center text-sm text-yellow-400">
        Unaudited beta. Do not deposit what you can&apos;t afford to lose.
      </div>

      <main className="relative flex-1 flex flex-col items-center gap-8 px-6 py-12 max-w-xl mx-auto w-full">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-cyan/[0.03] blur-[120px] pointer-events-none" />

        <h2 className="relative text-2xl font-bold">Create Lock</h2>

        {step === "success" ? (
          <SuccessView
            txHash={lockTxHash!}
            streamId={parseStreamIdFromReceipt(lockReceipt)}
            depositAmount={depositAmount}
            schedule={schedule}
          />
        ) : (
          <>
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
                      onClick={() => {
                        setSelectedPreset(key);
                        setStep("schedule");
                      }}
                      className={`card-gradient rounded-lg p-4 text-left transition-all ${
                        selectedPreset === key
                          ? "!border-cyan/60 !bg-gradient-to-b !from-cyan/[0.08] !to-transparent shadow-[0_0_20px_rgba(0,229,255,0.08)]"
                          : ""
                      }`}
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
                onClick={() => {
                  setSelectedPreset("custom");
                  setStep("schedule");
                }}
                className={`w-full card-gradient rounded-lg p-4 text-left transition-all ${
                  selectedPreset === "custom"
                    ? "!border-cyan/60 !bg-gradient-to-b !from-cyan/[0.08] !to-transparent shadow-[0_0_20px_rgba(0,229,255,0.08)]"
                    : ""
                }`}
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
                    <label className="block text-xs text-white/50 mb-1">
                      Cliff Duration
                    </label>
                    <div className="relative">
                      <select
                        value={customCliff}
                        onChange={(e) =>
                          setCustomCliff(Number(e.target.value))
                        }
                        className="w-full appearance-none bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <option value={0}>No cliff</option>
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d.seconds} value={d.seconds}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">
                      Total Vest Duration
                    </label>
                    <div className="relative">
                      <select
                        value={customTotal}
                        onChange={(e) =>
                          setCustomTotal(Number(e.target.value))
                        }
                        className="w-full appearance-none bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                      {DURATION_OPTIONS.filter(
                        (d) => d.seconds >= customCliff
                      ).map((d) => (
                        <option key={d.seconds} value={d.seconds}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  {customCliff > customTotal && (
                    <p className="text-xs text-red-400">
                      Cliff can&apos;t be longer than total duration
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
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^[0-9]*\.?[0-9]{0,6}$/.test(v) || v === "") {
                      setAmountInput(v);
                      setStep("schedule");
                    }
                  }}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-colors pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">
                  USDC
                </span>
              </div>
              {isConnected && balance !== undefined && (
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>
                    Balance: {formatUnits(balance, USDC_DECIMALS)} USDC
                  </span>
                  <button
                    onClick={() => {
                      const maxDeposit = computeMaxDeposit(balance);
                      setAmountInput(formatUnits(maxDeposit, USDC_DECIMALS));
                      setStep("schedule");
                    }}
                    className="text-white/60 hover:text-white underline"
                  >
                    Max
                  </button>
                </div>
              )}
              {isConnected && !hasEnoughBalance && depositAmount > 0 && (
                <p className="text-xs text-red-400">
                  Insufficient USDC balance
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
                  disabled={isFauceting}
                  className="text-xs text-cyan/70 hover:text-cyan underline transition-colors"
                >
                  {isFauceting ? "Minting..." : "Mint 10,000 test USDC"}
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
                    Audit Fund fee (0.5%)
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
                        : !hasEnoughBalance
                          ? "Insufficient balance"
                          : "Review Lock"}
                    </button>
                  )}
                </>
              ) : step === "approve" ? (
                <div className="text-center space-y-2">
                  <div className="text-sm text-white/60">
                    {isApproving
                      ? "Confirm in wallet..."
                      : isApproveConfirming
                        ? "Waiting for confirmation..."
                        : "Approving USDC..."}
                  </div>
                </div>
              ) : step === "lock" ? (
                <div className="text-center space-y-2">
                  <div className="text-sm text-white/60">
                    {isLocking
                      ? "Confirm in wallet..."
                      : isLockConfirming
                        ? "Waiting for confirmation..."
                        : "Creating lock..."}
                  </div>
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
                onApprove={handleApprove}
                onLock={handleLock}
                onCancel={() => setStep("schedule")}
              />
            )}
          </>
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
            className="absolute inset-y-0 left-0 bg-red-500/30 border-r border-red-500/50"
            style={{ width: `${cliffPct}%` }}
          />
        )}
        <div
          className="absolute inset-y-0 bg-green-500/30"
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
            over {formatDuration(totalSeconds)}
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
  onApprove,
  onLock,
  onCancel,
}: {
  schedule: { label: string; cliffSeconds: number; totalSeconds: number; isLumpSum: boolean };
  depositAmount: bigint;
  fee: bigint;
  totalAmount: bigint;
  hasEnoughAllowance: boolean;
  onApprove: () => void;
  onLock: () => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-zinc-900 border border-white/15 rounded-xl p-6 max-w-md w-full space-y-5">
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
            <span className="text-white/50">Audit Fund fee</span>
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
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 accent-white"
          />
          <span className="text-sm text-white/70">
            I understand this lock is permanent and non-cancelable. I accept
            the risk of using unaudited software.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-white/20 rounded-lg py-2.5 text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          {!hasEnoughAllowance ? (
            <button
              onClick={onApprove}
              disabled={!confirmed}
              className="flex-1 bg-cyan text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
            >
              Approve USDC
            </button>
          ) : (
            <button
              onClick={onLock}
              disabled={!confirmed}
              className="flex-1 bg-cyan text-black font-semibold rounded-lg py-2.5 text-sm hover:bg-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
            >
              Create Lock
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
}: {
  txHash: `0x${string}`;
  streamId: bigint;
  depositAmount: bigint;
  schedule: { label: string; cliffSeconds: number; totalSeconds: number; isLumpSum: boolean };
}) {
  const now = Math.floor(Date.now() / 1000);
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
    <div className="space-y-6 py-8 w-full">
      <div className="text-center space-y-3">
        <div className="text-5xl">&#x1f512;</div>
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
        <Link
          href="/create"
          className="block text-sm text-white/40 hover:text-white/60 underline"
        >
          Create another lock
        </Link>
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
