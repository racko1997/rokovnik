CREATE TABLE "salon_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salon_closures_range" CHECK ("salon_closures"."start_date" <= "salon_closures"."end_date")
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "rotation_weeks" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "rotation_anchor" date;--> statement-breakpoint
ALTER TABLE "working_hours" ADD COLUMN "week" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_closures" ADD CONSTRAINT "salon_closures_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "salon_closures_salon_id_start_date_index" ON "salon_closures" USING btree ("salon_id","start_date");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_rotation" CHECK ("staff"."rotation_weeks" in (1, 2));--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_week" CHECK ("working_hours"."week" in (0, 1));--> statement-breakpoint
ALTER TABLE "salon_closures" ENABLE ROW LEVEL SECURITY;
