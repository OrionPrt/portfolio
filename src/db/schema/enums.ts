import { pgEnum } from "drizzle-orm/pg-core";

import {
  CONTENT_STATUSES,
  EMPLOYMENT_TYPES,
  MESSAGE_STATUSES,
  SKILL_DOMAINS,
  SOCIAL_KINDS,
  TILE_KINDS,
  TILE_SIZES,
} from "@/features/content/vocabulary";
import { LOCALES } from "@/i18n/locales";

export const localeEnum = pgEnum("locale", LOCALES);

export const skillDomainEnum = pgEnum("skill_domain", SKILL_DOMAINS);

export const contentStatusEnum = pgEnum("content_status", CONTENT_STATUSES);

export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPES);

export const socialKindEnum = pgEnum("social_kind", SOCIAL_KINDS);

export const tileKindEnum = pgEnum("tile_kind", TILE_KINDS);

export const tileSizeEnum = pgEnum("tile_size", TILE_SIZES);

export const messageStatusEnum = pgEnum("message_status", MESSAGE_STATUSES);
