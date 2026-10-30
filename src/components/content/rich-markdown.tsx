import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";

import { hasFencedCode, loadHighlighter } from "@/features/content/highlighter";
import type { Locale } from "@/i18n/locales";
import { logger } from "@/lib/logger";

import { Markdown } from "./markdown";

type RichMarkdownProps = Omit<
  ComponentProps<typeof Markdown>,
  "highlighter" | "labels"
> & {
  /** The text's language, which names its callouts: a fallback keeps its own. */
  readonly locale: Locale;
};

/** The highlighter, if the text needs it; a failed setup leaves the code plain. */
async function highlighterFor(source: string) {
  if (!hasFencedCode(source)) {
    return undefined;
  }
  try {
    return await loadHighlighter();
  } catch (error) {
    logger.error("markdown.highlighter_failed", { error });
    return undefined;
  }
}

/**
 * Stored Markdown as the public site shows it: code coloured, callouts named
 * in the text's language. The highlighter is built once per process, and only
 * loaded for a text with a fenced code block.
 */
export async function RichMarkdown({ locale, ...props }: RichMarkdownProps) {
  const [highlighter, t] = await Promise.all([
    highlighterFor(props.source),
    getTranslations({ locale, namespace: "Markdown" }),
  ]);
  return (
    <Markdown
      {...props}
      highlighter={highlighter}
      labels={{ note: t("note"), warning: t("warning"), details: t("details") }}
    />
  );
}
