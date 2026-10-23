import { z } from "zod";

import { MAX_PAGE_SIZE, MAX_SKILLS } from "@/db/limits";
import {
  certificationInputSchema,
  educationInputSchema,
  experienceInputSchema,
  profileInputSchema,
  projectInputSchema,
  skillInputSchema,
  socialLinkInputSchema,
  tileInputSchema,
} from "@/features/content/schemas";
import { SOCIAL_KINDS, TILE_KINDS } from "@/features/content/vocabulary";
import { err, ok, type Result } from "@/lib/result";

type Issues = z.core.$RefinementCtx;

function requireUnique<T>(
  items: readonly T[],
  key: (item: T) => string,
  path: readonly (string | number)[],
  field: string,
  ctx: Issues,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const value = key(item);
    if (seen.has(value)) {
      ctx.addIssue({
        code: "custom",
        message: `duplicate value "${value}"`,
        path: [...path, index, field],
      });
    }
    seen.add(value);
  });
}

function requireKnownSkills(
  entities: readonly { readonly skills: readonly string[] }[],
  skills: ReadonlySet<string>,
  path: string,
  ctx: Issues,
): void {
  entities.forEach((entity, index) => {
    entity.skills.forEach((slug, position) => {
      if (!skills.has(slug)) {
        ctx.addIssue({
          code: "custom",
          message: `unknown skill "${slug}"`,
          path: [path, index, "skills", position],
        });
      }
    });
  });
}

export const seedContentSchema = z
  .object({
    profile: profileInputSchema,
    socialLinks: z.array(socialLinkInputSchema).max(SOCIAL_KINDS.length),
    // No more rows than the public lists can show.
    skills: z.array(skillInputSchema).max(MAX_SKILLS),
    projects: z.array(projectInputSchema).max(MAX_PAGE_SIZE),
    experiences: z.array(experienceInputSchema).max(MAX_PAGE_SIZE),
    education: z.array(educationInputSchema).max(MAX_PAGE_SIZE),
    certifications: z.array(certificationInputSchema).max(MAX_PAGE_SIZE),
    tiles: z.array(tileInputSchema).max(TILE_KINDS.length),
  })
  .superRefine((content, ctx) => {
    const bySlug = (item: { readonly slug: string }) => item.slug;
    requireUnique(
      content.socialLinks,
      (l) => l.kind,
      ["socialLinks"],
      "kind",
      ctx,
    );
    requireUnique(content.skills, bySlug, ["skills"], "slug", ctx);
    requireUnique(content.projects, bySlug, ["projects"], "slug", ctx);
    requireUnique(content.experiences, bySlug, ["experiences"], "slug", ctx);
    requireUnique(content.education, bySlug, ["education"], "slug", ctx);
    requireUnique(
      content.certifications,
      bySlug,
      ["certifications"],
      "slug",
      ctx,
    );
    requireUnique(content.tiles, (t) => t.kind, ["tiles"], "kind", ctx);

    const skills = new Set(content.skills.map(bySlug));
    requireKnownSkills(content.projects, skills, "projects", ctx);
    requireKnownSkills(content.experiences, skills, "experiences", ctx);
  });

/** What the seed file is written as: defaults may be left out. */
export type SeedContentInput = z.input<typeof seedContentSchema>;
export type SeedContent = z.output<typeof seedContentSchema>;

export interface SeedContentError {
  /** "path: message", one per problem, ready to print. */
  readonly issues: readonly string[];
}

export function parseSeedContent(
  input: unknown,
): Result<SeedContent, SeedContentError> {
  const result = seedContentSchema.safeParse(input);
  if (result.success) {
    return ok(result.data);
  }
  return err({
    issues: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  });
}
