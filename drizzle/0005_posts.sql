CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard', 'insane');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('hackthebox', 'rootme', 'tryhackme', 'ctf');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('article', 'writeup');--> statement-breakpoint
ALTER TYPE "public"."entry_collection" ADD VALUE 'posts';--> statement-breakpoint
CREATE TABLE "post_skills" (
	"post_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_skills_post_id_skill_id_pk" PRIMARY KEY("post_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "post_translations" (
	"post_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body_md" text NOT NULL,
	CONSTRAINT "post_translations_post_id_locale_pk" PRIMARY KEY("post_id","locale")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "post_kind" DEFAULT 'article' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_on" date,
	"platform" "platform",
	"difficulty" "difficulty",
	"retired_on" date,
	"is_disclosure_allowed" boolean DEFAULT false NOT NULL,
	"cover_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "posts_slug_format" CHECK ("posts"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("posts"."slug") <= 80),
	CONSTRAINT "posts_published_on_set" CHECK ("posts"."status" <> 'published' or "posts"."published_on" is not null),
	CONSTRAINT "posts_writeup_platform" CHECK ("posts"."kind" <> 'writeup' or "posts"."platform" is not null),
	CONSTRAINT "posts_article_no_challenge" CHECK ("posts"."kind" = 'writeup' or ("posts"."platform" is null and "posts"."difficulty" is null and "posts"."retired_on" is null and not "posts"."is_disclosure_allowed")),
	CONSTRAINT "posts_writeup_disclosable" CHECK ("posts"."status" <> 'published' or "posts"."kind" <> 'writeup' or "posts"."retired_on" is not null or "posts"."is_disclosure_allowed")
);
--> statement-breakpoint
ALTER TABLE "post_skills" ADD CONSTRAINT "post_skills_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_skills" ADD CONSTRAINT "post_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_translations" ADD CONSTRAINT "post_translations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_skills_skill_idx" ON "post_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("status","published_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_cover_media_idx" ON "posts" USING btree ("cover_media_id");