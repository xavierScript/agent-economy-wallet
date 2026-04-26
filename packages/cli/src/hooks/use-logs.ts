/**
 * hooks/use-logs.ts
 *
 * React hook that reads audit log entries on mount and re-reads
 * on a configurable interval or when `refreshKey` changes.
 */

import { useState, useEffect } from "react";
import type { AuditLogEntry } from "@agent-economy-wallet/core";
import type { WalletServices } from "../services.js";

export interface UseLogsOptions {
  /** Max log entries to fetch. Default 20. */
  count?: number;
  /** Only show logs for this wallet. */
  walletId?: string;
  /** Polling interval in ms (0 = no polling). Default 3 000. */
  interval?: number;
  /** Bump to force refresh. */
  refreshKey?: number;
  /** Whether to allow faster polling */
  allowFasterPolling?: boolean;
}

export function useLogs(services: WalletServices, opts: UseLogsOptions = {}) {
  const {
    count = 20,
    walletId,
    interval = 3_000,
    refreshKey = 0,
    allowFasterPolling,
  } = opts;
  const safeInterval =
    !allowFasterPolling && interval > 0 && interval < 1000 ? 1000 : interval;
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = () => {
      const entries = walletId
        ? services.auditLogger.readWalletLogs(walletId, count)
        : services.auditLogger.readRecentLogs(count);
      setLogs(entries);
      setLoading(false);
    };

    fetch();

    if (safeInterval > 0) {
      const id = setInterval(fetch, safeInterval);
      return () => clearInterval(id);
    }
  }, [refreshKey, count, walletId, safeInterval]);

  return { logs, loading };
}
