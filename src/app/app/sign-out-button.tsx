"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/prijava");
        router.refresh();
      }}
      className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
    >
      <LogOut size={16} strokeWidth={1.75} />
      Odjava
    </button>
  );
}
