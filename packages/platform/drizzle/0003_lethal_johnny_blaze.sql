CREATE TABLE "task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"space_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_occurrence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_occurrence_status_check" CHECK ("task_occurrence"."status" in ('open', 'completed', 'skipped', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_space_id_idx" ON "task" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "task_deleted_at_idx" ON "task" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "task_occurrence_task_id_idx" ON "task_occurrence" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_occurrence_status_idx" ON "task_occurrence" USING btree ("status");