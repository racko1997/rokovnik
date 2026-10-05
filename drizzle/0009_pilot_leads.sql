CREATE TABLE "pilot_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_name" text NOT NULL,
	"city" text,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"salon_type" text,
	"staff_count" text,
	"message" text,
	"status" text DEFAULT 'novo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pilot_leads_created_at_index" ON "pilot_leads" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "pilot_leads" ENABLE ROW LEVEL SECURITY;
