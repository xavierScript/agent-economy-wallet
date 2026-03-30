/**
 * hooks/use-registry.ts
 *
 * React hook that fetches the decentralized agent registry via on-chain discovery.
 * Polling interval defaults to 0 (no polling) to avoid hitting RPC limits,
 * but can be refreshed by bumping refreshKey.
 */

import { useState, useEffect } from "react";
import { discoverRegistry, type DiscoveredAgent } from "@agent-economy-wallet/core";
import type { WalletServices } from "../services.js";

export interface UseRegistryOptions {
  /** Polling interval in ms (0 = no polling). Default 0 due to RPC intensity. */
  interval?: number;
  /** Bump this value to force an immediate refresh. */
  refreshKey?: number;
  /** Max signatures to scan for registry discovery. Default 100. */
  limit?: number;
}

export function useRegistry(
  services: WalletServices,
  opts: UseRegistryOptions = {},
) {
  const { interval = 0, refreshKey = 0, limit = 100 } = opts;
  const [agents, setAgents] = useState<DiscoveredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchRegistry = async () => {
      // Don't set loading to true again on background intervals to avoid flicker,
      // but do set it on manual refresh
      if (agents.length === 0) setLoading(true);

      try {
        const list = await discoverRegistry(services.connection.getConnection(), limit);
        if (!cancelled) {
          setAgents(list);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Unknown error discovering registry");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRegistry();

    if (interval > 0) {
      const id = setInterval(fetchRegistry, interval);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [refreshKey, interval, limit, services.connection]);

  return { agents, loading, error };
}
