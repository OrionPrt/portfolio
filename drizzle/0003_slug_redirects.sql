CREATE TYPE "public"."entry_collection" AS ENUM('projects', 'experiences');--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection" "entry_collection" NOT NULL,
	"from_slug" text NOT NULL,
	"to_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slug_redirects_from_slug_format" CHECK ("slug_redirects"."from_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("slug_redirects"."from_slug") <= 80),
	CONSTRAINT "slug_redirects_to_slug_format" CHECK ("slug_redirects"."to_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("slug_redirects"."to_slug") <= 80),
	CONSTRAINT "slug_redirects_not_to_itself" CHECK ("slug_redirects"."from_slug" <> "slug_redirects"."to_slug")
);
--> statement-breakpoint
ALTER TABLE "social_links" DROP CONSTRAINT "social_links_url_scheme";--> statement-breakpoint
CREATE UNIQUE INDEX "slug_redirects_from_idx" ON "slug_redirects" USING btree ("collection","from_slug");--> statement-breakpoint
CREATE INDEX "slug_redirects_to_idx" ON "slug_redirects" USING btree ("collection","to_slug");--> statement-breakpoint
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_url_scheme" CHECK (("social_links"."kind" = 'email' and "social_links"."url" ~ '^mailto:[^[:space:]@?#]+@[^[:space:]@?#]+$') or ("social_links"."kind" <> 'email' and "social_links"."url" ~ '^https://[^[:space:]]+$'));