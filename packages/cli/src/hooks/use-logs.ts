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
}

export function useLogs(services: WalletServices, opts: UseLogsOptions = {}) {
  const { count = 20, walletId, interval = 3_000, refreshKey = 0 } = opts;
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

    if (interval > 0) {
      const id = setInterval(fetch, interval);
      return () => clearInterval(id);
    }
  }, [refreshKey, count, walletId, interval]);

  return { logs, loading };
}
