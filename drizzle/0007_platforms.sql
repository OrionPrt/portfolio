CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"profile_url" text,
	"rank" text,
	"points" integer,
	"updated_on" date NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_name_unique" UNIQUE("name"),
	CONSTRAINT "platforms_profile_url_https" CHECK ("platforms"."profile_url" is null or "platforms"."profile_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "platforms_points_positive" CHECK ("platforms"."points" is null or "platforms"."points" >= 0)
);
--> statement-breakpoint
-- The platform profile links shown on the site become platforms (ADR-0009);
-- hidden ones are dropped with their kinds, never made public.
INSERT INTO "platforms" ("name", "profile_url", "updated_on", "sort_order")
SELECT CASE "kind"::text
    WHEN 'hackthebox' THEN 'Hack The Box'
    WHEN 'rootme' THEN 'Root Me'
    ELSE 'TryHackMe'
  END, "url", current_date, "sort_order"
FROM "social_links"
WHERE "kind"::text IN ('hackthebox', 'rootme', 'tryhackme') AND "visible";--> statement-breakpoint
DELETE FROM "social_links" WHERE "kind"::text IN ('hackthebox', 'rootme', 'tryhackme');--> statement-breakpoint
-- The URL check compares the kind with the type being replaced: set aside meanwhile.
ALTER TABLE "social_links" DROP CONSTRAINT "social_links_url_scheme";--> statement-breakpoint
ALTER TABLE "social_links" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."social_kind";--> statement-breakpoint
CREATE TYPE "public"."social_kind" AS ENUM('github', 'linkedin', 'email', 'website');--> statement-breakpoint
ALTER TABLE "social_links" ALTER COLUMN "kind" SET DATA TYPE "public"."social_kind" USING "kind"::"public"."social_kind";--> statement-breakpoint
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_url_scheme" CHECK (("social_links"."kind" = 'email' and "social_links"."url" ~ '^mailto:[^[:space:]@?#]+@[^[:space:]@?#]+$') or ("social_links"."kind" <> 'email' and "social_links"."url" ~ '^https://[^[:space:]]+$'));--> statement-breakpoint
-- The site may not delete from the audit log (ADR-0004): this function, run
-- with its owner's rights, removes only the entries over 12 months old.
-- pnpm db:roles lets the site's role run it, and only that role.
CREATE FUNCTION "public"."purge_audit_logs"() RETURNS integer
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
AS $$
  WITH purged AS (
    DELETE FROM "public"."audit_logs"
    WHERE "created_at" < now() - interval '12 months'
    RETURNING 1
  )
  SELECT count(*)::integer FROM purged
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."purge_audit_logs"() FROM PUBLIC;