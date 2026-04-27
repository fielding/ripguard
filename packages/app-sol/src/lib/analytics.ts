import { track } from "@vercel/analytics";

export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
) {
  try {
    track(name, properties);
  } catch {
    // Analytics should never break the app
  }
}

export function trackWalletConnect() {
  trackEvent("wallet_connected");
}

export function trackLockCreated(params: {
  schedule: string;
  amountUsd: number;
  cliffSeconds: number;
  totalSeconds: number;
}) {
  trackEvent("lock_created", params);
}

export function trackLockApproved(amountUsd: number) {
  trackEvent("lock_approved", { amountUsd });
}

export function trackClaim(streamId: string) {
  trackEvent("vault_claimed", { streamId });
}

export function trackContractError(params: {
  action: string;
  error: string;
  contract?: string;
}) {
  trackEvent("contract_error", {
    action: params.action,
    error: params.error.slice(0, 200),
    contract: params.contract ?? "unknown",
  });
}

export function trackAppError(params: {
  message: string;
  componentStack?: string;
}) {
  trackEvent("app_error", {
    message: params.message.slice(0, 200),
    componentStack: (params.componentStack ?? "").slice(0, 200),
  });
}
