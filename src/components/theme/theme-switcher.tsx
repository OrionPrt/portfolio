"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { THEMES } from "@/features/theme/theme-store";
import { useTheme } from "@/features/theme/use-theme";

/**
 * Native radios styled as a segmented control: arrow keys, focus and screen
 * readers work without custom handling. The stored theme is only known in the
 * browser, so no option is checked until hydration.
 *
 * Each instance gets its own radio group name: Cache Components keeps the other
 * locale's header mounted (hidden), and a shared name would make the browser
 * uncheck this switcher whenever the hidden one is updated.
 */
export function ThemeSwitcher() {
  const t = useTranslations("ThemeSwitcher");
  const { theme, setTheme } = useTheme();
  const groupName = useId();

  return (
    <fieldset className="border-line bg-surface flex gap-0.5 rounded-[10px] border p-[3px]">
      <legend className="sr-only">{t("label")}</legend>
      {THEMES.map((value) => (
        <label
          key={value}
          className="text-fg-muted has-checked:bg-surface-muted has-checked:text-fg has-checked:ring-fg-muted has-focus-visible:outline-focus inline-flex h-7 cursor-pointer items-center rounded-[7px] px-2.5 text-[13px] select-none has-checked:font-medium has-checked:ring-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 forced-colors:has-checked:outline-2 forced-colors:has-checked:outline-solid"
        >
          <input
            type="radio"
            name={groupName}
            value={value}
            checked={theme === value}
            onChange={() => {
              setTheme(value);
            }}
            className="sr-only"
          />
          {t(value)}
        </label>
      ))}
    </fieldset>
  );
}
