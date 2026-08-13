import { useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

/**
 * Polls `fetcher` every `intervalMs`, starting immediately on mount/dep
 * change. No SWR/React Query - mirrors the existing app's proven simple
 * setInterval+fetch approach (backend has no WebSockets to justify more).
 *
 * `refetch` lets a caller force an immediate re-fetch outside the interval
 * (e.g. right after an optimistic mutation) without waiting for the next tick.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  intervalMs = 4000,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [refetchNonce, setRefetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e as ApiError | Error);
          setLoading(false);
        }
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, refetchNonce]);

  const refetch = () => setRefetchNonce((n) => n + 1);

  return { data, error, loading, refetch, setData };
}
