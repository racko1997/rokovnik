-- Baza sama odbija preklapanje termina istog radnika.
-- Radi i kad dvije rezervacije (npr. AI i recepcija) stignu u istoj milisekundi.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointment_items"
  ADD CONSTRAINT "appointment_items_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  ) WHERE ("active");
