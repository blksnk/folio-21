export default class Scroll{
  constructor({el, lerp}) {
    this.el = el;
    this.lerp = lerp || 0.05;
    this.scroll = {
      target: {
        x: 0,
        y: 0,
      },
      lerped: {
        x: 0,
        y: 0,
      }
    }
    
    this.init()
  }

  init() {
    
  }

  update() {
    
  }

  apply() {
    const {x, y} = this.scroll.target
    this.el.style.transform = `translate(${x}px, ${y}px)`
  }

  setScroll({x = 0, y = 0}) {
    this.scroll.target = {x, y}
  }
}
  