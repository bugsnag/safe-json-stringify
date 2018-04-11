module.exports = function (data, replacer, space) {
  return JSON.stringify(ensureProperties(data), replacer, space)
}

var MAX_DEPTH = 20
var MAX_EDGES = 10000
var MIN_PRESERVED_DEPTH = 10

var MAX_EDGES_EXCEEDED_NODE = '[MAX_EDGES exceeded]'
var MAX_DEPTH_EXCEEDED_NODE = '[MAX_DEPTH exceeded]'

function throwsMessage (err) {
  return '[Throws: ' + (err ? err.message : '?') + ']'
}

function find (haystack, needle) {
  for (var i = 0, len = haystack.length; i < len; i++) {
    if (haystack[i] === needle) return true
  }
  return false
}

function isArray (obj) {
  return Object.prototype.toString.call(obj) === '[object Array]'
}

function safelyGetProp (obj, prop) {
  try {
    return obj[prop]
  } catch (err) {
    return throwsMessage(err)
  }
}

function ensureProperties (obj) {
  var seen = [] // store references to objects we have seen before
  var edges = 0

  function visit (obj, depth) {
    function edgesExceeded () {
      return depth > MIN_PRESERVED_DEPTH && edges > MAX_EDGES
    }

    if (depth === undefined) depth = 0
    if (depth > MAX_DEPTH) return MAX_DEPTH_EXCEEDED_NODE
    if (edgesExceeded()) return MAX_EDGES_EXCEEDED_NODE
    if (obj === null || typeof obj !== 'object') return obj
    if (find(seen, obj)) return '[Circular]'

    seen.push(obj)

    if (typeof obj.toJSON === 'function') {
      try {
        var fResult = visit(obj.toJSON(), depth)
        seen.pop()
        return fResult
      } catch (err) {
        return throwsMessage(err)
      }
    }

    if (isArray(obj)) {
      var aResult = []
      for (var i = 0, len = obj.length; i < len; i++) {
        edges++
        if (edgesExceeded()) {
          aResult.push(MAX_EDGES_EXCEEDED_NODE)
          break
        }
        aResult.push(visit(obj[i], depth + 1))
      }
      seen.pop()
      return aResult
    }

    var result = {}
    try {
      for (var prop in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop)) continue
        edges++
        if (edgesExceeded()) {
          result[prop] = MAX_EDGES_EXCEEDED_NODE
          break
        }
        result[prop] = visit(safelyGetProp(obj, prop), depth + 1)
      }
    } catch (e) {}
    seen.pop()
    return result
  }

  return visit(obj)
}
