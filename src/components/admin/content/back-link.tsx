import Link from "next/link";

interface BackLinkProps {
  readonly href: string;
  readonly label: string;
}

/** Up one level: from an entry to its list. */
export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="text-fg-muted hover:text-fg self-start text-sm underline-offset-4 hover:underline"
    >
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}
