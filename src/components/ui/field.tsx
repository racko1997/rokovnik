import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "block w-full h-11 rounded-[var(--radius-chip)] bg-paper px-3 text-[0.9375rem] text-ink ring-1 ring-line-strong placeholder:text-ink-faint transition-shadow focus:outline-none focus:ring-2 focus:ring-lacquer aria-[invalid=true]:ring-lacquer";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-lacquer-deep">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  // twMerge: klasa koju proslijedi pozivalac (npr. w-20) zamjenjuje osnovnu (w-full)
  return <input className={twMerge(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={twMerge(inputClass, "h-auto min-h-20 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={twMerge(
        inputClass,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M2 4.5l4 3.5 4-3.5%22 fill=%22none%22 stroke=%22%235f5668%22 stroke-width=%221.5%22/></svg>')] bg-[position:right_0.85rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    />
  );
}

/** Prekidač (checkbox) sa opisom. */
export function Toggle({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-3", className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-lacquer peer-focus-visible:ring-2 peer-focus-visible:ring-lacquer peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
      <span>
        <span className="block text-[0.9375rem] font-medium text-ink">{label}</span>
        {description && <span className="block text-sm text-ink-soft">{description}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-chip)] bg-lacquer-wash px-3 py-2.5 text-sm text-lacquer-deep">
      {message}
    </p>
  );
}
