CREATE TABLE "idempotency" (
	"actor_id" uuid NOT NULL,
	"command_name" text NOT NULL,
	"command_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_actor_id_command_name_command_id_pk" PRIMARY KEY("actor_id","command_name","command_id")
);
--> statement-breakpoint
CREATE INDEX "idempotency_expires_at_idx" ON "idempotency" USING btree ("expires_at");