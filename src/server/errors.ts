/**
 * Greška poslovne logike sa porukom koja se smije prikazati korisniku.
 * Servisi bacaju DomainError; UI (i kasnije AI agent) prikazuje `message`.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type DomainErrorCode =
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "SLOT_TAKEN"
  | "OUTSIDE_HOURS"
  | "STAFF_CANT_DO_SERVICE"
  | "SLUG_TAKEN"
  | "FORBIDDEN"
  | "TOO_EARLY"
  | "TOO_FAR"
  | "NOT_OFFERED"
  | "ALREADY_BOOKED"
  | "IN_PAST";

/** Postgres kodovi koje prevodimo u domenske greške. */
export function isExclusionViolation(err: unknown): boolean {
  return pgCode(err) === "23P01";
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (pgCode(err) !== "23505") return false;
  return !constraint || pgField(err, "constraint_name") === constraint;
}

function pgCode(err: unknown): string | undefined {
  return pgField(err, "code");
}

function pgField(err: unknown, field: string): string | undefined {
  // drizzle omotava grešku drajvera u `cause`
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const value = (e as Record<string, unknown>)[field];
    if (typeof value === "string" && (field !== "code" || /^[0-9A-Z]{5}$/.test(value))) return value;
  }
  return undefined;
}
