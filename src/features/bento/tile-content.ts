import type {
  CertificationView,
  EducationView,
  SkillView,
} from "@/features/catalog/repository";
import type { SocialKind, TileKind } from "@/features/content/vocabulary";
import type { ExperienceView } from "@/features/experiences/repository";
import type {
  ProfileView,
  SocialLinkView,
} from "@/features/profile/repository";
import type { ProjectView } from "@/features/projects/types";

import { EDITABLE_TILE_KINDS } from "./rules";

/** What the hub's tiles read, in the page's language. */
export interface HubContent {
  readonly profile: ProfileView | undefined;
  readonly featuredProject: ProjectView | undefined;
  readonly currentExperience: ExperienceView | undefined;
  readonly skills: readonly SkillView[];
  readonly education: readonly EducationView[];
  readonly certifications: readonly CertificationView[];
}

/** What one tile shows: the hub renders it, the editor's preview counts it. */
export type TileContent =
  | { readonly kind: "identity"; readonly profile: ProfileView | undefined }
  | { readonly kind: "featured_project"; readonly project: ProjectView }
  | {
      readonly kind: "current_experience";
      readonly experience: ExperienceView;
    }
  | { readonly kind: "stack"; readonly skills: readonly SkillView[] }
  | {
      readonly kind: "cyber_stats";
      readonly links: readonly SocialLinkView[];
    }
  | {
      // Stored as "certifications": the tile has shown education too since
      // 2026-10-29, as "Parcours" (journey).
      readonly kind: "certifications";
      readonly education: readonly EducationView[];
      readonly certifications: readonly CertificationView[];
    }
  | { readonly kind: "contact"; readonly links: readonly SocialLinkView[] };

const PLATFORM_KINDS: readonly SocialKind[] = [
  "hackthebox",
  "rootme",
  "tryhackme",
];
const CONTACT_KINDS: readonly SocialKind[] = [
  "email",
  "linkedin",
  "github",
  "website",
];

function linksOf(
  profile: ProfileView | undefined,
  kinds: readonly SocialKind[],
): readonly SocialLinkView[] {
  return (profile?.socialLinks ?? []).filter((link) =>
    kinds.includes(link.kind),
  );
}

/** Undefined when the tile has nothing to show: the hub leaves it out. */
export function tileContent(
  kind: TileKind,
  content: HubContent,
): TileContent | undefined {
  switch (kind) {
    case "identity":
      return { kind, profile: content.profile };
    case "featured_project":
      return content.featuredProject === undefined
        ? undefined
        : { kind, project: content.featuredProject };
    case "current_experience":
      return content.currentExperience === undefined
        ? undefined
        : { kind, experience: content.currentExperience };
    case "stack":
      return content.skills.length > 0
        ? { kind, skills: content.skills }
        : undefined;
    case "cyber_stats": {
      const links = linksOf(content.profile, PLATFORM_KINDS);
      return links.length > 0 ? { kind, links } : undefined;
    }
    case "certifications":
      return content.education.length > 0 || content.certifications.length > 0
        ? {
            kind,
            education: content.education,
            certifications: content.certifications,
          }
        : undefined;
    case "contact":
      // Always shown: the contact form needs no published link.
      return { kind, links: linksOf(content.profile, CONTACT_KINDS) };
    case "latest_post":
    case "cv":
      // The blog (P7) and the generated CV (P9) do not exist yet.
      return undefined;
  }
}

/** The tiles the editor arranges that would show nothing: the hub leaves them out. */
export function tilesWithoutContent(content: HubContent): readonly TileKind[] {
  return EDITABLE_TILE_KINDS.filter(
    (kind) => tileContent(kind, content) === undefined,
  );
}
