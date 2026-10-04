CREATE TABLE "staff_day_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shifts" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_day_overrides" ADD CONSTRAINT "staff_day_overrides_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_day_overrides" ADD CONSTRAINT "staff_day_overrides_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_day_overrides_staff_date_uq" ON "staff_day_overrides" USING btree ("staff_id","date");--> statement-breakpoint
CREATE INDEX "staff_day_overrides_salon_id_date_index" ON "staff_day_overrides" USING btree ("salon_id","date");--> statement-breakpoint
ALTER TABLE "staff_day_overrides" ENABLE ROW LEVEL SECURITY;
