import { cacheLife } from "next/cache";

/**
 * The current year, cached for a day. Cache Components rejects a bare
 * `new Date()` during prerendering because its value is unstable.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- "use cache" functions must be async
export async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
