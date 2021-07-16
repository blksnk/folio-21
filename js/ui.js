import { getDimensions } from "./lib/units.js"

export const TRACK = document.getElementById('track')
export const TITLE = document.getElementById('title')
export const DESCRIPTION = document.getElementById('description')
export const BTN_PREV = document.getElementById('btn-prev');
export const BTN_NEXT = document.getElementById('btn-next');
export const COUNT_CURRENT = document.getElementById('count-current');
export const COUNT_TOTAL = document.getElementById('count-total');

export const elements = {
  BTN_PREV,
  BTN_NEXT,
  COUNT_CURRENT,
  COUNT_TOTAL,
}

export const prevent = (e) => e.preventDefault()

export const listener = (cb = () => null, doPrevent = false) => (e) => {
  if(doPrevent) {
    prevent(e)
  }
  cb(e)
}

export const addListener = (el, type, cb, doPrevent) => el.addEventListener(type, listener(cb, doPrevent))

export const setTrackDimesions = ({width, height}) => {
  TRACK.style.width = width + 'px'
  const H = getDimensions().height
  TRACK.style.marginTop = H - ((H - height) / 2) + 'px'
}

export const setProjectTitle = (title, trackWidth) => {
  // set text content
  TITLE.textContent = title
  TITLE.style.transform = 'scale(1, 1)'

  // get current width of text
  const {width} = TITLE.getBoundingClientRect()
  const ratio = trackWidth / width
  const size = ratio
  // transform text to fill track width
  TITLE.style.transform = `scale(${size}, ${size})`

  // get transformed height of text
  const {height} = TITLE.getBoundingClientRect()
  console.log(height)
  // set new height
  // TITLE.style.height = height + 'px';
}

export const setProjectTitleSvg = (title, trackWidth) => {
  TITLE.removeAttribute('viewBox')
  const text = TITLE.querySelector('text')
  text.textContent = title
  const {width} = text.getBoundingClientRect()
  TITLE.setAttribute('viewBox', `0 0 ${width} 26`)
}

export const setProjectDescription = (text) => {
  //clear description
  DESCRIPTION.textContent = ""
  // split text by linereturn and spaces
  const rows = text.split('\n').map(str => str.split(' ').filter(str => str !== ''))
  rows.forEach(row => {
    const line = document.createElement('div')
    row.forEach(word => {
      const span = document.createElement('span')
      span.textContent = word;
      line.appendChild(span)
    })
    DESCRIPTION.appendChild(line)
  })
}

export const setCurrentCount = (index) => {
  COUNT_CURRENT.textContent = index + 1
}