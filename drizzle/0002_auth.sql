CREATE TYPE "public"."session_stage" AS ENUM('totp_challenge', 'signed_in');--> statement-breakpoint
CREATE TYPE "public"."throttle_scope" AS ENUM('network', 'account', 'second_factor');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" "session_stage" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	CONSTRAINT "admin_sessions_id_format" CHECK ("admin_sessions"."id" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_sessions_expiry_after_creation" CHECK ("admin_sessions"."expires_at" > "admin_sessions"."created_at"),
	CONSTRAINT "admin_sessions_ip_hash_format" CHECK ("admin_sessions"."ip_hash" is null or "admin_sessions"."ip_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_sessions_user_agent_length" CHECK ("admin_sessions"."user_agent" is null or char_length("admin_sessions"."user_agent") <= 512)
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"totp_last_step" bigint,
	"totp_enabled_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_users_email_format" CHECK ("admin_users"."email" = lower("admin_users"."email") and "admin_users"."email" like '%_@_%' and char_length("admin_users"."email") <= 254),
	CONSTRAINT "admin_users_password_hash_format" CHECK ("admin_users"."password_hash" like '$argon2id$%'),
	CONSTRAINT "admin_users_totp_secret_format" CHECK ("admin_users"."totp_secret" is null or "admin_users"."totp_secret" ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'),
	CONSTRAINT "admin_users_totp_enabled_with_secret" CHECK ("admin_users"."totp_enabled_at" is null or "admin_users"."totp_secret" is not null),
	CONSTRAINT "admin_users_totp_last_step_positive" CHECK ("admin_users"."totp_last_step" is null or "admin_users"."totp_last_step" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"diff" jsonb,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_action_format" CHECK ("audit_logs"."action" ~ '^[a-z]+(\.[a-z_]+)+$' and char_length("audit_logs"."action") <= 64),
	CONSTRAINT "audit_logs_ip_hash_format" CHECK ("audit_logs"."ip_hash" is null or "audit_logs"."ip_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audit_logs_user_agent_length" CHECK ("audit_logs"."user_agent" is null or char_length("audit_logs"."user_agent") <= 512)
);
--> statement-breakpoint
CREATE TABLE "login_throttles" (
	"key" text PRIMARY KEY NOT NULL,
	"scope" "throttle_scope" NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"attempt_allowed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_throttles_key_format" CHECK ("login_throttles"."key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "login_throttles_failures_positive" CHECK ("login_throttles"."failures" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_codes_user_code_key" UNIQUE("user_id","code_hash"),
	CONSTRAINT "recovery_codes_hash_format" CHECK ("recovery_codes"."code_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_single_row" ON "admin_users" USING btree ((true));--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST);