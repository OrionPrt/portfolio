CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'internship', 'apprenticeship', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('fr', 'en');--> statement-breakpoint
CREATE TYPE "public"."skill_domain" AS ENUM('web', 'low_level', 'devops', 'cyber');--> statement-breakpoint
CREATE TYPE "public"."social_kind" AS ENUM('github', 'linkedin', 'email', 'hackthebox', 'rootme', 'tryhackme', 'website');--> statement-breakpoint
CREATE TYPE "public"."tile_kind" AS ENUM('identity', 'featured_project', 'current_experience', 'stack', 'cyber_stats', 'latest_post', 'certifications', 'cv', 'contact');--> statement-breakpoint
CREATE TYPE "public"."tile_size" AS ENUM('sm', 'md', 'lg', 'xl');--> statement-breakpoint
CREATE TABLE "bento_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "tile_kind" NOT NULL,
	"size" "tile_size" DEFAULT 'md' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bento_tiles_kind_unique" UNIQUE("kind")
);
--> statement-breakpoint
CREATE TABLE "certification_translations" (
	"certification_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	CONSTRAINT "certification_translations_certification_id_locale_pk" PRIMARY KEY("certification_id","locale")
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text NOT NULL,
	"issued_on" date NOT NULL,
	"expires_on" date,
	"credential_id" text,
	"verify_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certifications_slug_unique" UNIQUE("slug"),
	CONSTRAINT "certifications_slug_format" CHECK ("certifications"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("certifications"."slug") <= 80),
	CONSTRAINT "certifications_verify_url_https" CHECK ("certifications"."verify_url" is null or "certifications"."verify_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "certifications_dates_ordered" CHECK ("certifications"."expires_on" is null or ("certifications"."issued_on" is not null and "certifications"."expires_on" >= "certifications"."issued_on"))
);
--> statement-breakpoint
CREATE TABLE "education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"school" text NOT NULL,
	"location" text,
	"started_on" date NOT NULL,
	"ended_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "education_slug_unique" UNIQUE("slug"),
	CONSTRAINT "education_slug_format" CHECK ("education"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("education"."slug") <= 80),
	CONSTRAINT "education_dates_ordered" CHECK ("education"."ended_on" is null or ("education"."started_on" is not null and "education"."ended_on" >= "education"."started_on"))
);
--> statement-breakpoint
CREATE TABLE "education_translations" (
	"education_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"degree" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	CONSTRAINT "education_translations_education_id_locale_pk" PRIMARY KEY("education_id","locale")
);
--> statement-breakpoint
CREATE TABLE "experience_skills" (
	"experience_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "experience_skills_experience_id_skill_id_pk" PRIMARY KEY("experience_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "experience_translations" (
	"experience_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"role" text NOT NULL,
	"summary_context" text NOT NULL,
	"summary_action" text NOT NULL,
	"summary_result" text NOT NULL,
	"technical_md" text DEFAULT '' NOT NULL,
	CONSTRAINT "experience_translations_experience_id_locale_pk" PRIMARY KEY("experience_id","locale")
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"company" text NOT NULL,
	"company_url" text,
	"location" text,
	"employment_type" "employment_type" NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiences_slug_unique" UNIQUE("slug"),
	CONSTRAINT "experiences_slug_format" CHECK ("experiences"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("experiences"."slug") <= 80),
	CONSTRAINT "experiences_company_url_https" CHECK ("experiences"."company_url" is null or "experiences"."company_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "experiences_dates_ordered" CHECK ("experiences"."ended_on" is null or ("experiences"."started_on" is not null and "experiences"."ended_on" >= "experiences"."started_on"))
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"display_name" text NOT NULL,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_singleton" CHECK ("profile"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "profile_translations" (
	"profile_id" smallint NOT NULL,
	"locale" "locale" NOT NULL,
	"headline" text NOT NULL,
	"availability" text NOT NULL,
	"pitch" text NOT NULL,
	"about_md" text DEFAULT '' NOT NULL,
	"looking_for" text,
	CONSTRAINT "profile_translations_profile_id_locale_pk" PRIMARY KEY("profile_id","locale")
);
--> statement-breakpoint
CREATE TABLE "social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "social_kind" NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "social_links_kind_unique" UNIQUE("kind"),
	CONSTRAINT "social_links_url_scheme" CHECK (("social_links"."kind" = 'email' and "social_links"."url" ~ '^mailto:[^[:space:]@]+@[^[:space:]@]+$') or ("social_links"."kind" <> 'email' and "social_links"."url" ~ '^https://[^[:space:]]+$'))
);
--> statement-breakpoint
CREATE TABLE "project_skills" (
	"project_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_skills_project_id_skill_id_pk" PRIMARY KEY("project_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "project_translations" (
	"project_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"tagline" text NOT NULL,
	"summary_context" text NOT NULL,
	"summary_action" text NOT NULL,
	"summary_result" text NOT NULL,
	"technical_md" text DEFAULT '' NOT NULL,
	"seo_description" text,
	CONSTRAINT "project_translations_project_id_locale_pk" PRIMARY KEY("project_id","locale")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"domain" "skill_domain" NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"repo_url" text,
	"demo_url" text,
	"started_on" date,
	"ended_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_slug_format" CHECK ("projects"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("projects"."slug") <= 80),
	CONSTRAINT "projects_repo_url_https" CHECK ("projects"."repo_url" is null or "projects"."repo_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "projects_demo_url_https" CHECK ("projects"."demo_url" is null or "projects"."demo_url" ~ '^https://[^[:space:]]+$'),
	CONSTRAINT "projects_dates_ordered" CHECK ("projects"."ended_on" is null or ("projects"."started_on" is not null and "projects"."ended_on" >= "projects"."started_on"))
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"domain" "skill_domain" NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug"),
	CONSTRAINT "skills_slug_format" CHECK ("skills"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("skills"."slug") <= 80)
);
--> statement-breakpoint
ALTER TABLE "certification_translations" ADD CONSTRAINT "certification_translations_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_translations" ADD CONSTRAINT "education_translations_education_id_education_id_fk" FOREIGN KEY ("education_id") REFERENCES "public"."education"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_skills" ADD CONSTRAINT "experience_skills_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_skills" ADD CONSTRAINT "experience_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_translations" ADD CONSTRAINT "experience_translations_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_translations" ADD CONSTRAINT "profile_translations_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_translations" ADD CONSTRAINT "project_translations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experience_skills_skill_idx" ON "experience_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "project_skills_skill_idx" ON "project_skills" USING btree ("skill_id");