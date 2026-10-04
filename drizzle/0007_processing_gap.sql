ALTER TABLE "appointment_items" ADD COLUMN "part" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "gap_start_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "gap_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_gap" CHECK ("services"."gap_min" = 0 or ("services"."gap_start_min" > 0 and "services"."gap_min" > 0 and "services"."gap_start_min" + "services"."gap_min" < "services"."duration_min"));