"use client";

import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";

import type { ControlProps } from "@/components/ui/form-field";
import {
  imagesToLoad,
  markdownImage,
  MAX_IMAGES_PER_TEXT,
} from "@/features/media/references";
import type { MediaById, MediaOption } from "@/features/media/types";
import type { Locale } from "@/i18n/locales";

import { announce } from "../announce";
import { ADMIN_COPY } from "../copy";
import { insertBlock } from "./markdown-insert";
import { MarkdownImageInserter } from "./markdown-image-inserter";
import type { PreviewProps } from "./markdown-preview";
import { useMediaOptions } from "./media-options";

const COPY = ADMIN_COPY.content.markdown;

/** What the preview shows when its code cannot be fetched (a tab left open across a deploy). */
function PreviewUnavailable() {
  return <p className="text-fg-muted">{COPY.previewFailed}</p>;
}

// Loaded on the first preview, with the highlighter: the editor itself needs
// neither. A failed load leaves the form, and the text typed, in place.
const Markdown = lazy<ComponentType<PreviewProps>>(() =>
  import("./markdown-preview")
    .then((module) => module.loadPreview())
    .catch(() => ({ default: PreviewUnavailable })),
);

interface MarkdownEditorProps {
  readonly control: ControlProps;
  readonly name: string;
  readonly initial: string;
  readonly lang: Locale;
  readonly isRequired: boolean;
  /** Tells same-named toggles apart for screen readers: "français". */
  readonly context: string;
  readonly onText: (text: string) => void;
}

/** An image's text in the field's language, else the other's: as the site falls back. */
function altFor(option: MediaOption, lang: Locale): string {
  const own = option.alts[lang];
  return own !== ""
    ? own
    : (Object.values(option.alts).find((alt) => alt !== "") ?? option.alt);
}

/** The images the text names, as the preview shows them: those its page would load. */
function previewImages(
  options: readonly MediaOption[],
  lang: Locale,
  text: string,
): MediaById {
  const named = new Set(imagesToLoad(text, MAX_IMAGES_PER_TEXT));
  return Object.fromEntries(
    options
      .filter((option) => named.has(option.id))
      .map((option) => [
        option.id,
        {
          alt: altFor(option, lang),
          width: option.thumbnail.width,
          height: option.thumbnail.height,
          variants: [option.thumbnail],
        },
      ]),
  );
}

/**
 * Writes over the selection as typing does, so the browser keeps it in its
 * undo history and fires its own input event. Where it cannot, the value is
 * set and an input event sent: the editor, the bilingual field and the
 * unsaved guard all listen to it.
 */
function typeInto(
  textarea: HTMLTextAreaElement,
  [start, end]: readonly [number, number],
  inserted: { readonly text: string; readonly caret: number },
): void {
  textarea.focus();
  textarea.setSelectionRange(start, end);
  let isTyped = false;
  try {
    // Deprecated, yet alone in keeping the undo history.
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- see above
    isTyped = document.execCommand(
      "insertText",
      false,
      inserted.text.slice(start, inserted.caret),
    );
  } catch {
    isTyped = false;
  }
  if (!isTyped) {
    textarea.value = inserted.text;
    textarea.setSelectionRange(inserted.caret, inserted.caret);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/**
 * A Markdown text area with a preview drawn by the public site's own renderer.
 * The text area stays in the form while the preview shows, so it is sent; the
 * form remounts it in writing mode after each outcome, so an error can take focus.
 */
export function MarkdownEditor({
  control,
  name,
  initial,
  lang,
  isRequired,
  context,
  onText,
}: MarkdownEditorProps) {
  const [isPreview, setPreview] = useState(false);
  const [text, setText] = useState(initial);
  // Outside a form offering the library (MediaOptionsProvider), nothing to insert.
  const options = useMediaOptions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Kept between renders: the preview's components and images stay the same.
  const images = useMemo(
    () => previewImages(options, lang, text),
    [options, lang, text],
  );
  const insertImage = (option: MediaOption) => {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }
    const selection = [textarea.selectionStart, textarea.selectionEnd] as const;
    typeInto(
      textarea,
      selection,
      insertBlock(
        textarea.value,
        selection[0],
        selection[1],
        markdownImage(option.id, altFor(option, lang)),
      ),
    );
    announce(COPY.inserted(context));
  };
  const toggle = (label: string, isOn: boolean) => (
    <button
      type="button"
      aria-pressed={isPreview === isOn}
      onClick={() => {
        setPreview(isOn);
      }}
      className="rounded-chip text-fg-muted aria-pressed:bg-surface-muted aria-pressed:text-fg min-h-8 px-2 text-xs font-medium"
    >
      {label} <span className="sr-only">{context}</span>
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {toggle(COPY.write, false)}
        {toggle(COPY.preview, true)}
        {options.length > 0 && !isPreview && (
          <MarkdownImageInserter
            options={options}
            context={context}
            onInsert={insertImage}
          />
        )}
      </div>
      <textarea
        ref={textareaRef}
        {...control}
        name={name}
        lang={lang}
        defaultValue={initial}
        required={isRequired}
        rows={12}
        hidden={isPreview}
        onInput={(event) => {
          setText(event.currentTarget.value);
          onText(event.currentTarget.value);
        }}
        className={`${control.className} font-mono text-sm`}
      />
      {isPreview && (
        <div
          lang={lang}
          className="border-line rounded-control bg-surface min-h-40 border px-4 py-3"
        >
          {text.trim() === "" ? (
            <p className="text-fg-muted">{COPY.empty}</p>
          ) : (
            <Suspense fallback={null}>
              <Markdown
                source={text}
                topLevel={2}
                images={images}
                locale={lang}
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
