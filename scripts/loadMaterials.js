import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const materialsDir = join(__dirname, '..', 'data', 'materials')

function readYaml(filename) {
  return load(readFileSync(join(materialsDir, filename), 'utf8'))
}

export function loadMaterials() {
  return {
    framing: readYaml('framing.yaml'),
    cavity: readYaml('cavity-insulation.yaml'),
    continuous: readYaml('continuous-insulation.yaml'),
    boundary: readYaml('sheathing-cladding.yaml'),
    icf: readYaml('icf.yaml'),
  }
}
