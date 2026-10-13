"use client";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

const focusable = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Moves focus into `container` while active, keeps Tab inside it, closes on Escape and gives focus
// back to whatever opened it.
export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const escape = useRef(onEscape);
  useEffect(() => { escape.current = onEscape; }, [onEscape]);
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = container.current;
    const items = () => [...(element?.querySelectorAll<HTMLElement>(focusable) || [])].filter(item => item.offsetParent !== null || item === document.activeElement);
    (element?.querySelector<HTMLElement>("[autofocus]") || items()[0] || element)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { escape.current?.(); return; }
      if (event.key !== "Tab" || !element) return;
      const list = items();
      if (!list.length) { event.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [active, container]);
}

// Centered modal with backdrop, labelled by its title, using the trap above.
export function Dialog({ open, onClose, label, children, className = "max-w-2xl" }: { open: boolean; onClose: () => void; label: string; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, open, onClose);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-lg outline-none ${className}`}>
        {children}
      </div>
    </div>
  );
}
