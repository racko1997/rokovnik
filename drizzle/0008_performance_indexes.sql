DROP INDEX "appointments_client_id_index";--> statement-breakpoint
CREATE INDEX "appointments_client_id_starts_at_index" ON "appointments" USING btree ("client_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_conversation_id_index" ON "appointments" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversations_salon_id_status_index" ON "conversations" USING btree ("salon_id","status");--> statement-breakpoint
CREATE INDEX "time_off_salon_id_starts_at_index" ON "time_off" USING btree ("salon_id","starts_at");