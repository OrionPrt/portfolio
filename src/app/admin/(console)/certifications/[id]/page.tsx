import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { CertificationForm } from "@/components/admin/content/certification-form";
import { EntryMissing } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import {
  deleteCertificationAction,
  updateCertificationAction,
} from "@/features/catalog/certifications-admin-actions";
import { createCertificationsAdminRepository } from "@/features/catalog/certifications-admin-repository";

export const metadata: Metadata = {
  title: ADMIN_COPY.certifications.editTitle,
};

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.certifications;

export default async function EditCertificationPage({
  params,
}: PageProps<"/admin/certifications/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const found = await withDatabase((db) =>
    createCertificationsAdminRepository(db).find(id),
  );
  const certification = found.ok ? found.data : undefined;
  const label =
    certification === undefined
      ? ""
      : COPY.label(certification.name, certification.issuedOn);

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.certifications} label={COPY.back} />
      {certification !== undefined ? (
        <>
          {/* Keyed: another entry's page keeps its own form state. */}
          <CertificationForm
            key={certification.id}
            action={updateCertificationAction}
            certification={certification}
          />
          <div className="border-line border-t pt-6">
            <DeleteEntry
              action={deleteCertificationAction}
              id={certification.id}
              label={label}
              title={COPY.deleteTitle(label)}
              afterDelete={ADMIN_PATHS.certifications}
              consequence={COPY.deleteConsequence}
            />
          </div>
        </>
      ) : (
        <EntryMissing isAvailable={found.ok} notFound={COPY.notFound} />
      )}
    </>
  );
}
