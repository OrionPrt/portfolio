import type { MediaVariant } from "@/db/schema";
import type { Locale } from "@/i18n/locales";

/** An image as a page shows it: its text in the page's language, its widths. */
export interface MediaView {
  readonly alt: string;
  /** The largest variant's size: the image's proportions. */
  readonly width: number;
  readonly height: number;
  /** Narrowest first. */
  readonly variants: readonly MediaVariant[];
}

/** An image as a form offers it: by its French text, with a thumbnail. */
export interface MediaOption {
  readonly id: string;
  /** In the default language. */
  readonly alt: string;
  /** In each language: the Markdown editor writes the field's own. */
  readonly alts: Readonly<Record<Locale, string>>;
  /** The narrowest variant. */
  readonly thumbnail: MediaVariant;
}

/** The library's images a text shows (`media:<id>`), by id: loaded with the page. */
export type MediaById = Readonly<Record<string, MediaView>>;
