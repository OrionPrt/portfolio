"use client";

import { lazy, Suspense, useState } from "react";

import type { ControlProps } from "@/components/ui/form-field";

import { ADMIN_COPY } from "../copy";

const COPY = ADMIN_COPY.content.markdown;

// Loaded on the first preview: the editor itself does not need the renderer.
const Markdown = lazy(() =>
  import("@/components/content/markdown").then((module) => ({
    default: module.Markdown,
  })),
);

interface MarkdownEditorProps {
  readonly control: ControlProps;
  readonly name: string;
  readonly initial: string;
  readonly lang: string;
  readonly isRequired: boolean;
  /** Tells same-named toggles apart for screen readers: "français". */
  readonly context: string;
  readonly onText: (text: string) => void;
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
      <div className="flex gap-1">
        {toggle(COPY.write, false)}
        {toggle(COPY.preview, true)}
      </div>
      <textarea
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
              <Markdown source={text} topLevel={2} />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
