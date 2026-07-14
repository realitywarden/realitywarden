import type { KeyboardEvent } from 'react';

export type RovingOrientation = 'horizontal' | 'vertical';

export function getNextRovingIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
  orientation: RovingOrientation = 'horizontal'
): number | null {
  if (itemCount <= 0 || currentIndex < 0 || currentIndex >= itemCount) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;

  const previousKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
  const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
  if (key === previousKey) return (currentIndex - 1 + itemCount) % itemCount;
  if (key === nextKey) return (currentIndex + 1) % itemCount;
  return null;
}

export function handleRovingTabKey(
  event: KeyboardEvent<HTMLElement>,
  currentIndex: number,
  itemCount: number,
  onActivate: (nextIndex: number) => void,
  orientation: RovingOrientation = 'horizontal'
) {
  const nextIndex = getNextRovingIndex(event.key, currentIndex, itemCount, orientation);
  if (nextIndex === null) return;
  event.preventDefault();
  onActivate(nextIndex);
  const tablist = event.currentTarget.closest<HTMLElement>('[role="tablist"]');
  tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus();
}
