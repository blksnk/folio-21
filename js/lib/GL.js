import {getDimensions, degToRad, lerp, clamp, contained} from './units.js'
import {addListener} from '../ui.js'
import Bezier from './bezier.js'
import DATA_IMG from '../../data/projects.js'

import shaders from '../shaders/index.js'

const rotationBezier = Bezier(.17, .67, .83, .67)

const IMG_OFFSET = 100
const LERP_COEF = 0.05

export default class GL {
  constructor({ canvas, onChange, onSelect }) {
    this.callbacks = {
      onChange: onChange || (() => null),
      onSelect: onSelect || (() => null)
    }
    this.canvas = canvas
    this.init()
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
      // select img with arrow keys
      let i = this.selectedIndex
      switch(e.code) {
        case 'ArrowRight':
          i++;
          break
        case 'ArrowLeft':
          i--;
          break
      }
      if(i <= this.imgCount && i >= 0) {
        // reset lerp time to prevent infinite lerp when scrolling fast
        this.selectImg(i)
      }
    }

    const onMouseDown = () => {
      this.onClick()
    }

    const onMouseUp = () => {
    }

    addListener(window, 'resize', onResize)
    addListener(window, 'wheel', onWheel)
    addListener(window, 'mousemove', onMouseMove)
    addListener(window, 'keydown', onKey)
    addListener(this.canvas, 'mousedown', onMouseDown)
    addListener(this.canvas, 'mouseup', onMouseUp)
  }

  selectNext() {
    console.log(this.selectedIndex, this.imgCount)
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
    this.planes[this.selectedIndex].targetPos.y += incr * 100
  }

  onClick() {
    // if plane is selected and hovered, toggle open and close project
    if(this.hoverIndex === this.selectedIndex && this.hovering) {
      this.viewProject = !this.viewProject
      if (this.viewProject) {
        this.callbacks.onSelect({index: this.selectedIndex})
      } else {
        this.closeProject()
      }
      this.lerpTime = 0
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
    // correct for track length 
    this.camera.position.x = this.scrollPercent * (IMG_OFFSET) * this.imgCount
  }

  movePlanes() {
    this.planes.forEach(({plane, targetPos}, i) => {
      
      const isSelected = i === this.selectedIndex
      const isHovered = i === this.hoverIndex && this.hovering
      
      const scale = this.viewProject && isSelected ? 2 - plane.userData.frac : isSelected && isHovered ? 0.9 : 1
      
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
      plane.scale.y += (scale - plane.scale.x) * LERP_COEF
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
    // reset scroll position of planes
    for(let i = 0; i <= this.imgCount; i++) {
      this.planes[i].targetPos.y = 0;
    } 
  }

  render() {
    this.checkHover()
    this.calcScrollPercent()
    this.moveCamera()
    this.movePlanes()

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
  const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
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
      const {width, height, ratio} = normalizeImgSize(naturalWidth, naturalHeight, size)

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

export function normalizeImgSize(w, h, max) {
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

export function getObjectWindowDimensions(camera, object) {
  const dist = camera.position.z - object.plane.position.z
  const vFOV = degToRad(camera.fov)

  const heightVisible = 2 * Math.tan(vFOV / 2) * dist

  const frac = object.height / heightVisible

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
  const xAmount = Math.floor(width / offset * 2),
        yAmount = Math.floor(height / offset * 2)
  
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

  console.log(positions)

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