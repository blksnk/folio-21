import GL from './lib/GL.js';
import Scroller from './lib/scroll.js';
import {
  setProjectDescription,
  setProjectTitle,
  setCurrentCount,
  elements,
  addListener,
  setTrackVisibility,
} from './ui.js';

import projects from '../data/projects.js'

const canvas = document.getElementById('gl-canvas');

const scroller = new Scroller({el: elements.TRACK})

const onChange = ({index, dims}) => {
  const proj = projects[index]
  setProjectTitle(proj.title, dims.height)
  setProjectDescription(proj.description, dims.width)
  setCurrentCount(index)
}

const onSelect = ({select}) => {
  setTrackVisibility(select)
}

const onScroll = ({px}) => {
  scroller.setScroll({y: -px})
  scroller.apply()
}

const gl = new GL({canvas, onChange, onScroll, onSelect})

const linkEvents = () => {
  addListener(elements.BTN_PREV, 'click', gl.selectPrev.bind(gl))
  addListener(elements.BTN_NEXT, 'click', gl.selectNext.bind(gl))
}

linkEvents()
