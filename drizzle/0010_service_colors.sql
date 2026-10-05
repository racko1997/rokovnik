ALTER TABLE "services" ADD COLUMN "color" text DEFAULT 'plava' NOT NULL;--> statement-breakpoint
-- Postojeće usluge dobijaju različite boje redom kojim su u cjenovniku
UPDATE "services" s SET "color" = (ARRAY['plava','ljubicasta','tirkiz','narandzasta','zelena','orhideja','petrol','zlatna','indigo','koral','maslina','siva'])[((r.n - 1) % 12) + 1]
FROM (
  SELECT sv.id, row_number() OVER (PARTITION BY sv.salon_id ORDER BY c.sort_order NULLS LAST, sv.sort_order, sv.created_at) AS n
  FROM "services" sv LEFT JOIN "service_categories" c ON c.id = sv.category_id
) r
WHERE r.id = s.id;
