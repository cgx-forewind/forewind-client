import { useCallback, useEffect, useRef, useState } from "react";

/** Stale-while-revalidate loader: skeleton on first load only, error/offline state on failure. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    fn()
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => id === seq.current && setError(e))
      .finally(() => id === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
    return () => {
      seq.current++;
    };
  }, [run]);
  return { data, error, loading: loading && data === undefined, refreshing: loading && data !== undefined, reload: run };
}
