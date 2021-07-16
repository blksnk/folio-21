import vert from './vert.js';
import frag from './frag.js';

const cleanString = s => s.split('\n').join('')

const cleanAll = obj => {
  return obj
  for(let prop in obj) {
    const s = cleanString(obj[prop])
    obj[prop] = s
  }
}

export default {
  vert: cleanAll(vert), frag: cleanAll(frag)
}