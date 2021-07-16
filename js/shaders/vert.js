export const grid = `
attribute float scale;
uniform vec2 mousePos;
uniform vec2 resolution;
uniform vec2 minMax;

float calcScale() {

  float mouseX = (mousePos.x + 1.0) / 2.0;
  float mouseY = (mousePos.y + 1.0) / 2.0;
  float coefX = ( position.x / minMax.x ) * mouseX;
  float coefY = ( position.y / minMax.y ) * mouseY;
  // float coefX = ( mouseX * position.x ) / (resolution.x);
  // float coefY = ( mouseY * position.y ) / resolution.y;
  return scale * coefX * coefY;

}

void main() {

  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  

  gl_PointSize = calcScale() * ( 300.0 / - mvPosition.z );

  gl_Position = projectionMatrix * mvPosition;

}
`

export default {
  grid
}