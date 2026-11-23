CREATE TABLE "task_completion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"provenance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_completion_provenance_check" CHECK ("task_completion"."provenance" in ('manual'))
);
--> statement-breakpoint
CREATE TABLE "task_rectification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"completion_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"provenance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_rectification_action_check" CHECK ("task_rectification"."action" in ('revert')),
	CONSTRAINT "task_rectification_provenance_check" CHECK ("task_rectification"."provenance" in ('manual'))
);
--> statement-breakpoint
ALTER TABLE "task_occurrence" DROP CONSTRAINT "task_occurrence_status_check";--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_completion" ADD CONSTRAINT "task_completion_occurrence_id_task_occurrence_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."task_occurrence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_rectification" ADD CONSTRAINT "task_rectification_completion_id_task_completion_id_fk" FOREIGN KEY ("completion_id") REFERENCES "public"."task_completion"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_completion_occurrence_id_idx" ON "task_completion" USING btree ("occurrence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_rectification_completion_id_idx" ON "task_rectification" USING btree ("completion_id");--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_status_check" CHECK ("task_occurrence"."status" in ('open', 'in_progress', 'completed', 'skipped', 'cancelled'));--> statement-breakpoint
-- NAS-154: le occorrenze completate in M1 non hanno un Completion. Lo si
-- ricostruisce dall'ultimo aggiornamento, così storico e riapertura valgono
-- anche per loro; saltate e cancellate ricevono la data di chiusura.
-- Gli id sono UUIDv7 come nel resto del sistema (Postgres 17 non ha uuidv7()):
-- timestamp in millisecondi nei primi 48 bit, bit di versione a 7.
UPDATE "task_occurrence" AS o SET "activity_id" = encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) placing substring(int8send(floor(extract(epoch from o."updated_at") * 1000)::bigint) from 3) from 1 for 6), 52, 1), 53, 1), 'hex')::uuid WHERE o."status" = 'completed' AND o."activity_id" IS NULL;--> statement-breakpoint
INSERT INTO "task_completion" ("id", "occurrence_id", "activity_id", "occurred_at", "provenance", "created_at")
SELECT encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) placing substring(int8send(floor(extract(epoch from o."updated_at") * 1000)::bigint) from 3) from 1 for 6), 52, 1), 53, 1), 'hex')::uuid, o."id", o."activity_id", o."updated_at", 'manual', o."updated_at"
FROM "task_occurrence" AS o
WHERE o."status" = 'completed';--> statement-breakpoint
UPDATE "task_occurrence" SET "closed_at" = "updated_at" WHERE "status" IN ('skipped', 'cancelled') AND "closed_at" IS NULL;
