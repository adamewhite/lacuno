'use client';

import { useEffect, useRef } from 'react';

/**
 * A modal dialog in the board's own palette.
 *
 * Focus is trapped while it is open and restored to whatever opened it on
 * close, and Escape closes — a modal that swallows the keyboard is worse than
 * no modal, and lacuno's board listens for keydown to type letters, so the
 * capture-phase listener here has to stop those from reaching it.
 */
export default function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('button, [href]')?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // Letters would otherwise reach the board's typing handler underneath.
      if (e.key.length === 1) e.stopPropagation();
      if (e.key !== 'Tab' || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href]'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="scrim-enter fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15, 48, 64, 0.72)' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="panel-enter w-full rounded-lg border-[1.5px] border-frame p-7 text-center"
        style={{ background: 'var(--shell)', maxWidth: 400 }}
      >
        {children}
      </div>
    </div>
  );
}
