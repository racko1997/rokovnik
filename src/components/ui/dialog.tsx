"use client";

import * as D from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Na telefonu se otvara kao list odozdo, na većem ekranu kao panel sa desne strane. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <D.Content
          className={clsx(
            "fixed z-50 flex flex-col bg-paper shadow-[var(--shadow-pop)] focus:outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[1.25rem] data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
            "sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:rounded-[1.25rem] sm:data-[state=open]:animate-[sheet-left_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
            wide ? "sm:w-[34rem]" : "sm:w-[28rem]",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4">
            <div>
              <D.Title className="font-display text-2xl leading-tight text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-ink-soft">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>
              )}
            </div>
            <D.Close className="-mt-1 -mr-1 rounded-full p-2 text-ink-soft hover:bg-ink/5 hover:text-ink" aria-label="Zatvori">
              <X size={18} />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
