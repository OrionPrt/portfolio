// Always a border, transparent when unseen: forced-colors mode draws it, so a
// button keeps its shape there.
const BASE =
  "rounded-control inline-flex h-10 items-center gap-2 border px-4 text-sm font-medium transition-colors";

/** Class names of the button looks, for links and buttons alike. */
export const BUTTON_CLASSES = {
  primary: `${BASE} bg-fg text-ground hover:bg-fg/85 border-transparent`,
  secondary: `${BASE} border-line bg-surface text-fg hover:border-fg-muted`,
  /** Opens a destructive step (a confirmation), without looking like one. */
  dangerQuiet: `${BASE} border-line bg-surface text-danger hover:border-danger`,
  /** The destructive step itself. */
  danger: `${BASE} bg-danger text-ground hover:bg-danger/85 border-transparent`,
} as const;
