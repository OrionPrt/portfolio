"use client";

import { useTranslations } from "next-intl";

interface ErrorPageProps {
  readonly error: unknown;
  readonly retry: () => void;
}

/** Server errors arrive with a digest only; it matches the server-side log entry. */
function digestOf(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
  ) {
    return error.digest;
  }
  return undefined;
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  const t = useTranslations("Error");
  const digest = digestOf(error);

  return (
    <section className="flex flex-1 flex-col items-start justify-center gap-4 py-16">
      <p className="text-accent font-mono text-xs">
        <span aria-hidden="true">{"// "}</span>
        {t("label")}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-fg-muted max-w-prose">{t("description")}</p>
      {digest !== undefined && (
        <p className="text-fg-muted font-mono text-xs">ref: {digest}</p>
      )}
      <button
        type="button"
        onClick={retry}
        className="bg-fg text-ground rounded-control inline-flex h-10 items-center px-4 text-sm font-medium"
      >
        {t("retry")}
      </button>
    </section>
  );
}
