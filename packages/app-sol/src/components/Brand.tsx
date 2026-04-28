import Image from "next/image";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Flat SVG mark — used at small sizes (header, footer) where the 3D padlock
 * detail would get muddy. Stays tight and legible at 20-36px.
 */
export function RipGuardMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("glow-cyan", className)}
      aria-hidden="true"
    >
      <path
        d="M80 10L121 26L149 59V101L121 134L80 150L39 134L11 101V59L39 26L80 10Z"
        fill="#07161C"
        stroke="#3DAFC2"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M80 26L111 38L133 64V96L111 122L80 134L49 122L27 96V64L49 38L80 26Z"
        fill="#0B1D24"
        stroke="#11414C"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M80 45L55 57V80C55 94 65 109 80 114C95 109 105 94 105 80V57L80 45Z"
        fill="#0D252D"
        stroke="#38A8BA"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M66 79V68C66 60.268 72.268 54 80 54C87.732 54 94 60.268 94 68V79"
        stroke="#7AD2E2"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect
        x="58"
        y="76"
        width="44"
        height="34"
        rx="8"
        fill="#12303A"
        stroke="#7AD2E2"
        strokeWidth="3"
      />
      <circle cx="80" cy="91" r="4.5" fill="#7AD2E2" />
      <path d="M80 95.5V101.5" stroke="#7AD2E2" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 80H49" stroke="#184F59" strokeWidth="2" strokeLinecap="round" />
      <path d="M111 80H122" stroke="#184F59" strokeWidth="2" strokeLinecap="round" />
      <circle cx="80" cy="26" r="3" fill="#7AD2E2" fillOpacity="0.9" />
    </svg>
  );
}

/**
 * 3D raster padlock mark — used at large sizes where the detail can breathe.
 * The halo classes use bg-cyan utilities, which on this surface resolve to
 * the violet accent via the --cyan → --violet alias in globals.css. The
 * drop-shadow is hardcoded to violet rgba so it visually matches.
 */
export function RipGuardMark3D({
  className,
  pulse = false,
}: {
  className?: string;
  pulse?: boolean;
}) {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <div
        className={cn(
          "absolute inset-[-35%] rounded-full bg-cyan/25 blur-[48px]",
          pulse && "animate-glow-pulse"
        )}
      />
      <div className="absolute inset-[-10%] rounded-full bg-cyan/15 blur-[20px]" />
      <Image
        src="/mark-1024.png"
        alt=""
        width={1024}
        height={1024}
        className="relative w-full h-full drop-shadow-[0_0_32px_rgba(155,107,255,0.5)]"
        aria-hidden="true"
        priority
      />
    </div>
  );
}

export function RipGuardWordmark({
  className,
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="brand-wordmark" aria-label="RipGuard">
        <span className="brand-wordmark-dim">RIP</span>
        <span className="brand-wordmark-accent">GUARD</span>
      </span>
      {showTagline ? (
        <span className="brand-tagline">Time-Locked Vaults On Solana</span>
      ) : null}
    </div>
  );
}

export function RipGuardLockup({
  className,
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <RipGuardMark3D className="h-24 w-24 sm:h-28 sm:w-28 shrink-0" />
      <RipGuardWordmark showTagline={showTagline} />
    </div>
  );
}
