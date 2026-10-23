import type messages from "../../messages/fr.json";
import type { routing } from "./routing";

// Type-checks every locale and translation key used with next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
