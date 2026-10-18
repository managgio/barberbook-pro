import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { nearestPhotoSlot, photoSlotForItem, type PhotoRect } from './photoGridGeometry';

type Session = {
  from: number; to: number; mode: 'pointer' | 'keyboard'; active: boolean; valid: boolean;
  pointerId: number; startX: number; startY: number; x: number; y: number;
  rects: PhotoRect[]; initialScroll: number; handle: HTMLButtonElement;
};
type Drag = { from: number; to: number; valid: boolean; rects: PhotoRect[]; overlay: PhotoRect };
type Notice = { kind: 'moving' | 'dropped' | 'cancelled'; from: number; to: number };

export default function usePhotoGridDrag(keys: string[], disabled: boolean, onMove: (from: number, to: number) => void) {
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const session = useRef<Session | null>(null);
  const frame = useRef<number>();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const signature = keys.join(',');
  const clear = useCallback(() => {
    const current = session.current;
    session.current = null;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    if (current?.mode === 'pointer' && current.handle.hasPointerCapture?.(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    return current;
  }, []);
  const cancel = useCallback(() => {
    const current = clear();
    setDrag(null);
    if (current?.active) setNotice({ kind: 'cancelled', from: current.from, to: current.from });
    return Boolean(current);
  }, [clear]);
  useEffect(() => { cancel(); }, [signature, disabled, cancel]);
  useEffect(() => {
    window.addEventListener('resize', cancel);
    window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('resize', cancel); window.removeEventListener('blur', cancel); clear(); };
  }, [cancel, clear]);

  const update = (current: Session) => {
    if (!scrollRef.current || !current.active) return;
    const scrollDelta = scrollRef.current.scrollTop - current.initialScroll;
    const source = current.rects[current.from];
    let left: number, top: number;
    if (current.mode === 'pointer') {
      left = source.left + current.x - current.startX;
      top = source.top + current.y - current.startY;
      current.to = nearestPhotoSlot(current.rects, left + source.width / 2, top + source.height / 2 + scrollDelta);
      const bounds = scrollRef.current.getBoundingClientRect();
      current.valid = current.x >= bounds.left && current.x <= bounds.right && current.y >= bounds.top && current.y <= bounds.bottom;
    } else {
      left = current.rects[current.to].left;
      top = current.rects[current.to].top - scrollDelta;
    }
    setDrag({ from: current.from, to: current.to, valid: current.valid, rects: current.rects,
      overlay: { left, top, width: source.width, height: source.height } });
    setNotice((previous) => previous?.kind === 'moving' && previous.from === current.from && previous.to === current.to
      ? previous : { kind: 'moving', from: current.from, to: current.to });
  };
  const autoScroll = () => {
    const current = session.current, scroll = scrollRef.current;
    if (!current || !scroll) return;
    if (current.active && current.mode === 'pointer') {
      const bounds = scroll.getBoundingClientRect();
      const edge = Math.min(56, bounds.height / 4);
      const speed = current.x < bounds.left || current.x > bounds.right ? 0
        : current.y < bounds.top + edge ? -Math.min(12, (bounds.top + edge - current.y) / 4)
          : current.y > bounds.bottom - edge ? Math.min(12, (current.y - bounds.bottom + edge) / 4) : 0;
      const before = scroll.scrollTop;
      scroll.scrollTop += speed;
      if (before !== scroll.scrollTop) update(current);
    }
    frame.current = requestAnimationFrame(autoScroll);
  };
  const start = (index: number, handle: HTMLButtonElement, pointer?: PointerEvent<HTMLButtonElement>) => {
    if (disabled || keys.length < 2 || session.current || !gridRef.current || !scrollRef.current) return;
    const rects = Array.from(gridRef.current.querySelectorAll<HTMLElement>('[data-photo-key]')).map((element) => element.getBoundingClientRect());
    if (!rects[index]) return;
    const current: Session = { from: index, to: index, mode: pointer ? 'pointer' : 'keyboard', active: !pointer, valid: true,
      pointerId: pointer?.pointerId ?? -1, startX: pointer?.clientX ?? 0, startY: pointer?.clientY ?? 0,
      x: pointer?.clientX ?? 0, y: pointer?.clientY ?? 0, rects, initialScroll: scrollRef.current.scrollTop, handle };
    session.current = current;
    if (pointer) { handle.setPointerCapture(pointer.pointerId); frame.current = requestAnimationFrame(autoScroll); }
    else update(current);
  };
  const finish = () => {
    const current = clear();
    setDrag(null);
    if (!current?.active) return;
    if (!current.valid) { setNotice({ kind: 'cancelled', from: current.from, to: current.from }); return; }
    if (current.from !== current.to) onMove(current.from, current.to);
    setNotice({ kind: 'dropped', from: current.from, to: current.to });
    requestAnimationFrame(() => { if (current.handle.isConnected) current.handle.focus({ preventScroll: true }); });
  };
  const itemStyle = (index: number): CSSProperties => {
    if (!drag) return {};
    if (index === drag.from) return { opacity: 0, transition: 'none' };
    const target = drag.rects[photoSlotForItem(index, drag.from, drag.to)], original = drag.rects[index];
    return { transform: `translate3d(${target.left - original.left}px, ${target.top - original.top}px, 0)` };
  };
  const placeholderStyle = (): CSSProperties => {
    if (!drag || !gridRef.current || !scrollRef.current || !session.current) return {};
    const bounds = gridRef.current.getBoundingClientRect(), target = drag.rects[drag.to];
    return { left: target.left - bounds.left, top: target.top - bounds.top - scrollRef.current.scrollTop + session.current.initialScroll,
      width: target.width, height: target.height };
  };
  return { gridRef, scrollRef, drag, notice, cancel, itemStyle, placeholderStyle,
    handleProps: (index: number) => ({
      'aria-pressed': drag?.from === index,
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
        start(index, event.currentTarget, event);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const current = session.current;
        if (!current || current.mode !== 'pointer' || current.pointerId !== event.pointerId) return;
        current.x = event.clientX; current.y = event.clientY;
        if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;
        current.active = true; update(current);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => { if (session.current?.mode === 'pointer' && session.current.pointerId === event.pointerId) finish(); },
      onPointerCancel: () => cancel(),
      onLostPointerCapture: () => { if (session.current?.mode === 'pointer') cancel(); },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Tab') { cancel(); return; }
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (session.current?.mode === 'keyboard') finish();
          else start(index, event.currentTarget);
        }
        const current = session.current, scroll = scrollRef.current;
        if (!current || current.mode !== 'keyboard' || !scroll || !event.key.startsWith('Arrow')) return;
        event.preventDefault();
        const columns = current.rects.filter((rect) => Math.abs(rect.top - current.rects[0].top) < 2).length;
        const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
        current.to = Math.max(0, Math.min(keys.length - 1, current.to + step));
        const target = current.rects[current.to], bounds = scroll.getBoundingClientRect();
        const top = target.top - scroll.scrollTop + current.initialScroll;
        if (top < bounds.top) scroll.scrollTop -= bounds.top - top + 8;
        else if (top + target.height > bounds.bottom) scroll.scrollTop += top + target.height - bounds.bottom + 8;
        update(current);
      },
    }),
  };
}
