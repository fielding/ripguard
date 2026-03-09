export type VaultData = {
  streamId: bigint;
  totalAmount: bigint;
  cliffSeconds: number;
  totalSeconds: number;
  deposited: bigint;
  withdrawn: bigint;
  startTime: number;
  endTime: number;
  cliffTime: number;
  claimable: bigint;
};

export type VaultFilter = "all" | "ready" | "vesting" | "matured";
export type VaultSort = "newest" | "largest" | "claimable" | "endingSoon";
export type VaultStatus = "ready" | "cliff" | "vesting" | "matured";

export function getVaultStatus(vault: VaultData, now: number): VaultStatus {
  if (vault.claimable > BigInt(0)) return "ready";
  if (now < vault.cliffTime) return "cliff";
  if (now < vault.endTime) return "vesting";
  return "matured";
}

export function getNextUnlockSeconds(vault: VaultData, now: number): number | null {
  if (vault.claimable > BigInt(0)) return 0;
  if (vault.cliffTime > 0 && now < vault.cliffTime) return vault.cliffTime - now;
  if (now < vault.endTime) return vault.endTime - now;
  return null;
}

export function filterVaults(
  vaults: VaultData[],
  filter: VaultFilter,
  now: number,
): VaultData[] {
  if (filter === "all") return vaults;
  return vaults.filter((vault) => {
    const status = getVaultStatus(vault, now);
    if (filter === "ready") return status === "ready";
    if (filter === "vesting") return status === "cliff" || status === "vesting";
    return status === "matured";
  });
}

export function sortVaults(
  vaults: VaultData[],
  sort: VaultSort,
  now: number,
): VaultData[] {
  const items = [...vaults];
  items.sort((left, right) => {
    if (sort === "largest") {
      return compareBigIntDesc(left.deposited, right.deposited);
    }
    if (sort === "claimable") {
      return compareBigIntDesc(left.claimable, right.claimable);
    }
    if (sort === "endingSoon") {
      const leftUnlock = getNextUnlockSeconds(left, now);
      const rightUnlock = getNextUnlockSeconds(right, now);
      return compareNullableNumberAsc(leftUnlock, rightUnlock);
    }
    return Number(right.streamId - left.streamId);
  });
  return items;
}

export function summarizeVaults(vaults: VaultData[], now: number) {
  let locked = BigInt(0);
  let claimable = BigInt(0);
  let claimed = BigInt(0);
  let readyCount = 0;
  let vestingCount = 0;
  let maturedCount = 0;
  let nextUnlockSeconds: number | null = null;

  for (const vault of vaults) {
    locked += vault.deposited;
    claimable += vault.claimable;
    claimed += vault.withdrawn;

    const status = getVaultStatus(vault, now);
    if (status === "ready") {
      readyCount += 1;
    } else if (status === "matured") {
      maturedCount += 1;
    } else {
      vestingCount += 1;
    }

    const unlock = getNextUnlockSeconds(vault, now);
    if (unlock === null) continue;
    if (nextUnlockSeconds === null || unlock < nextUnlockSeconds) {
      nextUnlockSeconds = unlock;
    }
  }

  return {
    locked,
    claimable,
    claimed,
    readyCount,
    vestingCount,
    maturedCount,
    nextUnlockSeconds,
  };
}

function compareBigIntDesc(left: bigint, right: bigint): number {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

function compareNullableNumberAsc(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}
