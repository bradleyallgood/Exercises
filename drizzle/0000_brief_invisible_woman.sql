CREATE TYPE "public"."activity_type" AS ENUM('run', 'walk', 'bike', 'swim', 'workout');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "activity_type" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"distance_km" double precision,
	"performed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
