-- NAS-153: timezone del Task. Le righe di M1 sono dell'owner, che vive a Roma
-- (default di OWNER_TIME_ZONE); da qui in poi la timezone arriva dall'app.
ALTER TABLE "task" ADD COLUMN "time_zone" text DEFAULT 'Europe/Rome' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "time_zone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint
-- Backfill dello Schedule da due_at/due_has_time. Senza orario M1 salvava la
-- fine del giorno locale: la data si ricava nella timezone del Task.
UPDATE "task_occurrence" AS o
SET "all_day" = NOT o."due_has_time",
    "end_at" = CASE WHEN o."due_has_time" THEN o."due_at" END,
    "end_date" = CASE WHEN NOT o."due_has_time" THEN (o."due_at" AT TIME ZONE t."time_zone")::date END
FROM "task" AS t
WHERE t."id" = o."task_id" AND o."due_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_schedule_check" CHECK (("task_occurrence"."end_date" is null and "task_occurrence"."end_at" is null and "task_occurrence"."start_date" is null and "task_occurrence"."start_at" is null)
        or ("task_occurrence"."all_day" and "task_occurrence"."end_date" is not null and "task_occurrence"."end_at" is null and "task_occurrence"."start_at" is null
          and ("task_occurrence"."start_date" is null or "task_occurrence"."start_date" <= "task_occurrence"."end_date"))
        or (not "task_occurrence"."all_day" and "task_occurrence"."end_at" is not null and "task_occurrence"."end_date" is null and "task_occurrence"."start_date" is null
          and ("task_occurrence"."start_at" is null or "task_occurrence"."start_at" <= "task_occurrence"."end_at")));