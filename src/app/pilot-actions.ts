"use server";

import { headers } from "next/headers";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { DomainError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { createLead, type leadInput } from "@/server/services/leads";

/** Javni obrazac "Prijavi salon za pilot" na naslovnoj stranici. */
export async function submitPilotLeadAction(input: z.input<typeof leadInput> & { website?: string }) {
  return runAction(async () => {
    // Polje koje ljudi ne vide — popunjavaju ga samo botovi
    if (input.website) throw new DomainError("INVALID_INPUT", "Zahtjev je odbijen.");
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`lead:${ip}`, 5, 60 * 60_000)) {
      throw new DomainError("INVALID_INPUT", "Previše prijava s ove adrese. Pokušajte kasnije.");
    }
    // Validacija odbacuje nepoznata polja (npr. website)
    await createLead(input);
  });
}
