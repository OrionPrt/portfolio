import { pgEnum } from "drizzle-orm/pg-core";

import {
  CONTENT_STATUSES,
  DIFFICULTIES,
  ENTRY_COLLECTIONS,
  EMPLOYMENT_TYPES,
  MESSAGE_STATUSES,
  PLATFORMS,
  POST_KINDS,
  SKILL_DOMAINS,
  SOCIAL_KINDS,
  TILE_KINDS,
  TILE_SIZES,
} from "@/features/content/vocabulary";
import { SESSION_STAGES, THROTTLE_SCOPES } from "@/features/auth/vocabulary";
import { LOCALES } from "@/i18n/locales";

export const localeEnum = pgEnum("locale", LOCALES);

export const skillDomainEnum = pgEnum("skill_domain", SKILL_DOMAINS);

export const contentStatusEnum = pgEnum("content_status", CONTENT_STATUSES);

export const entryCollectionEnum = pgEnum(
  "entry_collection",
  ENTRY_COLLECTIONS,
);

export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPES);

export const socialKindEnum = pgEnum("social_kind", SOCIAL_KINDS);

export const tileKindEnum = pgEnum("tile_kind", TILE_KINDS);

export const tileSizeEnum = pgEnum("tile_size", TILE_SIZES);

export const messageStatusEnum = pgEnum("message_status", MESSAGE_STATUSES);

export const postKindEnum = pgEnum("post_kind", POST_KINDS);

export const platformEnum = pgEnum("platform", PLATFORMS);

export const difficultyEnum = pgEnum("difficulty", DIFFICULTIES);

export const sessionStageEnum = pgEnum("session_stage", SESSION_STAGES);

export const throttleScopeEnum = pgEnum("throttle_scope", THROTTLE_SCOPES);
