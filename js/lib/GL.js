import {getDimensions, degToRad, lerp} from './units.js'
import DATA_IMG from '../../data/images.js'

const IMG_OFFSET = 100

export default class GL {
  constructor({ canvas }) {
    this.init(canvas)
  }
  
  async init(canvas) {
    this.loader = new THREE.TextureLoader()
    this.textures = null;
    
    this.images = DATA_IMG;
    //setup GL context
    this.renderer = setupRenderer(canvas);
    this.scene = setupScene();
    this.camera = setupCamera();

    this.cameraTargetPos = new THREE.Vector3(0, 0, 500);
    this.mouseWorldPos =  new THREE.Vector3(0, 0, 1);
    this.lerpTime = 0;
    this.selectedIndex = 0;
    
    //load textures and create planes
    const planes = await Promise.all(this.images.map(({url}, index) => createPlane(this.loader, url, index)))
    this.planes = planes;
    // store nbr of imgs for boundaries detection
    this.imgCount = planes.length
    // add planes to scene
    this.scene.add(...this.planes.map(({plane}) => plane))
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
      if(index < this.imgCount && index >= 0) {
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
      if(i < this.imgCount && i >= 0) {
        // reset lerp time to prevent infinite lerp when scrolling fast
        this.lerpTime = 0
        this.selectImg(i)
      }
    }

    const onMouseDown = () => {
      console.log(this.mouseWorldPos)
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
    //rotate last selected back 90deg
    this.selectedIndex = index;
    this.cameraTargetPos.x = IMG_OFFSET * index

    this.displacePlanes()
    // rotate selected plane to face camera
    const {plane} = this.planes[index]
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

  moveCamera() {
    if(this.camera.position.distanceTo(this.cameraTargetPos) >= 0.01) {
      // lerp camera position between current and target positions
      this.camera.position.lerp(this.cameraTargetPos, this.lerpTime)
      this.lerpTime += 0.005;
    }
    else {
      this.lerpTime = 0
    }
  }

  movePlanes() {
    this.planes.forEach(({plane, targetPos, targetRotation}, i) => {
      // lerp plane position between current and target positions
      plane.position.lerp(targetPos, this.lerpTime)
      // Rotate plane when selected
      
      
      if(i === this.selectedIndex) {
        if(this.lerpTime > 0 && this.lerpTime < 1) {
          plane.rotation.y = lerp(plane.rotation.y, this.mouseWorldPos.x / 4, this.lerpTime)
          plane.rotation.x = lerp(plane.rotation.x, -this.mouseWorldPos.y / 4, this.lerpTime)
        } else {
          plane.rotation.y = this.mouseWorldPos.x / 4
          plane.rotation.x = -this.mouseWorldPos.y / 4
        }
      } else {
        plane.rotation.y = lerp(plane.rotation.y, targetRotation.y, this.lerpTime)
        plane.rotation.x = lerp(plane.rotation.x, targetRotation.x, this.lerpTime)
      }

    })
  }

  mouseEffects() {

  }

  render() {
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
  camera.position.setZ(950)
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
      const mat = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: texture
      })
      const plane = new THREE.Mesh(geo, mat);
      // position planes & return basePosition, targetPosition, dimensions
      return resolve({...positionPlane(plane, index), width, height})
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