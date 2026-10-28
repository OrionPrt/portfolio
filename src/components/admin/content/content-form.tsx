"use client";

import {
  createContext,
  useActionState,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { FieldProblem } from "@/features/admin/form-input";
import {
  CONTENT_IDLE,
  type ContentAction,
  type ContentFormState,
} from "@/features/admin/content-form-state";

import { ADMIN_COPY } from "../copy";
import { FormAlert } from "../form-alert";
import { FormStatus } from "../form-status";
import { SubmitButton } from "../submit-button";
import { useUnsavedGuard } from "./use-unsaved-guard";

const COPY = ADMIN_COPY.content;

/** Every value sent, by name: some names repeat (an ordered list of skills). */
type SentValues = Readonly<Record<string, readonly string[]>>;

/** The action's outcome, numbered, with what the form sent when it was refused. */
type FormOutcome = ContentFormState & {
  readonly revision: number;
  readonly sent: SentValues | undefined;
};

const START: FormOutcome = { ...CONTENT_IDLE, revision: 0, sent: undefined };

interface FieldContext {
  readonly sent: SentValues | undefined;
  readonly problems: Readonly<Record<string, FieldProblem>>;
  /** For a change no control's input event reports: a list reordered by buttons. */
  readonly markEdited: () => void;
}

const ContentFormContext = createContext<FieldContext>({
  sent: undefined,
  problems: {},
  markEdited: () => undefined,
});

/**
 * What a field of the enclosing form starts from: what was sent, when the
 * form was refused (an unticked box is absent: it stays unticked), else the
 * stored value. And its problem, if any.
 */
export function useField(name: string, initial: string) {
  const { sent, problems } = useContext(ContentFormContext);
  return {
    value: sent === undefined ? initial : (sent[name]?.[0] ?? ""),
    problem: problems[name],
  };
}

/** Counts a change as unsaved, as typing does. */
export function useMarkEdited(): () => void {
  return useContext(ContentFormContext).markEdited;
}

/** The same, for a name sent once per value, in order. */
export function useFieldList(name: string, initial: readonly string[]) {
  const { sent, problems } = useContext(ContentFormContext);
  return {
    values: sent === undefined ? initial : (sent[name] ?? []),
    problem: problems[name],
  };
}

function alertOf(state: ContentFormState): string | undefined {
  switch (state.status) {
    case "invalid":
      return COPY.invalid;
    case "not_found":
      return COPY.notFound;
    case "full":
      return COPY.full;
    case "unavailable":
      return COPY.unavailable;
    default:
      return undefined;
  }
}

function textValues(formData: FormData): SentValues {
  return Object.fromEntries(
    [...new Set(formData.keys())].map((name) => [
      name,
      formData
        .getAll(name)
        .filter((value): value is string => typeof value === "string"),
    ]),
  );
}

interface ContentFormProps {
  readonly action: ContentAction;
  readonly children: ReactNode;
  /** Sent with the form, never shown: the entry's id. */
  readonly hidden?: Readonly<Record<string, string>>;
  /** Tells several forms' buttons apart: "Enregistrer GitHub". */
  readonly context?: string;
  /** What saving does beyond saving, shown above the button and read with it. */
  readonly saveNote?: string;
}

/**
 * A content form. The server gets the fields only (never the last outcome);
 * the form keeps what it sent, and its fields start again from it, or from the
 * stored values once saved (the page refreshes). A refusal focuses the first
 * field in error, once; leaving with unsaved changes asks first.
 */
export function ContentForm({
  action,
  children,
  hidden = {},
  context,
  saveNote,
}: ContentFormProps) {
  const [state, formAction] = useActionState(
    async (previous: FormOutcome, formData: FormData): Promise<FormOutcome> => {
      const outcome = await action(CONTENT_IDLE, formData);
      return {
        ...outcome,
        revision: previous.revision + 1,
        sent: outcome.status === "saved" ? undefined : textValues(formData),
      };
    },
    START,
  );
  // The outcome current when something was last typed: a save since then cleans it.
  const [editedAt, setEditedAt] = useState<FormOutcome | undefined>();
  const isDirty =
    editedAt !== undefined && !(state.status === "saved" && state !== editedAt);
  const formRef = useRef<HTMLFormElement>(null);
  const noteId = useId();
  const focusedRevision = useRef(0);
  useUnsavedGuard(isDirty);

  // During the commit that shows the refusal: focus is in place before anything paints.
  useLayoutEffect(() => {
    // Once per outcome: a hidden page shown again must not take focus back.
    if (
      state.status === "invalid" &&
      focusedRevision.current !== state.revision
    ) {
      focusedRevision.current = state.revision;
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid=true]")
        ?.focus();
    }
  }, [state]);

  const fields: FieldContext = {
    sent: state.sent,
    problems: state.status === "invalid" ? state.problems : {},
    markEdited: () => {
      setEditedAt(state);
    },
  };
  return (
    <ContentFormContext value={fields}>
      <form
        ref={formRef}
        action={formAction}
        onInput={() => {
          setEditedAt(state);
        }}
        className="flex flex-col gap-6"
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {/* Mounted afresh with each outcome: every control starts from its value. */}
        <div key={state.revision} className="contents">
          {children}
        </div>
        <div className="flex flex-col gap-3">
          {saveNote !== undefined && (
            <p id={noteId} className="text-fg-muted text-sm">
              {saveNote}
            </p>
          )}
          <SubmitButton
            pendingLabel={COPY.saving}
            describedBy={saveNote === undefined ? undefined : noteId}
          >
            {COPY.save}
            {/* The space outside the span: name computation trims inside it. */}
            {context !== undefined && (
              <>
                {" "}
                <span className="sr-only">{context}</span>
              </>
            )}
          </SubmitButton>
          <FormStatus
            message={
              state.status === "saved" && !isDirty ? COPY.saved : undefined
            }
          />
          <FormAlert message={alertOf(state)} />
        </div>
      </form>
    </ContentFormContext>
  );
}
