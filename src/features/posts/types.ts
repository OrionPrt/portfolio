import type { SkillRef } from "@/features/content/types";
import type {
  Difficulty,
  Platform,
  PostKind,
} from "@/features/content/vocabulary";
import type { MediaView } from "@/features/media/types";
import type { Locale } from "@/i18n/locales";

/** A post as a list shows it. */
export interface PostSummary {
  readonly slug: string;
  readonly kind: PostKind;
  /** A write-up's challenge; null for an article. */
  readonly platform: Platform | null;
  readonly difficulty: Difficulty | null;
  readonly publishedOn: string;
  readonly title: string;
  readonly excerpt: string;
  readonly skills: readonly SkillRef[];
  /** Its cover, its text in the page's language. */
  readonly cover: MediaView | undefined;
  /** The languages it is written in. */
  readonly locales: readonly Locale[];
  /** True when the requested language is missing and another one is shown. */
  readonly isFallback: boolean;
  /** The language the text is in: the page marks a fallback with `lang`. */
  readonly contentLocale: Locale;
}

/** A post as its page shows it. */
export interface PostView extends PostSummary {
  readonly bodyMd: string;
  readonly retiredOn: string | null;
}
