import {getDimensions, degToRad} from './units.js'
import {addListener} from '../ui.js'
import DATA_IMG from '../../data/projects.js'
import shaders from '../shaders/index.js'

const IMG_OFFSET = 50
const LERP_COEF = 0.05

export default class GL {
  constructor({ canvas, onChange, onSelect, onScroll }) {
    this.callbacks = {
      onChange: onChange || (() => null),
      onSelect: onSelect || (() => null),
      onScroll: onScroll || (() => null),
    }
    this.canvas = canvas
    this.init()
  }

  get selectedPlane() {
    return this.planes[this.selectedIndex]
  }
  
  async init() {
    this.loader = new THREE.TextureLoader()
    this.raycaster = new THREE.Raycaster()
    this.textures = null;
    
    this.images = DATA_IMG;
    //setup GL context
    this.renderer = setupRenderer(this.canvas);
    this.scene = setupScene();
    this.camera = setupCamera();

    this.cameraTargetPos = new THREE.Vector3(0, 0, 500);
    this.cameraScrollPos = 0;
    this.scrollPercent = 0;
    this.mouseWorldPos =  new THREE.Vector2(0.5, 0.5);
    this.lerpTime = 0;
    this.selectedIndex = 0;
    this.hoverIndex = 0;
    this.hovering = false;
    this.viewProjet = false;

    // create and add point grid
    this.grid = createGrid();
    this.scene.add(this.grid)
    
    // load textures and create planes
    const planes = await Promise.all(this.images.map(({url}, index) => createPlane(this.loader, url, index, this.camera)))
    this.planes = planes;

    this.planeWindowDims = this.planes.map(plane => getObjectWindowDimensions(this.camera, plane))
    // store nbr of imgs for boundaries detection
    this.imgCount = planes.length - 1
    // camera max scroll length for lerp
    this.scrollTrackLength = (this.imgCount) * IMG_OFFSET
    // add planes to scene
    this.planeObjects = this.planes.map(({plane}) => plane)
    this.scene.add(...this.planeObjects)
    this.setupEvents()
    
    this.render()
    this.selectImg(0)
  }

  setupEvents() {
    const onResize = () => {
      resizeRenderer(this.renderer)
      resizeCamera(this.camera)
    }

    const onWheel = ({deltaX, deltaY}) => {
      let incr = 0;
      if(deltaX > 0 || deltaY > 0) {
        incr = 1;
      } else {
        incr = -1;
      }
      const index = this.selectedIndex + incr
      if(index <= this.imgCount && index >= 0 && !this.viewProject) {
        // reset lerp time to prevent infinite lerp when scrolling fast
        this.selectImg(index)
      } else if(this.viewProject) {
        this.scrollImg(incr)
      }
    }

    const onMouseMove = (e) => {
      // get mouse position in world coordinates
      const {x, y} = getMouseWorldPos(e)
      // console.log(x, y)
      this.mouseWorldPos.x = x;
      this.mouseWorldPos.y = y;
    }

    const onKey = (e) => {
      // select img with left & right arrow keys
      const select = (i) => {
        if(i <= this.imgCount && i >= 0) {
          this.selectImg(i)
        }
      }

      const scroll = (inc) => {
        if(this.viewProject) {
          this.scrollImg(inc)
        }
      }

      switch(e.code) {
        case 'ArrowRight':
          select(this.selectedIndex + 1)
          break;
        case 'ArrowLeft':
          select(this.selectedIndex - 1)
          break;
        case 'ArrowDown':
          scroll(1)
          break;
        case 'ArrowUp':
          scroll(-1)
          break;
        case 'Enter':
          this.openProject()
          this.displacePlanes()
          break;
        case 'Escape':
          this.closeProject()
          this.displacePlanes()
          break;
      }
    }

    const onMouseDown = () => {
    }
    
    const onMouseUp = () => {
      this.onClick()
    }

    addListener(window, 'resize', onResize)
    addListener(window, 'wheel', onWheel)
    addListener(window, 'mousemove', onMouseMove)
    addListener(window, 'keydown', onKey)
    addListener(this.canvas, 'mousedown', onMouseDown)
    addListener(this.canvas, 'mouseup', onMouseUp)
  }

  selectNext() {
    if(this.selectedIndex < this.imgCount) {
      this.selectImg(this.selectedIndex + 1)
    }
  }

  selectPrev() {
    if(this.selectedIndex > 0) {
      this.selectImg(this.selectedIndex - 1)
    }
  }
  
  selectImg(index) {
    this.closeProject()
    this.lerpTime = 0
    // set net selected index
    this.selectedIndex = index;
    this.callbacks.onChange({index, dims: getObjectWindowDimensions(this.camera, this.planes[this.selectedIndex])})
    this.cameraTargetPos.x = IMG_OFFSET * index

    // move planes according to selected index
    this.displacePlanes()
  }

  scrollImg(incr) {
    // translate selected plane vertically based on scroll direction
    this.planes[this.selectedIndex].targetPos.y += incr * pixelToLength(50, this.camera, this.selectedPlane)
  }

  translateScroll() {
    // get current plane positions
    const l = this.selectedPlane.plane.position.y
    // translate to px
    const px = lengthToPixel(l, this.camera, this.selectedPlane)
    const target = this.selectedPlane.targetPos.x

    this.scrollY = l;

    this.callbacks.onScroll({l, px, target})
  }

  onClick() {
    // if plane is selected and hovered, toggle open and close project
    if(this.hoverIndex === this.selectedIndex && this.hovering) {
      if (this.viewProject) {
        this.closeProject()
      } else {
        this.openProject()
      }
      this.displacePlanes()
      // else select overed img
    } else if(this.hovering) {
      this.selectImg(this.hoverIndex)
    }
  }

  // displace unselected planes to make space for rotated selected plane
  displacePlanes() {
    // change offset between selected and other planes based on viewProject boolean
    const offset = this.viewProject ? getDimensions().width / 2 : IMG_OFFSET
    const displacement = this.planes[this.selectedIndex].width / 2 + offset / 2
    // displace each group by half of the selected plane's width + offset in opposite directions
    for(let i = 0; i < this.planes.length; i++) {
      const current = this.planes[i]
      if(i === this.selectedIndex) {
        current.targetPos.x = i * IMG_OFFSET
      }else if (i < this.selectedIndex) {
        current.targetPos.x = i * IMG_OFFSET - displacement
      } else if (i > this.selectedIndex) {
        current.targetPos.x = i * IMG_OFFSET + displacement
      }
    }
  }

  calcScrollPercent() {
    const scrollTargetPercent = this.cameraTargetPos.x / this.scrollTrackLength || 0;
    this.scrollPercent += (scrollTargetPercent - this.scrollPercent) * LERP_COEF;
  }

  moveCamera() {
    // lerp camera position between current and target positions
    this.camera.position.x = this.scrollPercent * (IMG_OFFSET) * this.imgCount
  }

  movePlanes() {
    this.planes.forEach(({plane, targetPos}, i) => {
      
      const isSelected = i === this.selectedIndex
      const isHovered = i === this.hoverIndex && this.hovering
      
      const scale = this.viewProject && isSelected ? 1 : isSelected && isHovered ? 0.9 : 1
      
      const mouseRotRatioY = -this.mouseWorldPos.x
      const mouseRotRatioX = this.mouseWorldPos.y / getDimensions().ratio * plane.userData.ratio
      
      // calc unselected planes rotation
      const unselectedRotY = isHovered ? 90 - Math.abs(mouseRotRatioY) * 10 : 90
      const unselectedRotX = 0

      const selectedRotY = isHovered && !this.viewProject ? mouseRotRatioY * 15 : 0
      const selectedRotX = isHovered && !this.viewProject ? mouseRotRatioX * 15 : 0
      // select target rotation in radians based on position relative to selected index
      const rotationY = degToRad(isSelected ? selectedRotY : i < this.selectedIndex ? unselectedRotY : -unselectedRotY)
      const rotationX = degToRad(isSelected ? selectedRotX : unselectedRotX)
      // lerp plane's rotation, position and scale
      plane.rotation.y += (rotationY - plane.rotation.y) * LERP_COEF * 2
      plane.rotation.x += (rotationX - plane.rotation.x) * LERP_COEF * 2
      plane.scale.x += (scale - plane.scale.x) * LERP_COEF
      plane.scale.y += (scale - plane.scale.y) * LERP_COEF
      plane.position.x += (targetPos.x - plane.position.x) * LERP_COEF
      plane.position.y += (targetPos.y - plane.position.y) * LERP_COEF
    })
  }
  

  checkHover() {
    // cast ray from mouse position, get index of plane that is hovered
    this.raycaster.setFromCamera(this.mouseWorldPos, this.camera)
    const intersects = this.raycaster.intersectObjects(this.planeObjects)
    if(intersects.length > 0) {
      // get index of next plane
      const {index} = intersects[0].object.userData
      this.hovering = true;
      this.hoverIndex = index
    } else {
      this.hovering = false;
    }
  }

  closeProject() {
    this.viewProject = false;
    this.callbacks.onSelect({index: this.selectedIndex, select: this.viewProject})
    // reset scroll position of planes
    for(let i = 0; i <= this.imgCount; i++) {
      this.planes[i].targetPos.y = 0;
    } 
  }

  openProject() {
    this.viewProject = true;
    this.callbacks.onSelect({index: this.selectedIndex, select: this.viewProject})
    this.selectedPlane.targetPos.y = pixelToLength(-175, this.camera, this.selectedPlane)
  }

  render() {
    this.checkHover()
    this.calcScrollPercent()
    this.moveCamera()
    this.movePlanes()
    this.translateScroll()

    // update grid uniforms
    this.grid.material.uniforms.mousePos.value = this.mouseWorldPos

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this))
  }
}

export function setupRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  })
  resizeRenderer(renderer)
  return renderer
}

export function setupCamera() {
  const {width, height} = getDimensions();
  const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000);
  camera.position.setZ(500)
  return camera;
}

export function setupScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function resizeRenderer(renderer, width = window.innerWidth, height = window.innerHeight) {
  renderer.setSize(width, height);
}

export function resizeCamera(camera, width = window.innerWidth, height = window.innerHeight) {

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

export function positionPlane(plane, index) {
  plane.rotation.y = degToRad(90)
  plane.position.x = index * IMG_OFFSET
  const pos = new THREE.Vector3(...Object.values(plane.position))
  const rotation = new THREE.Vector3(...Object.values(plane.rotation))
  return {
    plane, basePos: pos, targetPos: pos, index, targetRotation: rotation, baseRotation: rotation
  }
}

export const createPlane = async (loader, url, index, camera) => new Promise((resolve, reject) => {
  loader.load(
    url,
    texture => {
      // extract image dimensions
      const {naturalWidth, naturalHeight} = texture.image;
      const {size, frac} = calcPlaneHeight(getDimensions().height - 200, camera)
      const {width, height, ratio} = clampImgSize(naturalWidth, naturalHeight, size)

      // create plane width image texture
      const geo = new THREE.PlaneGeometry(width, height);
      // embed index into plane
      const mat = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: texture
      })
      const plane = new THREE.Mesh(geo, mat);

      // store plane index, ratio and viewport height ratio
      plane.userData = {index, ratio, frac}
      // position planes & return basePosition, targetPosition, dimensions
      const imgRatio = width / height;
      return resolve({...positionPlane(plane, index), width, height, imgRatio})
    },
    undefined,
    e => reject(e)
  )
})

export function clampImgSize(w, h, max) {
  const ratio = w / h;
  const isPortrait = h > w;
  const width = isPortrait ? max * ratio : max;
  const height = !isPortrait ? max / ratio : max;
  return {width, height, ratio}
}

export function getMouseWorldPos({clientX, clientY}) {
  const {width, height} = getDimensions()
  let x = (clientX / width) * 2 - 1;
  let y = -(clientY / height) * 2 + 1;
  return {x, y}
}

export const lengthToPixel = (l, camera, object, axisY = false) => {
  const frac = l / getHeightVisible(camera, object)
  const {height, ratio} = getDimensions()
  let px = height * frac
  if(axisY) {
    px *= ratio
  }
  return px
}

export const pixelToLength = (px, camera, object) => {
  const frac = px / getDimensions().height
  const l = frac * getHeightVisible(camera, object)
  return l
}

const getHeightVisible = (camera, object) => {
  const dist = camera.position.z - object.plane.position.z
  const vFOV = degToRad(camera.fov)
  const heightVisible = 2 * Math.tan(vFOV / 2) * dist

  return heightVisible
}

export function getObjectWindowDimensions(camera, object) {
  const frac = object.height / getHeightVisible(camera, object)

  const height = getDimensions().height * frac

  const width = height * object.imgRatio
  return {width, height}
}

// convert length in px to world units
export function calcPlaneHeight(targetHeight = getDimensions().height - 200, camera, dist = 500) {
  // get ratio of target height to viewport height
  const frac = targetHeight / getDimensions().height
  
  // reverse heightVisible calculation
  const vFOV = degToRad(camera.fov)
  const heightVisible = 2 * Math.tan(vFOV / 2) * dist

  const objectHeight = frac * heightVisible

  return {size: objectHeight, frac}
}

export function createGrid(offset = IMG_OFFSET / 4) {
  const {width, height} = getDimensions()
  const xAmount = Math.floor(width / offset * 4),
        yAmount = Math.floor(height / offset * 4)
  
  const particlesAmount = xAmount * yAmount
  const positions = new Float32Array(particlesAmount * 3)
  const scales = new Float32Array(particlesAmount)

  let i = 0, j = 0

  const xRes = offset - ( ( xAmount * offset ) / 2 )
  const yRes = offset - ( ( yAmount * offset ) / 2 )

  for(let ix = 0; ix < xAmount; ix ++) {
    for(let iy = 0; iy < yAmount; iy ++) {
      positions[ i ] = ix * offset - ( ( xAmount * offset ) / 2 ); // x
      positions[ i + 1 ] = iy * offset - ( ( yAmount * offset ) / 2 ); // y
      positions[ i + 2 ] = -500; // z
      scales[ j ] = 10;

      i += 3;
      j ++;
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  geometry.setAttribute( 'scale', new THREE.BufferAttribute( scales, 1 ) );

  const material = new THREE.ShaderMaterial( {
    uniforms: {
      color: {
        value: new THREE.Color( 0xffffff ),
      },
      mousePos: {
        value: new THREE.Vector2(0, 0),
      },
      resolution: {
        value: new THREE.Vector2(width, height),
      },
      minMax: {
        value: new THREE.Vector2(xRes, yRes)
      }
    },
    vertexShader: shaders.vert.grid,
    fragmentShader: shaders.frag.grid,
  } );

  const particles = new THREE.Points(geometry, material);

  return particles;
}

export class Text {
  constructor(text, options = {}) {
    this.text = text
    this.options = {...this.defaultOptions, options}
    this.init()
  }

  get defaultOptions() {
    return {
      display: 'flex',
      gap: 15,
      fontSize: 15,
      justify: 'between',
    }
  }

  init() {
    
  }
}
