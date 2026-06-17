export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpVec3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function frameProgress(frameCount: number) {
  return Array.from({ length: frameCount }, (_, index) => {
    if (frameCount <= 1) return 1;
    return index / (frameCount - 1);
  });
}

export function speedDuration(speed: unknown, base = 1200) {
  if (speed === 'slow') return Math.round(base * 1.35);
  if (speed === 'fast') return Math.round(base * 0.62);
  return base;
}
