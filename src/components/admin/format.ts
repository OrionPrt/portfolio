const PARIS = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export function formatParisDateTime(date: Date): string {
  return PARIS.format(date);
}

// Order matters: Edge and Chrome both say "Safari", Edge also says "Chrome".
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

/** "Firefox · Linux": enough to tell one's own devices apart; undefined otherwise. */
export function describeUserAgent(
  userAgent: string | null,
): string | undefined {
  if (userAgent === null) {
    return undefined;
  }
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return browser !== undefined && system !== undefined
    ? `${browser} · ${system}`
    : undefined;
}
