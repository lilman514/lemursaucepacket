// A small SNBT writer for Easy NPC presets. Plain JS values map to the obvious tags (numbers -> int, strings ->
// string, booleans -> byte, arrays -> list, objects -> compound); wrap a number to choose another type.

const tagged = (type, value) => ({ __snbt: type, value })
export const byte = (v) => tagged('byte', v)
export const short = (v) => tagged('short', v)
export const long = (v) => tagged('long', v)
export const float = (v) => tagged('float', v)
export const double = (v) => tagged('double', v)
export const intArray = (v) => tagged('intArray', v)
/** A string written with single quotes (handy for JSON text components, which are full of double quotes). */
export const json = (v) => tagged('json', typeof v === 'string' ? v : JSON.stringify(v))

const SIMPLE_KEY = /^[A-Za-z0-9_.+-]+$/

function quote(s, q = '"') {
  return q + String(s).replace(/\\/g, '\\\\').replace(q === '"' ? /"/g : /'/g, '\\' + q) + q
}

function num(n, suffix) {
  if (!Number.isFinite(n)) throw new Error(`SNBT number ${n}`)
  return `${n}${suffix}`
}

/** Serialises a value. `indent` > 0 pretty-prints (Easy NPC reads either). */
export function snbt(value, indent = 2, depth = 0) {
  const pad = indent ? '\n' + ' '.repeat(indent * (depth + 1)) : ''
  const end = indent ? '\n' + ' '.repeat(indent * depth) : ''
  if (value && typeof value === 'object' && '__snbt' in value) {
    const v = value.value
    switch (value.__snbt) {
      case 'byte': return num(v, 'b')
      case 'short': return num(v, 's')
      case 'long': return num(v, 'L')
      case 'float': return num(Number.isInteger(v) ? v : v, 'f').replace(/^(-?\d+)f$/, '$1.0f')
      case 'double': return num(v, 'd').replace(/^(-?\d+)d$/, '$1.0d')
      case 'intArray': return `[I;${v.join(',')}]`
      case 'json': return quote(v, "'")
      default: throw new Error(`unknown SNBT tag ${value.__snbt}`)
    }
  }
  if (typeof value === 'boolean') return value ? '1b' : '0b'
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return num(value, 'd')
    return String(value)
  }
  if (typeof value === 'string') return quote(value)
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return '[' + value.map((v) => pad + snbt(v, indent, depth + 1)).join(',') + end + ']'
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined && value[k] !== null)
    if (!keys.length) return '{}'
    return '{' + keys.map((k) => pad + (SIMPLE_KEY.test(k) ? k : quote(k)) + ':' + snbt(value[k], indent, depth + 1)).join(',') + end + '}'
  }
  throw new Error(`can't write ${value} as SNBT`)
}
