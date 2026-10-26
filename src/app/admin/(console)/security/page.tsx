import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuditList } from "@/components/admin/audit-list";
import { ADMIN_COPY } from "@/components/admin/copy";
import { PasswordForm } from "@/components/admin/password-form";
import { RecoveryCodesForm } from "@/components/admin/recovery-codes-form";
import { describeUserAgent } from "@/components/admin/format";
import { SessionsForm } from "@/components/admin/sessions-form";
import { withDatabase } from "@/db/client";
import type { Database } from "@/db/types";
import {
  createAuditRepository,
  type AuditEntry,
} from "@/features/auth/audit-repository";
import { requireAdmin } from "@/features/auth/dal";
import { createRecoveryCodesRepository } from "@/features/auth/recovery-codes-repository";
import {
  createSessionsRepository,
  type AdminSessionRecord,
} from "@/features/auth/sessions-repository";
import { ok, type Result } from "@/lib/result";

export const metadata: Metadata = { title: ADMIN_COPY.security.title };

/** Events shown: the latest ones, enough for one admin's review. */
const AUDIT_PAGE_SIZE = 50;

const COPY = ADMIN_COPY.security;

interface SecurityData {
  readonly sessions: readonly AdminSessionRecord[];
  readonly remaining: number;
  readonly audit: readonly AuditEntry[];
}

async function loadSecurity(
  db: Database,
  userId: string,
): Promise<Result<SecurityData>> {
  const [sessions, remaining, audit] = await Promise.all([
    createSessionsRepository(db).listForUser(userId, new Date()),
    createRecoveryCodesRepository(db).countUnused(userId),
    createAuditRepository(db).list({ limit: AUDIT_PAGE_SIZE, offset: 0 }),
  ]);
  if (!sessions.ok) {
    return sessions;
  }
  if (!remaining.ok) {
    return remaining;
  }
  if (!audit.ok) {
    return audit;
  }
  return ok({
    sessions: sessions.data,
    remaining: remaining.data,
    audit: audit.data,
  });
}

interface SectionProps {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

export default async function SecurityPage() {
  const admin = await requireAdmin();
  const data = await withDatabase((db) => loadSecurity(db, admin.user.id));

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      {data.ok ? (
        <>
          <Section id="security-sessions" title={COPY.sessions.title}>
            <SessionsForm
              sessions={data.data.sessions.map((session) => ({
                id: session.id,
                device: describeUserAgent(session.userAgent),
                createdAt: session.createdAt,
                lastSeenAt: session.lastSeenAt,
                isCurrent: session.id === admin.sessionId,
              }))}
            />
          </Section>
          <Section id="security-recovery" title={COPY.recovery.title}>
            <RecoveryCodesForm
              remaining={data.data.remaining}
              email={admin.user.email}
            />
          </Section>
          <Section id="security-password" title={COPY.password.title}>
            <PasswordForm email={admin.user.email} />
          </Section>
          <Section id="security-audit" title={COPY.audit.title}>
            <AuditList entries={data.data.audit} />
          </Section>
        </>
      ) : (
        <p className="text-fg-muted">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
