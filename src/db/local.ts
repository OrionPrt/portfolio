const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

/**
 * A database on this machine (development, CI service container) speaks plain
 * Postgres; any other host is Neon, reached over HTTP or WebSocket.
 */
export function isLocalDatabase(databaseUrl: string): boolean {
  return (
    URL.canParse(databaseUrl) && LOCAL_HOSTS.has(new URL(databaseUrl).hostname)
  );
}
