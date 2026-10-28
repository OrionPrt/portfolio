import Link from "next/link";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";

import { ADMIN_COPY } from "../copy";

interface ListIntroProps {
  readonly lead: string;
  readonly addHref: string;
  readonly addLabel: string;
}

/** A list page's opening: what it holds, and the way to add one. */
export function ListIntro({ lead, addHref, addLabel }: ListIntroProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-fg-muted max-w-prose">{lead}</p>
      <Link href={addHref} className={BUTTON_CLASSES.primary}>
        {addLabel}
      </Link>
    </div>
  );
}

interface EntryMissingProps {
  /** False when the database could not be read: then nothing is known. */
  readonly isAvailable: boolean;
  readonly notFound: string;
}

/** Why an entry's page shows no form: it is gone, or the database is out of reach. */
export function EntryMissing({ isAvailable, notFound }: EntryMissingProps) {
  return (
    <p className={isAvailable ? undefined : "text-danger"}>
      {isAvailable ? notFound : ADMIN_COPY.unavailable}
    </p>
  );
}
