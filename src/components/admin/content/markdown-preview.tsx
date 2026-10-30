import type { ComponentProps } from "react";

import { Markdown, type CalloutLabels } from "@/components/content/markdown";
import { loadHighlighter } from "@/features/content/highlighter";
import type { Locale } from "@/i18n/locales";

export type PreviewProps = Omit<
  ComponentProps<typeof Markdown>,
  "highlighter" | "labels"
> & {
  /** The field's language: its callouts are named in it, as on the site. */
  readonly locale: Locale;
};

/** The site's words for callouts (messages Markdown.*): the admin has no catalog. */
export const PREVIEW_LABELS: Readonly<Record<Locale, CalloutLabels>> = {
  fr: { note: "Note", warning: "Attention", details: "Détails" },
  en: { note: "Note", warning: "Warning", details: "Details" },
};

/**
 * The public renderer, code coloured as on the site: what the editor's
 * preview loads, renderer and highlighter together, on its first use. A
 * highlighter that fails to load leaves the code plain, never the form broken.
 */
export async function loadPreview() {
  const highlighter = await loadHighlighter().catch(() => undefined);
  return {
    default: function MarkdownPreview({ locale, ...props }: PreviewProps) {
      return (
        <Markdown
          {...props}
          highlighter={highlighter}
          labels={PREVIEW_LABELS[locale]}
        />
      );
    },
  };
}
