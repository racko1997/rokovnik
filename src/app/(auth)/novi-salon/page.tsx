import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { NewSalonForm } from "./new-salon-form";

export const metadata: Metadata = { title: "Novi salon" };

export default async function NewSalonPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Kako se zove salon, {firstName}?</h1>
      <p className="mt-2 text-ink-soft">Sve ovo možete kasnije promijeniti u postavkama.</p>
      <NewSalonForm />
    </>
  );
}
