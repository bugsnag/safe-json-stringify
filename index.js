module.exports = function (data, replacer, space, opts) {
  var redactedKeys = opts && opts.redactedKeys ? opts.redactedKeys : []
  var redactedPaths = opts && opts.redactedPaths ? opts.redactedPaths : []
  var maxBytes = opts ? opts.maxBytes : undefined
  if (maxBytes !== undefined && (typeof maxBytes !== 'number' || maxBytes <= 0 || maxBytes > 9007199254740991 || Math.floor(maxBytes) !== maxBytes)) {
    throw new TypeError('maxBytes must be a positive safe integer')
  }
  if (maxBytes !== undefined && (replacer != null || space != null)) {
    throw new TypeError('maxBytes cannot be combined with replacer or space')
  }
  return JSON.stringify(
    prepareObjForSerialization(data, redactedKeys, redactedPaths, maxBytes),
    replacer,
    space
  )
}

module.exports.supportsMaxBytes = true

var MAX_DEPTH = 20
var MAX_EDGES = 25000
var MIN_PRESERVED_DEPTH = 8

var REPLACEMENT_NODE = '...'

function isError (o) {
  return o instanceof Error ||
    /^\[object (Error|(Dom)?Exception)\]$/.test(Object.prototype.toString.call(o))
}

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

function shouldRedact (patterns, key) {
  for (var i = 0, len = patterns.length; i < len; i++) {
    if (typeof patterns[i] === 'string' && patterns[i].toLowerCase() === key.toLowerCase()) return true
    if (patterns[i] && typeof patterns[i].test === 'function' && patterns[i].test(key)) return true
  }
  return false
}

function isArray (obj) {
  return Object.prototype.toString.call(obj) === '[object Array]'
}

function prepareObjForSerialization (obj, redactedKeys, redactedPaths, maxBytes) {
  var seen = [] // store references to objects we have seen before
  var edges = 0
  var bytes = 0
  var sizeError

  function exceed () {
    sizeError = new RangeError('JSON payload exceeds maxBytes')
    sizeError.code = 'ERR_JSON_SIZE'
    throw sizeError
  }

  function take (count) {
    if (maxBytes === undefined) return
    bytes += count
    if (bytes > maxBytes) exceed()
  }

  function stringBytes (value) {
    if (maxBytes === undefined) return
    take(2)
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i)
      if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) take(2)
      else if (code < 32) take(6)
      else if (code < 128) take(1)
      else if (code < 2048) take(2)
      else if (code >= 0xD800 && code <= 0xDBFF && value.charCodeAt(i + 1) >= 0xDC00 && value.charCodeAt(i + 1) <= 0xDFFF) {
        take(4)
        i++
      } else if (code >= 0xD800 && code <= 0xDFFF) take(6)
      else take(3)
    }
  }

  function primitive (value, inArray) {
    if (typeof value === 'string') stringBytes(value)
    else if (value === null || (inArray && (value === undefined || typeof value === 'function' || typeof value === 'symbol'))) take(4)
    else if (typeof value === 'boolean') take(value ? 4 : 5)
    else if (typeof value === 'number') take(isFinite(value) ? String(value).length : 4)
    return value
  }

  function thrown (err) {
    if (sizeError && err === sizeError) throw err
    if (maxBytes !== undefined && err && typeof err.message === 'string' && err.message.length > maxBytes - bytes) exceed()
    return throwsMessage(err)
  }

  function visit (obj, path, inArray) {
    function edgesExceeded () {
      return path.length > MIN_PRESERVED_DEPTH && edges > MAX_EDGES
    }

    edges++

    if (path.length > MAX_DEPTH) return primitive(REPLACEMENT_NODE)
    if (edgesExceeded()) return primitive(REPLACEMENT_NODE)
    if (obj === null || typeof obj !== 'object') return primitive(obj, inArray)
    if (find(seen, obj)) return primitive('[Circular]')

    seen.push(obj)

    if (typeof obj.toJSON === 'function') {
      try {
        // we're not going to count this as an edge because it
        // replaces the value of the currently visited object
        edges--
        var fResult = visit(obj.toJSON(), path, inArray)
        seen.pop()
        return fResult
      } catch (err) {
        return primitive(thrown(err))
      }
    }

    var er = isError(obj)
    if (er) {
      edges--
      var eResult = visit({ name: obj.name, message: obj.message }, path)
      seen.pop()
      return eResult
    }

    if (isArray(obj)) {
      take(2)
      var aResult = []
      for (var i = 0, len = obj.length; i < len; i++) {
        if (i) take(1)
        if (edgesExceeded()) {
          aResult.push(primitive(REPLACEMENT_NODE))
          break
        }
        aResult.push(visit(obj[i], path.concat('[]'), true))
      }
      seen.pop()
      return aResult
    }

    take(2)
    var result = {}
    var properties = 0
    try {
      for (var prop in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, prop)) continue
        if (properties++) take(1)
        stringBytes(prop)
        take(1)
        if (isDescendent(redactedPaths, path.join('.')) && shouldRedact(redactedKeys, prop)) {
          result[prop] = primitive('[REDACTED]')
          continue
        }
        if (edgesExceeded()) {
          result[prop] = primitive(REPLACEMENT_NODE)
          break
        }
        var value
        try {
          value = obj[prop]
        } catch (err) {
          value = thrown(err)
        }
        result[prop] = visit(value, path.concat(prop))
      }
    } catch (e) {
      if (sizeError && e === sizeError) throw e
    }
    seen.pop()
    return result
  }

  return visit(obj, [])
}
