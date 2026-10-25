interface ArrowIconProps {
  readonly className?: string;
}

/** The ↗ that marks a tile opening into its full-screen view. */
export function ArrowIcon({ className = "" }: ArrowIconProps) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${className}`}
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
