CREATE TYPE "public"."space_kind" AS ENUM('area', 'project', 'resource');--> statement-breakpoint
CREATE TABLE "space" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "space_kind" NOT NULL,
	"parent_id" uuid,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_parent_id_space_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."space"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_parent_id_idx" ON "space" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "space_kind_idx" ON "space" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "space_archived_at_idx" ON "space" USING btree ("archived_at");