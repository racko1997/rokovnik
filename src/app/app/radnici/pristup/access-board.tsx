"use client";

import { clsx } from "clsx";
import { Check, Copy, MessageCircle, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatLocalDateLong, initials } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/permissions";
import { createInviteAction, removeMemberAction, revokeInviteAction, updateMemberAction } from "./actions";

interface StaffLite {
  id: string;
  name: string;
  color: string;
}
interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  staffId: string | null;
  joinedAt: string;
}
interface Invite {
  id: string;
  email: string | null;
  role: Role;
  staffId: string | null;
  expiresAt: string;
}

export function AccessBoard({
  currentUserId,
  currentRole,
  assignable,
  staff,
  members,
  invites,
}: {
  currentUserId: string;
  currentRole: Role;
  assignable: Role[];
  staff: StaffLite[];
  members: Member[];
  invites: Invite[];
}) {
  const [inviteFor, setInviteFor] = useState<string | null | "new">(null);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const linked = new Set([...members.map((m) => m.staffId), ...invites.map((i) => i.staffId)].filter(Boolean) as string[]);
  const withoutAccess = staff.filter((s) => !linked.has(s.id));

  return (
    <div className="max-w-4xl space-y-8 px-4 pb-10 sm:px-8">
      {withoutAccess.length > 0 && (
        <section className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
          <h2 className="font-display text-xl">Radnici bez naloga</h2>
          <p className="mt-1 text-sm text-ink-soft">Pošaljite im pozivnicu — dobiće link na koji postave svoju lozinku.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {withoutAccess.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setInviteFor(s.id)}
                  className="flex items-center gap-2 rounded-full bg-porcelain py-1.5 pr-3.5 pl-2 text-sm ring-1 ring-line-strong hover:ring-ink-faint"
                >
                  <Swatch color={s.color} size="sm" /> {s.name}
                  <span className="flex items-center gap-1 font-medium text-lacquer">
                    <UserPlus size={14} /> Pozovi
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Imaju pristup</h2>
          <Button size="sm" variant="secondary" onClick={() => setInviteFor("new")}>
            <UserPlus size={16} /> Nova pozivnica
          </Button>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isMe={m.userId === currentUserId}
              currentRole={currentRole}
              assignable={assignable}
              staff={staff}
              staffById={staffById}
            />
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl">Poslane pozivnice</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper/60 ring-1 ring-line">
            {invites.map((i) => (
              <InviteRow key={i.id} invite={i} staffById={staffById} />
            ))}
          </ul>
        </section>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        {(["staff", "manager", "owner"] as Role[]).map((r) => (
          <div key={r} className="rounded-[var(--radius-chip)] bg-porcelain/70 p-3 text-sm ring-1 ring-line">
            <dt className="font-medium">{ROLE_LABEL[r]}</dt>
            <dd className="mt-0.5 text-ink-soft">{ROLE_DESCRIPTION[r]}</dd>
          </div>
        ))}
      </dl>

      <InviteSheet
        key={String(inviteFor)}
        open={inviteFor !== null}
        presetStaffId={inviteFor && inviteFor !== "new" ? inviteFor : null}
        assignable={assignable}
        staffOptions={withoutAccess}
        staffById={staffById}
        onClose={() => setInviteFor(null)}
      />
    </div>
  );
}

function MemberRow({
  member: m,
  isMe,
  currentRole,
  assignable,
  staff,
  staffById,
}: {
  member: Member;
  isMe: boolean;
  currentRole: Role;
  assignable: Role[];
  staff: StaffLite[];
  staffById: Map<string, StaffLite>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const editable = !isMe && m.role !== "owner" && (m.role !== "manager" || currentRole === "owner");
  // Kolonu u kalendaru može mijenjati i sam korisnik za sebe
  const canLink = editable || isMe;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : (res.error ?? "Nije uspjelo."));
    });
  const linkedStaff = m.staffId ? staffById.get(m.staffId) : null;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-porcelain">{initials(m.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {m.name} {isMe && <span className="font-normal text-ink-soft">(vi)</span>}
        </span>
        <span className="block truncate text-sm text-ink-soft">{m.email}</span>
      </span>

      {canLink ? (
        <Select
          value={m.staffId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => updateMemberAction(m.userId, { staffId: e.target.value || null }))}
          className="h-9 w-40 text-sm"
          aria-label="Povezan radnik u kalendaru"
        >
          <option value="">Nije u kalendaru</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              Kolona: {s.name}
            </option>
          ))}
        </Select>
      ) : (
        linkedStaff && (
          <span className="flex items-center gap-1.5 text-sm text-ink-soft">
            <Swatch color={linkedStaff.color} size="sm" /> {linkedStaff.name}
          </span>
        )
      )}

      {editable && assignable.length > 1 ? (
        <Select
          value={m.role}
          disabled={pending}
          onChange={(e) => run(() => updateMemberAction(m.userId, { role: e.target.value as Role }))}
          className="h-9 w-36 text-sm"
          aria-label="Uloga"
        >
          {assignable.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      ) : (
        <span
          className={clsx(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            m.role === "owner" ? "bg-ink text-porcelain" : m.role === "manager" ? "bg-lacquer-wash text-lacquer-deep" : "bg-porcelain text-ink-soft ring-1 ring-line",
          )}
        >
          {ROLE_LABEL[m.role]}
        </span>
      )}

      {editable &&
        (confirmRemove ? (
          <span className="flex items-center gap-1.5 text-sm">
            Ukloniti pristup?
            <button type="button" disabled={pending} onClick={() => run(() => removeMemberAction(m.userId))} className="rounded-full bg-lacquer px-3 py-1 font-medium text-white">
              Da
            </button>
            <button type="button" onClick={() => setConfirmRemove(false)} className="px-2 py-1 text-ink-soft">
              Ne
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="rounded-full p-1.5 text-ink-faint hover:text-lacquer" aria-label="Ukloni pristup">
            <X size={16} />
          </button>
        ))}
      {error && <p className="w-full text-sm text-lacquer-deep">{error}</p>}
    </li>
  );
}

function InviteRow({ invite: i, staffById }: { invite: Invite; staffById: Map<string, StaffLite> }) {
  const [pending, start] = useTransition();
  const s = i.staffId ? staffById.get(i.staffId) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {s && <Swatch color={s.color} size="sm" />}
        <span className="truncate font-medium">{s?.name ?? i.email ?? "Pozivnica"}</span>
        <span className="text-ink-soft">· {ROLE_LABEL[i.role]}</span>
      </span>
      <span className="text-ink-faint">važi do {formatLocalDateLong(i.expiresAt.slice(0, 10))}</span>
      <button type="button" disabled={pending} onClick={() => start(async () => void (await revokeInviteAction(i.id)))} className="text-lacquer-deep hover:underline">
        Poništi
      </button>
    </li>
  );
}

function InviteSheet({
  open,
  presetStaffId,
  assignable,
  staffOptions,
  staffById,
  onClose,
}: {
  open: boolean;
  presetStaffId: string | null;
  assignable: Role[];
  staffOptions: StaffLite[];
  staffById: Map<string, StaffLite>;
  onClose: () => void;
}) {
  const [role, setRole] = useState<Role>("staff");
  const [staffId, setStaffId] = useState<string>(presetStaffId ?? "");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const who = staffId ? staffById.get(staffId)?.name : null;

  function create() {
    start(async () => {
      const res = await createInviteAction({ role: role as "staff" | "manager", staffId: staffId || null, email });
      if (!res.ok) return setError(res.error);
      setError(null);
      setLink(`${window.location.origin}/pozivnica/${res.data.token}`);
    });
  }

  const message = link ? `Pozvan/a si u ${APP_NAME}${who ? `, ${who}` : ""}. Otvori link i postavi lozinku: ${link}` : "";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={link ? "Pozivnica je spremna" : "Pozovi u aplikaciju"}
      description={link ? "Link važi 7 dana i može se iskoristiti jednom." : undefined}
      footer={
        link ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>Gotovo</Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button onClick={create} disabled={pending}>
              {pending ? "Pravim…" : "Napravi pozivnicu"}
            </Button>
          </div>
        )
      }
    >
      {link ? (
        <div className="space-y-4">
          <p className="rounded-[var(--radius-chip)] bg-porcelain px-3 py-2.5 text-sm break-all ring-1 ring-line">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Kopirano" : "Kopiraj link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium ring-1 ring-line-strong hover:ring-ink-faint"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a
              href={`viber://forward?text=${encodeURIComponent(message)}`}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium ring-1 ring-line-strong hover:ring-ink-faint"
            >
              <MessageCircle size={16} /> Viber
            </a>
          </div>
          <p className="text-sm text-ink-soft">
            Iz sigurnosnih razloga link se prikazuje samo sada. Ako se izgubi, poništite pozivnicu i napravite novu.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Uloga</legend>
            <div className="grid gap-2">
              {assignable.map((r) => (
                <label
                  key={r}
                  className={clsx(
                    "flex cursor-pointer gap-3 rounded-[var(--radius-chip)] p-3 ring-1",
                    role === r ? "bg-lacquer-wash/50 ring-lacquer" : "ring-line-strong hover:bg-porcelain",
                  )}
                >
                  <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[var(--lacquer)]" />
                  <span>
                    <span className="block font-medium">{ROLE_LABEL[r]}</span>
                    <span className="block text-sm text-ink-soft">{ROLE_DESCRIPTION[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Kolona u kalendaru" hint="Ako je i sam radnik — kalendar mu se otvara na njegovim terminima.">
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Nije u kalendaru (npr. recepcija)</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email (nije obavezno)" hint="Samo za vašu evidenciju; link šaljete vi.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime@primjer.ba" />
          </Field>
          <FormError message={error} />
        </div>
      )}
    </Sheet>
  );
}
