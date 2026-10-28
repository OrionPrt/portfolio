CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" text NOT NULL,
	"pathname" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"variants" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_sha256_unique" UNIQUE("sha256"),
	CONSTRAINT "media_pathname_unique" UNIQUE("pathname"),
	CONSTRAINT "media_sha256_format" CHECK ("media"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "media_dimensions_positive" CHECK ("media"."width" > 0 and "media"."height" > 0),
	CONSTRAINT "media_variants_count" CHECK (jsonb_typeof("media"."variants") = 'array' and jsonb_array_length("media"."variants") between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "media_translations" (
	"media_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"alt" text NOT NULL,
	CONSTRAINT "media_translations_media_id_locale_pk" PRIMARY KEY("media_id","locale"),
	CONSTRAINT "media_translations_alt_not_blank" CHECK (btrim("media_translations"."alt") <> '')
);
--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "badge_media_id" uuid;--> statement-breakpoint
ALTER TABLE "education" ADD COLUMN "logo_media_id" uuid;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "logo_media_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "cover_media_id" uuid;--> statement-breakpoint
ALTER TABLE "media_translations" ADD CONSTRAINT "media_translations_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_badge_media_id_media_id_fk" FOREIGN KEY ("badge_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certifications_badge_media_idx" ON "certifications" USING btree ("badge_media_id");--> statement-breakpoint
CREATE INDEX "education_logo_media_idx" ON "education" USING btree ("logo_media_id");--> statement-breakpoint
CREATE INDEX "experiences_logo_media_idx" ON "experiences" USING btree ("logo_media_id");--> statement-breakpoint
CREATE INDEX "projects_cover_media_idx" ON "projects" USING btree ("cover_media_id");