"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useActionState,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type SubmitEvent,
} from "react";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { CONTACT_FIELDS } from "@/features/contact/fields";
import {
  contactValuesOf,
  INITIAL_CONTACT_STATE,
  type ContactFormState,
} from "@/features/contact/form-state";

import { ContactFields } from "./contact-fields";
import { TurnstileWidget } from "./turnstile-widget";

type ContactAction = (
  state: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;

interface ContactFormProps {
  /** The server action (submitContact), passed in so tests can stand in for it. */
  readonly action: ContactAction;
  readonly siteKey: string;
  readonly nonce: string | undefined;
}

/**
 * A dropped connection or a server error rejects the action, which would
 * replace the page with the error view: the form shows it as a failure
 * instead, and keeps the text.
 */
function withFallback(action: ContactAction): ContactAction {
  return async (state, formData) => {
    try {
      return await action(state, formData);
    } catch {
      return {
        status: "failed",
        reason: "unavailable",
        values: contactValuesOf(Object.fromEntries(formData)),
      };
    }
  };
}

const subscribeToNothing = () => () => undefined;

/**
 * The contact form. It is held back until Turnstile has issued a token: the
 * button stays focusable (aria-disabled) and says why. Without JavaScript it
 * is disabled, and the page points to email. The server checks everything.
 */
export function ContactForm({ action, siteKey, nonce }: ContactFormProps) {
  const t = useTranslations("Contact");
  const locale = useLocale();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    withFallback(action),
    INITIAL_CONTACT_STATE,
  );
  const [hasToken, setHasToken] = useState(false);
  const [hasWidgetFailed, setHasWidgetFailed] = useState(false);
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const canSend = hasToken && !isPending;
  const isChecking = isHydrated && !hasToken && !hasWidgetFailed;
  const handledState = useRef(state);

  // During the commit that shows the response: focus moves before it paints.
  useLayoutEffect(() => {
    // Once per response: a page shown again (Activity) keeps its last state.
    if (handledState.current === state) {
      return;
    }
    handledState.current = state;
    const first =
      state.status === "invalid"
        ? CONTACT_FIELDS.find((field) => state.errors[field])
        : undefined;
    const control = first && formRef.current?.elements.namedItem(first);
    if (control instanceof HTMLElement) {
      control.focus();
    }
  }, [state]);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    if (!canSend) {
      event.preventDefault();
    }
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      aria-labelledby={`${id}-title`}
      className="relative flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {t("formTitle")}
        </h2>
        <p className="text-fg-muted text-sm">{t("allRequired")}</p>
      </div>
      <noscript>
        <p className="border-line rounded-control border p-4 text-sm">
          {t("noscript")}
        </p>
      </noscript>
      <input type="hidden" name="locale" value={locale} />
      <ContactFields
        idPrefix={id}
        errors={state.status === "invalid" ? state.errors : {}}
        values={
          state.status === "invalid" || state.status === "failed"
            ? state.values
            : undefined
        }
      />
      <TurnstileWidget
        siteKey={siteKey}
        nonce={nonce}
        resetSignal={state}
        onTokenChange={(hasNewToken) => {
          setHasToken(hasNewToken);
          if (hasNewToken) {
            setHasWidgetFailed(false);
          }
        }}
        onError={() => {
          setHasWidgetFailed(true);
        }}
      />
      <p className="text-fg-muted text-sm leading-relaxed">{t("privacy")}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={!isHydrated}
          aria-disabled={isHydrated && !canSend ? true : undefined}
          aria-describedby={isChecking ? `${id}-checking` : undefined}
          className={`${BUTTON_CLASSES.primary} disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
        >
          {t("submit")}
        </button>
        {isChecking && (
          <p id={`${id}-checking`} className="text-fg-muted text-sm">
            {t("checking")}
          </p>
        )}
      </div>
      <FormFeedback
        state={state}
        isPending={isPending}
        hasWidgetFailed={hasWidgetFailed}
      />
    </form>
  );
}

interface FormFeedbackProps {
  readonly state: ContactFormState;
  readonly isPending: boolean;
  readonly hasWidgetFailed: boolean;
}

/**
 * Two live regions, kept in the accessibility tree from the start so changes
 * are announced: a polite one for progress, success and field errors (the
 * focus moves to the first invalid field), an assertive one for failures.
 * Both empty while a submission is pending, so a repeated outcome is heard.
 */
function FormFeedback({
  state,
  isPending,
  hasWidgetFailed,
}: FormFeedbackProps) {
  const t = useTranslations("Contact");
  const progress = (): { readonly text: string; readonly tone: string } => {
    if (isPending) {
      return { text: t("sending"), tone: "text-fg-muted" };
    }
    if (state.status === "sent") {
      return { text: t("sent"), tone: "text-accent" };
    }
    if (state.status === "invalid") {
      return { text: t("errors.summary"), tone: "text-danger" };
    }
    return { text: "", tone: "" };
  };
  const problem = (): string => {
    if (isPending) {
      return "";
    }
    if (state.status === "failed") {
      return t(`failures.${state.reason}`);
    }
    return hasWidgetFailed ? t("turnstileFailed") : "";
  };
  const { text, tone } = progress();

  return (
    <>
      <p role="status" className={`${tone} font-medium empty:sr-only`}>
        {text}
      </p>
      <p role="alert" className="text-danger font-medium empty:sr-only">
        {problem()}
      </p>
    </>
  );
}
