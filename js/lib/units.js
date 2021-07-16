export function getDimensions() {
  const {innerWidth, innerHeight} = window;
  return {
    width: innerWidth,
    height: innerHeight,
    center: {
      x: innerWidth / 2,
      y: innerHeight / 2,
    },
    ratio: innerWidth / innerHeight,
  }
}

export const degToRad = (deg) => deg * (Math.PI / 180);

export const radToDeg = (rad) => rad * (180 / Math.PI);

export const lerp = (x, y, a) => x * (1 - a) + y * a;

export const clamp = (n, min, max) => Math.max(min, Math.min(n, max))

export const contained = (n, min, max, include = false) => include ? (min <= n && n <= max) : (min < n && n < max) 