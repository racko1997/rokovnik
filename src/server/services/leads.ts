// Prijave salona za pilot program (obrazac na naslovnoj stranici).
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { db } from "../db/client";
import { pilotLeads } from "../db/schema";
import { DomainError } from "../errors";
import { adminEmails, sendEmail } from "../notify";
import { formatPhone, normalizePhone } from "@/lib/phone";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const leadInput = z.object({
  salonName: z.string().trim().min(2, "Unesite naziv salona.").max(80),
  city: optional(60),
  contactName: z.string().trim().min(2, "Unesite vaše ime.").max(80),
  phone: z.string().trim().min(6, "Unesite broj telefona.").max(30),
  email: z
    .union([z.email("Neispravan email."), z.literal("")])
    .nullish()
    .transform((v) => v || null),
  salonType: optional(40),
  staffCount: optional(20),
  message: optional(1000),
});

export async function createLead(raw: z.input<typeof leadInput>) {
  const input = leadInput.parse(raw);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError("INVALID_INPUT", "Broj telefona nije ispravan.");
  await db.insert(pilotLeads).values({ ...input, phone });

  // Obavijest vlasniku platforme (ako je email podešen); greška ovdje ne ruši prijavu
  await sendEmail({
    to: adminEmails(),
    subject: `Nova prijava za pilot: ${input.salonName}${input.city ? ` (${input.city})` : ""}`,
    text: [
      `Salon: ${input.salonName}${input.city ? `, ${input.city}` : ""}`,
      `Kontakt: ${input.contactName}, ${formatPhone(phone)}${input.email ? `, ${input.email}` : ""}`,
      input.salonType && `Tip: ${input.salonType}`,
      input.staffCount && `Radnika: ${input.staffCount}`,
      input.message && `Kako sada zakazuju: ${input.message}`,
      "",
      `Sve prijave: ${appUrl()}/admin/prijave`,
    ]
      .filter((l) => l !== null && l !== undefined)
      .join("\n"),
  });
}

export const LEAD_STATUSES = ["novo", "kontaktiran", "pilot", "odbijeno"] as const;

export async function listLeads() {
  return db.select().from(pilotLeads).orderBy(desc(pilotLeads.createdAt)).limit(500);
}

export async function setLeadStatus(id: string, status: (typeof LEAD_STATUSES)[number]) {
  await db.update(pilotLeads).set({ status }).where(eq(pilotLeads.id, id));
}
