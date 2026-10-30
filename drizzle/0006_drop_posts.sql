-- The blog is abandoned (2026-10-30): its tables and types go, and so do the
-- rows that name it, which the narrowed types would refuse.
DELETE FROM "slug_redirects" WHERE "collection"::text = 'posts';--> statement-breakpoint
DELETE FROM "bento_tiles" WHERE "kind"::text = 'latest_post';--> statement-breakpoint
DROP TABLE "post_skills" CASCADE;--> statement-breakpoint
DROP TABLE "post_translations" CASCADE;--> statement-breakpoint
DROP TABLE "posts" CASCADE;--> statement-breakpoint
ALTER TABLE "slug_redirects" ALTER COLUMN "collection" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."entry_collection";--> statement-breakpoint
CREATE TYPE "public"."entry_collection" AS ENUM('projects', 'experiences');--> statement-breakpoint
ALTER TABLE "slug_redirects" ALTER COLUMN "collection" SET DATA TYPE "public"."entry_collection" USING "collection"::"public"."entry_collection";--> statement-breakpoint
ALTER TABLE "bento_tiles" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tile_kind";--> statement-breakpoint
CREATE TYPE "public"."tile_kind" AS ENUM('identity', 'featured_project', 'current_experience', 'stack', 'cyber_stats', 'certifications', 'cv', 'contact');--> statement-breakpoint
ALTER TABLE "bento_tiles" ALTER COLUMN "kind" SET DATA TYPE "public"."tile_kind" USING "kind"::"public"."tile_kind";--> statement-breakpoint
DROP TYPE "public"."difficulty";--> statement-breakpoint
DROP TYPE "public"."platform";--> statement-breakpoint
DROP TYPE "public"."post_kind";