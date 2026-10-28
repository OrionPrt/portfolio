import { certificationPath } from "@/features/auth/admin-paths";
import { deleteCertificationAction } from "@/features/catalog/certifications-admin-actions";
import type { CertificationListEntry } from "@/features/catalog/certifications-admin-repository";

import { ADMIN_COPY } from "../copy";
import { formatMonthYear } from "../format";
import { EntryList, EntryRow, englishBadges } from "./entry-list";

const COPY = ADMIN_COPY.certifications;

/** "OffSec · obtenue en mars 2024 · expire en mars 2027". */
function detailsOf({
  issuer,
  issuedOn,
  expiresOn,
  isExpired,
}: CertificationListEntry): string {
  return [
    issuer,
    COPY.issued(formatMonthYear(issuedOn)),
    ...(expiresOn === null
      ? []
      : [COPY.expires(formatMonthYear(expiresOn), isExpired)]),
  ].join(" · ");
}

interface CertificationListProps {
  readonly certifications: readonly CertificationListEntry[];
}

/** The certifications as the site sorts them, the latest first; the expired ones said so. */
export function CertificationList({ certifications }: CertificationListProps) {
  return (
    <EntryList
      entries={certifications}
      empty={COPY.empty}
      row={(certification) => {
        const label = COPY.label(certification.name, certification.issuedOn);
        return (
          <EntryRow
            id={certification.id}
            label={label}
            badges={[
              ...(certification.isExpired
                ? [{ label: COPY.expiredBadge, tone: "muted" } as const]
                : []),
              ...englishBadges(certification.english),
            ]}
            details={detailsOf(certification)}
            editHref={certificationPath(certification.id)}
            deleteAction={deleteCertificationAction}
            deleteTitle={COPY.deleteTitle(label)}
            deleteConsequence={COPY.deleteConsequence}
          />
        );
      }}
    />
  );
}
