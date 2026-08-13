'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pointer-based dragging that works on touch and mouse alike.
 *
 * HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDrop`) is not implemented
 * by mobile browsers, so on a phone those handlers never fire and the browser
 * does its default thing instead: scrolling the page or selecting text. Pointer
 * events are the portable replacement.
 *
 * Three details make it feel right:
 *   - `touch-action: none` on a draggable element stops the browser claiming
 *     the gesture for scrolling before we see it.
 *   - A small movement threshold before a drag "starts", so a tap is still a
 *     tap. Below the threshold the click handler runs as normal.
 *   - Pointer capture, so the drag keeps tracking even when the finger leaves
 *     the element it started on.
 */

/** How far the pointer must move before this counts as a drag, in px. */
const DRAG_THRESHOLD = 8;

export interface DragState {
  /** Tile being dragged, or null when idle. */
  readonly tileId: number | null;
  /** Current pointer position, for painting the floating tile. */
  readonly x: number;
  readonly y: number;
  /** Drop target under the pointer, as returned by the target resolver. */
  readonly over: string | null;
}

export interface DragHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
}

/**
 * @param onDrop called with the dragged tile and the drop target key, if any
 * @param resolveTarget maps a point to a drop-target key (data-drop attribute)
 */
export function useDrag(
  onDrop: (tileId: number, target: string | null) => void,
): [DragState, (tileId: number) => DragHandlers, boolean] {
  const [state, setState] = useState<DragState>({ tileId: null, x: 0, y: 0, over: null });

  // Refs so the move/up listeners always see current values without
  // re-subscribing on every pointer move.
  const origin = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<number | null>(null);
  const active = useRef(false);
  const overRef = useRef<string | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  /** Find the drop target under a point via `data-drop` on the hit element. */
  const targetAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    const holder = el?.closest('[data-drop]');
    return holder?.getAttribute('data-drop') ?? null;
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (pending.current === null || !origin.current) return;

      const dx = event.clientX - origin.current.x;
      const dy = event.clientY - origin.current.y;

      if (!active.current) {
        // Wait for real movement before treating this as a drag, so taps and
        // clicks still work normally.
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        active.current = true;
      }

      event.preventDefault();
      const over = targetAt(event.clientX, event.clientY);
      overRef.current = over;
      setState({ tileId: pending.current, x: event.clientX, y: event.clientY, over });
    };

    const onUp = (event: PointerEvent) => {
      const tileId = pending.current;
      const wasActive = active.current;

      pending.current = null;
      origin.current = null;
      active.current = false;

      if (tileId !== null && wasActive) {
        onDropRef.current(tileId, targetAt(event.clientX, event.clientY));
      }

      overRef.current = null;
      setState({ tileId: null, x: 0, y: 0, over: null });
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const handlersFor = useCallback(
    (tileId: number): DragHandlers => ({
      onPointerDown: (event: React.PointerEvent) => {
        // Ignore secondary buttons; let the browser handle those.
        if (event.button !== 0) return;
        pending.current = tileId;
        origin.current = { x: event.clientX, y: event.clientY };
        active.current = false;
      },
    }),
    [],
  );

  return [state, handlersFor, state.tileId !== null];
}
