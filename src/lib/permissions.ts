// Ko šta smije u salonu. Jedno mjesto za server (provjere) i interfejs (šta se prikazuje).
// Po uzoru na nivoe pristupa u Fresha/Booksy: radnik vodi termine, menadžer i
// raspored i postavke, vlasnik sve.

export type Role = "owner" | "manager" | "staff";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Vlasnik",
  manager: "Menadžer",
  staff: "Radnik",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Sve, uključujući menadžere i brisanje salona.",
  manager: "Termini, smjene, usluge, cijene, radnici i postavke.",
  staff: "Vidi sve termine i smjene, upisuje, pomjera i otkazuje termine.",
};

const PERMISSIONS = {
  /** Upis, pomjeranje, otkazivanje termina; klijenti */
  manageBookings: ["owner", "manager", "staff"],
  /** Smjene, slobodni dani, odsustva, neradni dani */
  manageShifts: ["owner", "manager"],
  /** Usluge i cijene */
  manageCatalog: ["owner", "manager"],
  /** Radnici (podaci, boje, usluge, redovni raspored) */
  manageStaff: ["owner", "manager"],
  /** Postavke salona i online zakazivanja */
  manageSettings: ["owner", "manager"],
  /** Pozivanje radnika i upravljanje pristupom */
  manageTeam: ["owner", "manager"],
  /** Prihod i cijene u kalendaru i analitici */
  viewRevenue: ["owner", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Koje uloge ova uloga smije dodijeliti drugima. */
export function assignableRoles(role: Role): Role[] {
  if (role === "owner") return ["staff", "manager"];
  if (role === "manager") return ["staff"];
  return [];
}
