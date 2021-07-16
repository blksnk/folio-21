import GL from './lib/GL.js';
import { setTrackDimesions, setProjectDescription, setProjectTitleSvg, setCurrentCount, elements, addListener } from './ui.js';

import projects from '../data/projects.js'

const canvas = document.getElementById('gl-canvas');


const onChange = ({index, dims}) => {
  const proj = projects[index]
  setTrackDimesions(dims)
  setProjectTitleSvg(proj.title, dims.width)
  setProjectDescription(proj.description)
  setCurrentCount(index)
}

const gl = new GL({canvas, onChange})

const linkEvents = () => {
  addListener(elements.BTN_PREV, 'click', gl.selectPrev.bind(gl))
  addListener(elements.BTN_NEXT, 'click', gl.selectNext.bind(gl))
}

linkEvents()