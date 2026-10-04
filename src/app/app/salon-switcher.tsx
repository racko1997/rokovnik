"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchSalonAction } from "./switch-salon-action";

/** Za korisnike koji rade u više salona (npr. vlasnik dva salona). */
export function SalonSwitcher({ current, salons }: { current: string; salons: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await switchSalonAction(e.target.value);
          router.push("/app/kalendar");
          router.refresh();
        })
      }
      className="mt-1 w-full truncate rounded-md bg-transparent font-display text-lg leading-snug hover:bg-ink/5 focus:outline-none"
      aria-label="Promijeni salon"
    >
      {salons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
