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

export const clamp = (n, min, max) => Math.max(min, Math.min(n, max))

export const contained = (n, min, max, include = false) => include ? (min <= n && n <= max) : (min < n && n < max) 

export const lerp = (obj, prop, target, coef = 0.05, apply = true) => {
  const current = obj[prop]
  const lerped = (target - current) * coef;
  console.log(current)
  if(apply) {
    obj[prop] = current + lerped
  }
  return lerped
}

export const lerpUntil = (obj, prop, target, coef) => {
  function update() {
    if(Math.abs(target - obj[prop]) >= 0.01) {
      lerp(obj, prop, target, coef)
      requestAnimationFrame(update)
    }
  }
  requestAnimationFrame(update)
}
