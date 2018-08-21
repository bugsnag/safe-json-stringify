module.exports = function (data, replacer, space, opts) {
  var filterKeys = opts && opts.filterKeys ? opts.filterKeys : []
  var filterPaths = opts && opts.filterPaths ? opts.filterPaths : []
  return JSON.stringify(
    prepareObjForSerialization(data, filterKeys, filterPaths),
    replacer,
    space
  )
}

var MAX_DEPTH = 20
var MAX_EDGES = 25000
var MIN_PRESERVED_DEPTH = 8

var REPLACEMENT_NODE = '...'

function throwsMessage (err) {
  return '[Throws: ' + (err ? err.message : '?') + ']'
}

function find (haystack, needle) {
  for (var i = 0, len = haystack.length; i < len; i++) {
    if (haystack[i] === needle) return true
  }
  return false
}

// returns true if the string `path` starts with any of the provided `paths`
function isDescendent (paths, path) {
  for (var i = 0, len = paths.length; i < len; i++) {
    if (path.indexOf(paths[i]) === 0) return true
  }
  return false
}

function shouldFilter (patterns, key) {
  for (var i = 0, len = patterns.length; i < len; i++) {
    if (typeof patterns[i] === 'string' && patterns[i] === key) return true
    if (patterns[i] && typeof patterns[i].test === 'function' && patterns[i].test(key)) return true
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

function prepareObjForSerialization (obj, filterKeys, filterPaths) {
  var seen = [] // store references to objects we have seen before
  var edges = 0

  function visit (obj, path) {
    function edgesExceeded () {
      return path.length > MIN_PRESERVED_DEPTH && edges > MAX_EDGES
    }

    edges++

    if (path.length > MAX_DEPTH) return REPLACEMENT_NODE
    if (edgesExceeded()) return REPLACEMENT_NODE
    if (obj === null || typeof obj !== 'object') return obj
    if (find(seen, obj)) return '[Circular]'

    seen.push(obj)

    if (typeof obj.toJSON === 'function') {
      try {
        // we're not going to count this as an edge because it
        // replaces the value of the currently visited object
        edges--
        var fResult = visit(obj.toJSON(), depth, path)
        seen.pop()
        return fResult
      } catch (err) {
        return throwsMessage(err)
      }
    }

    if (isArray(obj)) {
      var aResult = []
      for (var i = 0, len = obj.length; i < len; i++) {
        if (edgesExceeded()) {
          aResult.push(REPLACEMENT_NODE)
          break
        }
        aResult.push(visit(obj[i], depth + 1, path.concat('[]')))
      }
      seen.pop()
      return aResult
    }

    var result = {}
    try {
      for (var prop in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop)) continue
        if (isDescendent(filterPaths, path.join('.')) && shouldFilter(filterKeys, prop)) {
          result[prop] = '[Filtered]'
          continue
        }
        if (edgesExceeded()) {
          result[prop] = REPLACEMENT_NODE
          break
        }
        result[prop] = visit(safelyGetProp(obj, prop), depth + 1, path.concat(prop))
      }
    } catch (e) {}
    seen.pop()
    return result
  }

  return visit(obj, 0, [])
}
