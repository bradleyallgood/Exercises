CREATE TABLE "wearable_connections" (
	"provider" text NOT NULL,
	"athlete_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wearable_connections_provider_athlete_id_pk" PRIMARY KEY("provider","athlete_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "wearable_connections" ADD CONSTRAINT "wearable_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_external_idx" ON "activities" USING btree ("user_id","source","external_id");