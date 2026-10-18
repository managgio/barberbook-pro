import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

export function moveOrderedItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

type DragState = { from: number; to: number; offset: number; space: number };
type Session = {
  from: number; to: number; y: number; pointerY: number; pointerId: number; active: boolean;
  rows: { top: number; height: number }[]; scroll: HTMLElement; initialScroll: number;
};

function scrollContainer(element: HTMLElement): HTMLElement {
  let parent = element.parentElement;
  while (parent) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

export function useOrderedListDrag(onMove: (from: number, to: number) => void, disabled: boolean, kind = 'faq') {
  const session = useRef<Session | null>(null);
  const frame = useRef<number>();
  const [drag, setDrag] = useState<DragState | null>(null);
  const cancel = useCallback(() => {
    session.current = null;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    setDrag(null);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      session.current = null;
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [cancel]);
  useEffect(() => { if (disabled) cancel(); }, [disabled, cancel]);

  const update = (current: Session) => {
    const offset = current.pointerY - current.y + current.scroll.scrollTop - current.initialScroll;
    const source = current.rows[current.from];
    const center = source.top + source.height / 2 + offset;
    let distance = Infinity;
    current.rows.forEach((row, index) => {
      const delta = Math.abs(center - row.top - row.height / 2);
      if (delta < distance) { distance = delta; current.to = index; }
    });
    const next = current.rows[current.from + 1], previous = current.rows[current.from - 1];
    const gap = next ? next.top - source.top - source.height : previous ? source.top - previous.top - previous.height : 0;
    setDrag({ from: current.from, to: current.to, offset, space: source.height + gap });
  };
  const autoScroll = () => {
    const current = session.current;
    if (!current) return;
    if (current.active) {
      const viewport = current.scroll === document.scrollingElement || current.scroll === document.documentElement;
      const bounds = viewport ? { top: 0, bottom: window.innerHeight } : current.scroll.getBoundingClientRect();
      const top = Math.max(0, bounds.top), bottom = Math.min(window.innerHeight, bounds.bottom);
      const edge = Math.min(64, (bottom - top) / 4);
      const speed = current.pointerY < top + edge ? -Math.min(12, (top + edge - current.pointerY) / 4)
        : current.pointerY > bottom - edge ? Math.min(12, (current.pointerY - bottom + edge) / 4) : 0;
      const before = current.scroll.scrollTop;
      current.scroll.scrollTop += speed;
      if (before !== current.scroll.scrollTop) update(current);
    }
    frame.current = requestAnimationFrame(autoScroll);
  };
  return {
    drag,
    rowStyle: (index: number): CSSProperties => {
      if (!drag) return {};
      const moving = index === drag.from;
      const displacement = drag.from < drag.to && index > drag.from && index <= drag.to ? -drag.space
        : drag.from > drag.to && index < drag.from && index >= drag.to ? drag.space : 0;
      return { transform: `translate3d(0, ${moving ? drag.offset : displacement}px, 0)`, zIndex: moving ? 20 : undefined,
        transition: moving ? 'none' : undefined, willChange: 'transform' };
    },
    handleProps: (index: number) => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (disabled || event.button !== 0 || session.current) return;
        const list = event.currentTarget.closest(`[data-${kind}-list]`);
        const rows = Array.from(list?.querySelectorAll<HTMLElement>(`[data-${kind}-index]`) ?? []).map((row) => row.getBoundingClientRect());
        if (!rows[index]) return;
        const scroll = scrollContainer(event.currentTarget);
        event.currentTarget.setPointerCapture(event.pointerId);
        session.current = { from: index, to: index, y: event.clientY, pointerY: event.clientY, pointerId: event.pointerId,
          active: false, rows, scroll, initialScroll: scroll.scrollTop };
        frame.current = requestAnimationFrame(autoScroll);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const current = session.current;
        if (!current || disabled || current.pointerId !== event.pointerId) return;
        current.pointerY = event.clientY;
        if (!current.active && Math.abs(event.clientY - current.y) < 6) return;
        current.active = true;
        update(current);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const current = session.current;
        if (current?.pointerId !== event.pointerId) return;
        cancel();
        if (!disabled && current.active && current.from !== current.to) onMove(current.from, current.to);
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    }),
  };
}
