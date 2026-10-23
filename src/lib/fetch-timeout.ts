/**
 * Wraps a fetch so that every request gets its own timeout, on top of any
 * signal the caller passes. A signal created once would expire for all later
 * requests, hence one per call.
 */
export function fetchWithTimeout(
  fetchImpl: typeof fetch,
  timeoutMs: number,
): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    return fetchImpl(input, { ...init, signal });
  };
}
