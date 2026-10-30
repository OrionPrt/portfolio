import type { ComponentProps } from "react";

import { Markdown } from "@/components/content/markdown";
import type { Locale } from "@/i18n/locales";

type Props = ComponentProps<typeof Markdown> & { readonly locale: Locale };

/**
 * RichMarkdown is an async server component, which jsdom cannot render: the
 * plain renderer stands in, without colours (tested on their own).
 */
export function RichMarkdown(props: Props) {
  return (
    <Markdown
      source={props.source}
      topLevel={props.topLevel}
      images={props.images}
      headingIdPrefix={props.headingIdPrefix}
    />
  );
}
