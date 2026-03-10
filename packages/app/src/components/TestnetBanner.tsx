"use client";

import { IS_TESTNET, USDC_ADDRESS } from "@/config/contracts";
import { testUsdcAbi } from "@/config/abis";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useToast } from "@/components/Toast";
import { useEffect } from "react";
import { isUserRejection, extractErrorReason } from "@/lib/errors";

export function TestnetBanner() {
  if (!IS_TESTNET) return null;
  return <TestnetBannerInner />;
}

function TestnetBannerInner() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { toast } = useToast();

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
      toast("1,000 test USDC minted!", "success");
    }
  }, [isFaucetConfirmed, toast]);

  useEffect(() => {
    if (isFaucetError) {
      if (isUserRejection(faucetError)) {
        toast("Cancelled.", "error");
      } else {
        toast(extractErrorReason(faucetError), "error");
      }
    }
  }, [isFaucetError, faucetError, toast]);

  const handleMint = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    writeFaucet({
      address: USDC_ADDRESS,
      abi: testUsdcAbi,
      functionName: "faucet",
    });
  };

  const isBusy = isFauceting || isFaucetConfirming;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
      <span className="font-semibold text-amber-400 tracking-wide text-xs uppercase">
        Base Sepolia Testnet
      </span>
      <span className="text-white/40 hidden sm:inline">·</span>
      <span className="text-white/50 text-xs">No real funds required.</span>
      <div className="flex items-center gap-3">
        <button
          onClick={handleMint}
          disabled={isBusy}
          className="bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-xs font-semibold rounded-md px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {isFauceting
            ? "Confirm in wallet…"
            : isFaucetConfirming
              ? "Minting…"
              : isConnected
                ? "Mint 1,000 TestUSDC"
                : "Connect + Mint USDC"}
        </button>
        <a
          href="https://www.alchemy.com/faucets/base-sepolia"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/35 hover:text-amber-400/70 transition-colors underline decoration-white/15 hover:decoration-amber-400/40 whitespace-nowrap"
        >
          Get test ETH
        </a>
      </div>
    </div>
  );
}
