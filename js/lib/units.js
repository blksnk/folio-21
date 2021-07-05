export function getDimensions() {
  const {innerWidth, innerHeight} = window;
  return {
    width: innerWidth,
    height: innerHeight,
    center: {
      x: innerWidth / 2,
      y: innerHeight / 2,
    }
  }
}

export function degToRad(deg) {
  return deg * Math.PI / 180
}

export const lerp = (x, y, a) => x * (1 - a) + y * a;