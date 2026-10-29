import { sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { runQuery } from "@/db/query";
import { rowsOf } from "@/db/rows";
import {
  certifications,
  certificationTranslations,
  education,
  educationTranslations,
  experiences,
  experienceTranslations,
  profile,
  profileTranslations,
  projects,
  projectTranslations,
} from "@/db/schema";
import { PLACEHOLDER } from "@/db/seed/placeholders";
import type { Database } from "@/db/types";
import {
  createCertificationsAdminRepository,
  type CertificationListEntry,
} from "@/features/catalog/certifications-admin-repository";
import {
  createEducationAdminRepository,
  type EducationListEntry,
} from "@/features/catalog/education-admin-repository";
import {
  createExperiencesAdminRepository,
  type ExperienceListEntry,
} from "@/features/experiences/admin-repository";
import { createMediaAdminRepository } from "@/features/media/admin-repository";
import {
  createProfileAdminRepository,
  PROFILE_ID,
  type ProfileForEdit,
} from "@/features/profile/admin-repository";
import {
  createProjectsAdminRepository,
  type ProjectListEntry,
} from "@/features/projects/admin-repository";
import { all, map, type Result } from "@/lib/result";

import { translationStateAgainst, type TranslationState } from "./completeness";

export type EntryKind =
  "profile" | "project" | "experience" | "education" | "certification";

/** An entry the dashboard links to. */
export interface EntryRef {
  readonly kind: EntryKind;
  readonly id: string;
  readonly label: string;
}

export interface ToTranslate extends EntryRef {
  readonly english: Exclude<TranslationState, "complete">;
}

/** What is left to do on the content, entry by entry. */
export interface ContentToDo {
  readonly toTranslate: readonly ToTranslate[];
  readonly drafts: readonly EntryRef[];
  /** Text still marked "[À COMPLÉTER]", in any language. */
  readonly placeholders: readonly EntryRef[];
  /** Projects without a cover, experiences and schools without a logo, certifications without a badge. */
  readonly withoutImage: readonly EntryRef[];
}

/** The profile's English, measured as its form measures it. */
const PROFILE_FIELDS = {
  required: ["headline", "availability", "pitch", "aboutMd"],
  optional: ["lookingFor"],
} as const;

/** Every flagged row of every entry kind, the lists themselves being bounded. */
const MAX_FLAGGED = 500;

type Flag = "placeholder" | "no_image";

interface FlaggedRow {
  readonly flag: Flag;
  readonly kind: EntryKind;
  readonly id: string;
}

/** Whether any column of the row holds the marker: the whole row, as text. */
function marked(table: PgTable): SQL {
  return sql`strpos(${table}::text, ${PLACEHOLDER}) > 0`;
}

/** An entry kind's tables: its row, its translations, and its image if it has one. */
interface EntryTables {
  readonly kind: EntryKind;
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly translations: PgTable;
  /** The translations' column naming their entry. */
  readonly owner: PgColumn;
  readonly image?: PgColumn;
}

const ENTRY_TABLES: readonly EntryTables[] = [
  {
    kind: "profile",
    table: profile,
    id: profile.id,
    translations: profileTranslations,
    owner: profileTranslations.profileId,
  },
  {
    kind: "project",
    table: projects,
    id: projects.id,
    translations: projectTranslations,
    owner: projectTranslations.projectId,
    image: projects.coverMediaId,
  },
  {
    kind: "experience",
    table: experiences,
    id: experiences.id,
    translations: experienceTranslations,
    owner: experienceTranslations.experienceId,
    image: experiences.logoMediaId,
  },
  {
    kind: "education",
    table: education,
    id: education.id,
    translations: educationTranslations,
    owner: educationTranslations.educationId,
    image: education.logoMediaId,
  },
  {
    kind: "certification",
    table: certifications,
    id: certifications.id,
    translations: certificationTranslations,
    owner: certificationTranslations.certificationId,
    image: certifications.badgeMediaId,
  },
];

function markedEntries({ kind, table, id, translations, owner }: EntryTables) {
  return sql`select 'placeholder' as flag, ${kind} as kind, ${id}::text as id
    from ${table}
    where ${marked(table)} or exists (
      select 1 from ${translations} where ${owner} = ${id} and ${marked(translations)}
    )`;
}

function imagelessEntries({ kind, table, id, image }: EntryTables) {
  return image === undefined
    ? []
    : [
        sql`select 'no_image' as flag, ${kind} as kind, ${id}::text as id
          from ${table} where ${image} is null`,
      ];
}

/** Every entry still holding the marker, and every one without its image. */
const FLAGGED = sql.join(
  [
    ...ENTRY_TABLES.map(markedEntries),
    ...ENTRY_TABLES.flatMap(imagelessEntries),
  ],
  sql` union all `,
);

interface ContentLists {
  readonly projects: readonly ProjectListEntry[];
  readonly experiences: readonly ExperienceListEntry[];
  readonly education: readonly EducationListEntry[];
  readonly certifications: readonly CertificationListEntry[];
  readonly profile: ProfileForEdit | undefined;
  readonly flagged: readonly FlaggedRow[];
}

type Listed = EntryRef & {
  readonly english: TranslationState;
  readonly isDraft: boolean;
};

/** "Rôle · Entreprise", or the entreprise alone while the role has no French. */
function joined(first: string, second: string): string {
  return first === "" ? second : `${first} · ${second}`;
}

/** Every entry the admin lists, as the dashboard names it. */
function listed(lists: ContentLists): readonly Listed[] {
  const { profile: owner } = lists;
  return [
    ...(owner === undefined
      ? []
      : [
          {
            kind: "profile" as const,
            id: String(PROFILE_ID),
            label: owner.displayName,
            english: translationStateAgainst(
              owner.translations.en,
              owner.translations.fr,
              PROFILE_FIELDS,
            ),
            isDraft: false,
          },
        ]),
    ...lists.projects.map((entry) => ({
      kind: "project" as const,
      id: entry.id,
      label: entry.title,
      english: entry.english,
      isDraft: entry.status === "draft",
    })),
    ...lists.experiences.map((entry) => ({
      kind: "experience" as const,
      id: entry.id,
      label: joined(entry.role, entry.company),
      english: entry.english,
      isDraft: entry.status === "draft",
    })),
    ...lists.education.map((entry) => ({
      kind: "education" as const,
      id: entry.id,
      label: joined(entry.degree, entry.school),
      english: entry.english,
      isDraft: false,
    })),
    ...lists.certifications.map((entry) => ({
      kind: "certification" as const,
      id: entry.id,
      label: `${entry.name} (${entry.issuedOn.slice(0, 4)})`,
      english: entry.english,
      isDraft: false,
    })),
  ];
}

function refOf({ kind, id, label }: Listed): EntryRef {
  return { kind, id, label };
}

/** What is left to do, from the lists and the flagged rows, in the lists' order. */
export function contentToDoOf(lists: ContentLists): ContentToDo {
  const entries = listed(lists);
  const flaggedAs = (flag: Flag) =>
    entries
      .filter((entry) =>
        lists.flagged.some(
          (row) =>
            row.flag === flag && row.kind === entry.kind && row.id === entry.id,
        ),
      )
      .map(refOf);
  return {
    toTranslate: entries.flatMap((entry) =>
      entry.english === "complete"
        ? []
        : [{ ...refOf(entry), english: entry.english }],
    ),
    drafts: entries.filter((entry) => entry.isDraft).map(refOf),
    placeholders: flaggedAs("placeholder"),
    withoutImage: flaggedAs("no_image"),
  };
}

/** The library against its ceiling, and the images nothing shows. */
export interface MediaSummary {
  readonly total: number;
  readonly unused: number;
}

export function createDashboardRepository(db: Database) {
  const flagged = (): Promise<Result<readonly FlaggedRow[]>> =>
    runQuery("dashboard.read_failed", async () => {
      const result = await db.execute(
        sql`select * from (${FLAGGED}) as flagged order by kind, id limit ${MAX_FLAGGED}`,
      );
      return rowsOf(result) as readonly FlaggedRow[];
    });

  return {
    media: async (): Promise<Result<MediaSummary>> =>
      map(await createMediaAdminRepository(db).list(), (images) => ({
        total: images.length,
        unused: images.filter((image) => image.usageCount === 0).length,
      })),

    /** Read from the admin's own lists, which say how far each English goes. */
    contentToDo: async (): Promise<Result<ContentToDo>> => {
      // Awaited apart: inside all(), Promise.all would infer an array, not a tuple.
      const reads = await Promise.all([
        createProjectsAdminRepository(db).list(),
        createExperiencesAdminRepository(db).list(),
        createEducationAdminRepository(db).list(),
        createCertificationsAdminRepository(db).list(),
        createProfileAdminRepository(db).read(),
        flagged(),
      ]);
      return map(
        all(reads),
        ([projectList, experienceList, schools, badges, owner, rows]) =>
          contentToDoOf({
            projects: projectList,
            experiences: experienceList,
            education: schools,
            certifications: badges,
            profile: owner,
            flagged: rows,
          }),
      );
    },
  };
}
