CREATE TYPE "public"."message_status" AS ENUM('unread', 'read', 'archived');--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"locale" "locale" NOT NULL,
	"status" "message_status" DEFAULT 'unread' NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_messages_name_length" CHECK (char_length("name") <= 100),
	CONSTRAINT "contact_messages_email_length" CHECK (char_length("email") <= 254),
	CONSTRAINT "contact_messages_subject_length" CHECK (char_length("subject") <= 150),
	CONSTRAINT "contact_messages_body_length" CHECK (char_length("body") <= 5000),
	CONSTRAINT "contact_messages_user_agent_length" CHECK ("contact_messages"."user_agent" is null or char_length("user_agent") <= 512),
	CONSTRAINT "contact_messages_ip_hash_format" CHECK ("contact_messages"."ip_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE INDEX "contact_messages_status_created_idx" ON "contact_messages" USING btree ("status","created_at" DESC NULLS LAST);