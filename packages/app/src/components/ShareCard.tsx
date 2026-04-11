"use client";

import { useRef, useEffect, useState, useCallback } from "react";

type ShareCardProps = {
  streamId: bigint;
  amountLocked: string; // formatted USDC string
  scheduleType: string;
  endDate: Date;
  nextUnlock: string; // countdown string
  sablierAddress: string;
};

const CARD_W = 600;
const CARD_H = 340;

function drawCard(
  ctx: CanvasRenderingContext2D,
  props: ShareCardProps,
  masked: boolean
) {
  const { streamId, amountLocked, scheduleType, endDate, nextUnlock, sablierAddress } = props;

  // Background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2);

  // Accent line at top
  const gradient = ctx.createLinearGradient(0, 0, CARD_W, 0);
  gradient.addColorStop(0, "#47B4CC");
  gradient.addColorStop(1, "#3A99AB");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_W, 3);

  // Branding
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("RipGuard", 32, 44);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText("Proof of Lock", 32, 64);

  // Chain badge
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, CARD_W - 100, 24, 68, 26, 13);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText("Base", CARD_W - 78, 42);

  // Amount
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
  const displayAmount = masked ? "***.**" : amountLocked;
  ctx.fillText(`${displayAmount} USDC`, 32, 120);

  // Schedule type
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText(scheduleType, 32, 148);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 170);
  ctx.lineTo(CARD_W - 32, 170);
  ctx.stroke();

  // Info grid
  const infoY = 200;
  const col1 = 32;
  const col2 = CARD_W / 2;

  // Next unlock
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("NEXT UNLOCK", col1, infoY);
  ctx.fillStyle = "#47B4CC";
  ctx.font = "16px system-ui, -apple-system, sans-serif";
  ctx.fillText(nextUnlock, col1, infoY + 22);

  // End date
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("END DATE", col2, infoY);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    col2,
    infoY + 22
  );

  // Lock ID
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("LOCK", col1, infoY + 60);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  ctx.fillText(`#${streamId.toString()}`, col1, infoY + 82);

  // Contract
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("CONTRACT", col2, infoY + 60);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  const shortAddr = `${sablierAddress.slice(0, 6)}...${sablierAddress.slice(-4)}`;
  ctx.fillText(shortAddr, col2, infoY + 82);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.fillText("Non-cancelable | Non-transferable | Powered by Sablier v2.0", 32, CARD_H - 18);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function ShareCard(props: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [masked, setMasked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI — set internal resolution, let CSS handle display size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CARD_W * dpr;
    canvas.height = CARD_H * dpr;
    ctx.scale(dpr, dpr);

    drawCard(ctx, props, masked);
  }, [props, masked]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `ripguard-lock-${props.streamId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [props.streamId]);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png");
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full max-w-[600px] rounded-lg border border-white/10"
          style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
        />
        <button
          onClick={() => setMasked(!masked)}
          aria-label={masked ? "Show locked amount" : "Hide locked amount"}
          className="absolute top-3 right-3 text-xs bg-black/60 border border-white/20 rounded px-2 py-1 text-white/60 hover:text-white transition-colors"
        >
          {masked ? "Show" : "Hide"} amount
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 border border-white/20 rounded-lg py-2 text-sm hover:bg-white/5 transition-colors"
        >
          Download PNG
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 border border-white/20 rounded-lg py-2 text-sm hover:bg-white/5 transition-colors"
        >
          {copied ? "Copied!" : copyFailed ? "Copy not supported" : "Copy to Clipboard"}
        </button>
      </div>
    </div>
  );
}
