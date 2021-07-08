import {getDimensions, degToRad, lerp, clamp, contained} from './units.js'
import Bezier from './bezier.js'
import DATA_IMG from '../../data/images.js'

const rotationBezier = Bezier(.17, .67, .83, .67)

const IMG_OFFSET = 100
const LERP_COEF = 0.05

export default class GL {
  constructor({ canvas }) {
    this.init(canvas)
  }
  
  async init(canvas) {
    this.loader = new THREE.TextureLoader()
    this.raycaster = new THREE.Raycaster()
    this.textures = null;
    
    this.images = DATA_IMG;
    //setup GL context
    this.renderer = setupRenderer(canvas);
    this.scene = setupScene();
    this.camera = setupCamera();

    this.cameraTargetPos = new THREE.Vector3(0, 0, 500);
    this.cameraScrollPos = 0;
    this.scrollPercent = 0;
    this.mouseWorldPos =  new THREE.Vector2(0.5, 0.5);
    this.lerpTime = 0;
    this.selectedIndex = 0;
    this.hoverIndex = 0;
    
    // load textures and create planes
    const planes = await Promise.all(this.images.map(({url}, index) => createPlane(this.loader, url, index)))
    this.planes = planes;
    this.planeObjects = this.planes.map(({plane}) => plane)
    // store nbr of imgs for boundaries detection
    this.imgCount = planes.length - 1
    // camera max scroll length for lerp
    this.scrollTrackLength = (this.imgCount) * IMG_OFFSET
    // add planes to scene
    this.scene.add(...this.planeObjects)
    this.setupEvents()
    this.displacePlanes()

    this.render()
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
      if(index <= this.imgCount && index >= 0) {
        // reset lerp time to prevent infinite lerp when scrolling fast
        this.lerpTime = 0
        this.selectImg(index)
      }
    }

    const onMouseMove = (e) => {
      // get mouse position in world coordinates
      const {x, y} = getMouseWorldPos(e)
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
        this.lerpTime = 0
        this.selectImg(i)
      }
    }

    const onMouseDown = () => {
      console.log(this.mouseWorldPos)
      this.checkHover()
    }

    const onMouseUp = () => {
      console.log(this.mouseWorldPos)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('wheel', onWheel)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)

  }
  
  selectImg(index) {
    // set net selected index
    this.selectedIndex = index;
    this.cameraTargetPos.x = IMG_OFFSET * index

    // move planes according to selected index
    this.displacePlanes()
  }

  // displace unselected planes to make space for rotated selected plane
  displacePlanes() {
    const displacement = this.planes[this.selectedIndex].width / 2 + IMG_OFFSET / 2
    // displace each group by half of the selected plane's width + offset in opposite directions
    for(let i = 0; i < this.planes.length; i++) {
      const current = this.planes[i]
      if(i === this.selectedIndex) {
        current.targetPos.x = i * IMG_OFFSET
        current.targetRotation.y = 0;
      }else if (i < this.selectedIndex) {
        current.targetRotation.y = degToRad(90)
        current.targetPos.x = i * IMG_OFFSET - displacement
      } else if (i > this.selectedIndex) {
        current.targetRotation.y = degToRad(-90)
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
    
    if(this.camera.position.distanceTo(this.cameraTargetPos) >= 0.01) {
      // this.camera.position.x += (lerpPercentPos - this.camera.position.x) * 0.05
      // this.camera.position.lerp(this.cameraTargetPos, this.lerpTime)
      this.lerpTime += 0.005;
    }
    else {
      this.lerpTime = 0
    }
  }

  movePlanes() {
    this.planes.forEach(({plane, targetPos, clamped}, i) => {
      // lerp plane position between current and target positions
      plane.position.lerp(targetPos, this.lerpTime)

      // select target rotation in radians based on position relative to selected index
      const radians = degToRad(i === this.selectedIndex ? 0 : i < this.selectedIndex ? 90 : -90)
      
      // lerp and add rotation increment to plane
      plane.rotation.y += (radians - plane.rotation.y) * LERP_COEF


    })
    // console.log(...this.planes.map(({plane}, i) => i + ': ' + Math.ceil(plane.rotation.y / Math.PI * 180) + ' | '))
  }

  checkHover() {
    // cast ray from mouse position, get index of plane that is hovered
    this.raycaster.setFromCamera(this.mouseWorldPos, this.camera)
    const intersects = this.raycaster.intersectObjects(this.planeObjects)
    if(intersects.length > 0) {
      // get index of next plane
      const {index} = intersects[0].object.userData
      this.hoverIndex = index
    }
  }

  render() {
    this.checkHover()
    this.calcScrollPercent()
    this.moveCamera()
    this.movePlanes()

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

export const createPlane = async (loader, url, index) => new Promise((resolve, reject) => {
  loader.load(
    url,
    texture => {
      // extract image dimensions
      const {naturalWidth, naturalHeight} = texture.image;
      const {width, height} = normalizeImgSize(naturalWidth, naturalHeight, 550)

      // create plane width image texture
      const geo = new THREE.PlaneGeometry(width, height);
      // embed index into plane
      const mat = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: texture
      })
      const plane = new THREE.Mesh(geo, mat);
      plane.userData = {index}
      // position planes & return basePosition, targetPosition, dimensions
      return resolve({...positionPlane(plane, index), width, height, clamped: false})
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
  return {width, height}
}

export function getMouseWorldPos({clientX, clientY}) {
  const {width, height} = getDimensions()
  let x = (clientX / width) * 2 - 1;
  let y = -(clientY / height) * 2 + 1;
  return {x, y}
}