import { FormField } from "@/components/ui/form-field";

interface CodeInputProps {
  readonly id: string;
  readonly label: string;
  /**
   * What the code is for, read after the label by assistive technologies:
   * a page with several code fields keeps their names apart. The space
   * before it stays outside the hidden span, where name computation trims it.
   */
  readonly context?: string;
  readonly hint?: string;
}

/**
 * A 6-digit TOTP code: numeric keypad, filled by the OS when it can, and
 * pasted as an app shows it ("123 456"): the server ignores the spaces.
 */
export function CodeInput({ id, label, context, hint }: CodeInputProps) {
  return (
    <FormField
      id={id}
      label={
        <>
          {label}
          {context !== undefined && (
            <>
              {" "}
              <span className="sr-only">({context})</span>
            </>
          )}
        </>
      }
      hint={hint}
    >
      {(control) => (
        <input
          {...control}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\s*(\d\s*){6}"
          title="6 chiffres"
          required
          className={`${control.className} font-mono tracking-[0.3em]`}
        />
      )}
    </FormField>
  );
}
