/**
 * hooks/use-wallets.ts
 *
 * React hook that fetches the wallet list on mount and re-fetches
 * on a configurable interval or when `refreshKey` changes.
 */

import { useState, useEffect } from "react";
import type { WalletInfo } from "@agentic-wallet/core";
import type { WalletServices } from "../services.js";

export interface UseWalletsOptions {
  /** Polling interval in ms (0 = no polling). Default 5 000. */
  interval?: number;
  /** Bump this value to force an immediate refresh. */
  refreshKey?: number;
}

export function useWallets(
  services: WalletServices,
  opts: UseWalletsOptions = {},
) {
  const { interval = 5_000, refreshKey = 0 } = opts;
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        const list = await services.walletService.listWallets();
        if (!cancelled) {
          setWallets(list);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();

    if (interval > 0) {
      const id = setInterval(fetch, interval);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [refreshKey, interval]);

  return { wallets, loading, error };
}
