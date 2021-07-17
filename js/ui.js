import { getDimensions, lerpUntil } from "./lib/units.js"

export const TRACK = document.getElementById('track')
export const TITLE = document.getElementById('title')
export const DESCRIPTION = document.getElementById('description')
export const BTN_PREV = document.getElementById('btn-prev');
export const BTN_NEXT = document.getElementById('btn-next');
export const COUNT_CURRENT = document.getElementById('count-current');
export const COUNT_TOTAL = document.getElementById('count-total');

export const elements = {
  TRACK,
  BTN_PREV,
  BTN_NEXT,
  COUNT_CURRENT,
  COUNT_TOTAL,
  TITLE,
  DESCRIPTION,
}

export const prevent = (e) => e.preventDefault()

export const listener = (cb = () => null, doPrevent = false) => (e) => {
  if(doPrevent) {
    prevent(e)
  }
  cb(e)
}

export const addListener = (el, type, cb, doPrevent) => el.addEventListener(type, listener(cb, doPrevent))

export const setTrackVisibility = (visible) => {
  const opacity = visible ? 1 : 0
  TRACK.style.opacity = opacity
}

export const setProjectTitle = (title, imgHeight) => {
  TITLE.removeAttribute('viewBox')
  const text = TITLE.querySelector('text')
  text.textContent = title
  const {width} = text.getBoundingClientRect()
  TITLE.setAttribute('viewBox', `0 0 ${width} 26`)
  TITLE.style.marginBottom = imgHeight - 25 + 'px'
}

export const setProjectDescription = (text, width) => {
  //clear description
  DESCRIPTION.textContent = ""

  // set description width

  DESCRIPTION.style.width = width + 'px';
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
