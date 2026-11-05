/* global describe, it, expect, globalThis */

var safeJsonStringify = require('../')

describe('basic stringify', function () {
  it('works on simple values', function () {
    expect(safeJsonStringify('foo')).toBe('"foo"')
    expect(safeJsonStringify({foo: 'bar'})).toBe('{"foo":"bar"}')
  })
})

describe('object identity', function () {
  it('works with an object with identical properties', function () {
    var a = { foo: 'bar' }
    var b = { one: a, two: a }
    expect(safeJsonStringify(b)).toBe('{"one":{"foo":"bar"},"two":{"foo":"bar"}}')
  })
})

describe('circular references', function () {
  it('doesn’t exceed stack size', function () {
    var a = {}
    a.a = a
    a.b = 'c'
    try {
      expect(safeJsonStringify(a)).toBeTruthy()
    } catch (e) {
      expect(e).toBeFalsy()
    }
  })

  it('returns [Circular] for circular references', function () {
    var a = {}
    a.a = a
    a.b = 'c'
    expect(safeJsonStringify(a)).toBe('{"a":"[Circular]","b":"c"}')
  })
})

describe('null', function () {
  it('should preserve null elements', function () {
    expect(safeJsonStringify({x: null})).toBe('{"x":null}')
  })
})

describe('arrays', function () {
  it('should work with array elements', function () {
    var arr = [ 2 ]
    expect(safeJsonStringify(arr)).toBe('[2]')
    arr.push(arr)
    expect(safeJsonStringify(arr)).toBe('[2,"[Circular]"]')
    expect(safeJsonStringify({x: arr})).toBe('{"x":[2,"[Circular]"]}')
  })
})

describe('errors', function () {
  it('should extract meaningful error properties', function () {
    var err = new Error('hello')
    expect(safeJsonStringify(err)).toBe('{"name":"Error","message":"hello"}')
  })
})

describe('throwing toJSON', function () {
  it('works when obj.toJSON() throws an error', function () {
    var obj = {
      toJSON: function () {
        throw new Error('Failing')
      }
    }
    expect(safeJsonStringify(obj)).toBe('"[Throws: Failing]"')
    expect(safeJsonStringify({ x: obj })).toBe('{"x":"[Throws: Failing]"}')
  })
})

if (typeof Object.create === 'function') {
  describe('properties on Object.create(null)', function () {
    it('uses the return value of a non-throwing getter', function () {
      var obj = Object.create(null, {
        foo: {
          get: function () { return 'bar' },
          enumerable: true
        }
      })

      expect(safeJsonStringify(obj)).toBe('{"foo":"bar"}')
    })

    it('handles errors thrown from getters and uses error message', function () {
      var obj = Object.create(null, {
        foo: {
          get: function () { return 'bar' },
          enumerable: true
        },
        broken: {
          get: function () { throw new Error('Broken') },
          enumerable: true
        }
      })
      expect(safeJsonStringify(obj)).toMatch(/\{"foo":"bar","broken":"\[Throws: .*\]"\}/)
    })
  })
}

if (typeof ({}).__defineGetter__ === 'function') {
  describe('defined getter properties using __defineGetter__', function () {
    it('uses the return value of a non-throwing getter', function () {
      var obj = {}
      obj.__defineGetter__('foo', function () { return 'bar' })
      expect(safeJsonStringify(obj)).toBe('{"foo":"bar"}')
    })

    it('handles errors thrown from getters and uses error message', function () {
      var obj = {}
      obj.__defineGetter__('foo', function () { return undefined['oh my'] })
      expect(safeJsonStringify(obj)).toMatch(/\{"foo":"\[Throws: .*\]"\}/)
    })
  })
}

if (typeof Object.definePropery === 'function') {
  describe('enumerable defined getter properties using Object.defineProperty', function () {
    it('uses the return value of a non-throwing getter', function () {
      var obj = {}
      Object.defineProperty(obj, 'foo', { get: function () { return 'bar' }, enumerable: true })
      expect(safeJsonStringify(obj)).toBe('{"foo":"bar"}')
    })

    it('handles errors thrown from getters and uses error message', function () {
      var obj = {}
      Object.defineProperty(obj, 'foo', { get: function () { return undefined['oh my'] }, enumerable: true })
      expect(safeJsonStringify(obj)).toMatch(/\{"foo":"\[Throws: .*\]"\}/)
    })
  })
}

describe('formatting', function () {
  it('should pass the spaces argument through to JSON.stringify()', function () {
    var obj = { a: { b: 1, c: [ { d: 1 } ] } } // some nested object
    var formatters = [ 3, '\t', '  ' ]
    for (var i = 0; i < formatters.length; i++) {
      expect(
        safeJsonStringify(obj, null, formatters[i])
      ).toBe(
        JSON.stringify(obj, null, formatters[i])
      )
    }
  })
})

describe('replacing', function () {
  it('should pass the replacer argument through to JSON.stringify()', function () {
    var obj = { a: { b: 1, c: [ { d: 1 } ] } } // some nested object
    var replacers = [
      ['a', 'c'],
      function (k, v) { return typeof v === 'number' ? '***' : v },
      function () { return undefined },
      []
    ]
    for (var i = 0; i < replacers.length; i++) {
      expect(
        safeJsonStringify(obj, replacers[i])
      ).toBe(
        JSON.stringify(obj, replacers[i])
      )
    }
  })
})

describe('deeply nested', function () {
  it('should replace objects that are nested too deeply', function () {
    var o = nest(21, 2)
    var str = safeJsonStringify(o, null, 2)
    expect(str.indexOf('...')).toBeGreaterThan(1)
  })
})

describe('widely nested', function () {
  it('should replace objects that are nested too widely', function () {
    var o = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: { l: { m: { n: {
      o: nest(2, 2000)
    } } } } } } } } } } } } } } }
    var str = safeJsonStringify(o)
    expect(str.indexOf('...')).toBeGreaterThan(1)
  })
  it('should not replace objects less than the MIN_PRESERVED_DEPTH', function () {
    var o = { a: nest(2, 1500) }
    var str = safeJsonStringify(o)
    expect(str.indexOf('...')).toBe(-1)
  })
})

if (typeof window !== 'undefined') {
  // this test is skipped in IE8 because it doesn't perform it in a fast enough manner
  if (window.addEventListener && !window.attachEvent) {
    describe('DOM nodes', function () {
      it('should work with DOM nodes', function () {
        expect(safeJsonStringify(window.document.documentElement)).toBeTruthy()
      })
      it('should work with window', function () {
        expect(JSON.parse(safeJsonStringify({ window: window }))).toBeTruthy()
      })
    })
  }
}

function nest (n, m) {
  if (n === 0) return 'leaf'
  var o = {}
  for (var i = 0; i < m; i++) {
    o['foo_' + i] = nest(n - 1, m)
  }
  return o
}

describe('redaction options', function () {
  it('should redact nothing by default', function () {
    var fixture = require('./fixtures/01-example-payload.json')
    expect(safeJsonStringify(fixture)).toBe(JSON.stringify(fixture))
  })

  it('should only redact paths that are in "redactedPaths"', function () {
    var fixture = require('./fixtures/01-example-payload.json')
    expect(
      safeJsonStringify(fixture, null, null, { redactedKeys: [ 'subsystem' ] })
    ).toBe(JSON.stringify(fixture))
    expect(
      safeJsonStringify(fixture, null, null, {
        redactedKeys: [ 'subsystem' ],
        redactedPaths: [ 'events.[].metaData' ]
      })
    ).toBe(JSON.stringify(fixture).replace('{"name":"fs reader","widgetsAdded":10}', '"[REDACTED]"'))
  })

  it('should ignore case when redacting keys', function () {
    var fixture = require('./fixtures/01-example-payload.json')

    expect(
      safeJsonStringify(fixture, null, null, { redactedKeys: [ 'SuBsYsTeM' ] })
    ).toBe(JSON.stringify(fixture))

    expect(
      safeJsonStringify(fixture, null, null, {
        redactedKeys: [ 'SuBsYsTeM' ],
        redactedPaths: [ 'events.[].metaData' ]
      })
    ).toBe(JSON.stringify(fixture).replace('{"name":"fs reader","widgetsAdded":10}', '"[REDACTED]"'))
  })

  it('should work with regexes', function () {
    var fixture = require('./fixtures/01-example-payload.json')
    expect(
      safeJsonStringify(fixture, null, null, { redactedKeys: [ 'subsystem' ] })
    ).toBe(JSON.stringify(fixture))
    expect(
      safeJsonStringify(fixture, null, null, {
        redactedKeys: [ /na*/, /widget(s?)added/i ],
        redactedPaths: [ 'events.[].metaData' ]
      })
    ).toBe(
      JSON.stringify(fixture).replace(
        '{"name":"fs reader","widgetsAdded":10}',
        '{"name":"[REDACTED]","widgetsAdded":"[REDACTED]"}'
      )
    )
  })
})

describe('maxBytes', function () {
  function bounded (value, maxBytes, options) {
    options = options || {}
    options.maxBytes = maxBytes
    return safeJsonStringify(value, null, null, options)
  }

  function expectSizeError (run) {
    var error
    try { run() } catch (err) { error = err }
    expect(error instanceof RangeError).toBe(true)
    expect(error.code).toBe('ERR_JSON_SIZE')
  }

  function setToJSON (target, hook) {
    Object.defineProperty(target, 'toJSON', { value: hook, writable: true, configurable: true })
  }

  it('supports feature detection and preserves unbounded behavior', function () {
    expect(safeJsonStringify.supportsMaxBytes).toBe(true)
    expect(safeJsonStringify({ value: 1 }, null, null, null)).toBe('{"value":1}')
    expect(bounded({ message: 'hello' }, 19)).toBe('{"message":"hello"}')
    expectSizeError(function () { bounded({ message: 'hello' }, 18) })
  })

  it('counts UTF-8 bytes and JSON escapes without allocating escaped strings', function () {
    var cases = [['é', 4], ['漢', 5], ['😀', 6], ['\n', 4], ['\u0000', 8], ['\\', 4], ['"', 4], ['\uD800', 8]]
    cases.forEach(function (entry) {
      expect(bounded(entry[0], entry[1])).toBe(JSON.stringify(entry[0]))
      expectSizeError(function () { bounded(entry[0], entry[1] - 1) })
    })
    expectSizeError(function () { bounded({ '漢': 'é' }, 11) })
    expect(bounded({ '漢': 'é' }, 12)).toBe('{"漢":"é"}')
  })

  it('counts array values and container punctuation', function () {
    var value = [null, undefined, function () {}, NaN, true, false, 100, 'x']
    var json = JSON.stringify(value)
    expect(bounded(value, json.length)).toBe(json)
    expectSizeError(function () { bounded(value, json.length - 1) })
  })

  it('applies the budget after redaction without reading redacted properties', function () {
    var value = {}
    Object.defineProperty(value, 'secret', { enumerable: true, get: function () { throw new Error('should not be read') } })
    expect(bounded({ data: value }, 32, { redactedPaths: ['data'], redactedKeys: ['secret'] })).toBe('{"data":{"secret":"[REDACTED]"}}')
  })

  it('stops before visiting the rest of a shallow collection', function () {
    var reads = 0
    var value = []
    for (var i = 0; i < 1000; i++) {
      Object.defineProperty(value, i, { get: function () { reads++; return 'content' } })
    }
    expectSizeError(function () { bounded(value, 100) })
    expect(reads).toBeLessThan(20)
  })

  it('rejects huge values and keys before JSON.stringify', function () {
    var huge = new Array(1000001).join('x')
    expectSizeError(function () { bounded({ message: huge }, 100) })
    var keyed = {}
    keyed[huge] = 1
    expectSizeError(function () { bounded(keyed, 100) })
  })

  it('does not swallow budget errors inside toJSON or object preparation', function () {
    expectSizeError(function () { bounded({ toJSON: function () { return { nested: new Array(1001).join('x') } } }, 100) })
    expectSizeError(function () { bounded({ nested: { deep: new Array(1001).join('x') } }, 100) })
  })

  it('budgets function toJSON results at the root and inside objects and arrays', function () {
    var value = function () {}
    value.toJSON = function () { return new Array(10001).join('x') }
    expect(safeJsonStringify({ f: value }).length).toBe(10008)
    expectSizeError(function () { bounded(value, 100) })
    expectSizeError(function () { bounded({ f: value }, 100) })
    expectSizeError(function () { bounded([value], 100) })

    value.toJSON = function (key) { return key }
    expect(bounded(value, 2)).toBe('""')
    expect(bounded({ f: value }, 9)).toBe('{"f":"f"}')
    expect(bounded([value], 5)).toBe('["0"]')
  })

  it('omits ordinary functions without retaining callable values for JSON.stringify', function () {
    var value = function () {}
    expect(bounded(value, 100)).toBeUndefined()
    expect(bounded({ f: value }, 100)).toBe('{}')
    expect(bounded([value], 6)).toBe('[null]')
    expect(safeJsonStringify(value)).toBeUndefined()
    expect(safeJsonStringify({ f: value })).toBe('{}')
    expect(safeJsonStringify([value])).toBe('[null]')
  })

  it('budgets hooks on boxed primitives', function () {
    var values = [Object('x'), Object(1), Object(true)]
    values.forEach(function (value) {
      value.toJSON = function () { return new Array(1001).join('x') }
      expectSizeError(function () { bounded({ value: value }, 100) })
      value.toJSON = function () { return 'small' }
      expect(bounded(value, 7)).toBe('"small"')
    })
  })

  it('prevents inherited toJSON from running again on prepared objects', function () {
    var calls = 0
    setToJSON(Object.prototype, function () {
      calls++
      if (calls > 1) return new Array(1001).join('x')
      return Object.create(null)
    })
    try {
      expect(bounded({}, 2)).toBe('{}')
      expect(calls).toBe(1)
    } finally {
      delete Object.prototype.toJSON
    }
  })

  it('prevents inherited toJSON from running again on prepared arrays', function () {
    var calls = 0
    setToJSON(Array.prototype, function () {
      calls++
      if (calls > 1) return new Array(1001).join('x')
      return {}
    })
    var value = { toJSON: function () {
      delete Array.prototype.toJSON
      var result = []
      Object.defineProperty(result, '0', { get: function () {
        setToJSON(Array.prototype, function () { return new Array(1001).join('x') })
        return 'x'
      } })
      return result
    } }
    try {
      expect(bounded([], 2)).toBe('{}')
      expect(calls).toBe(1)
      expect(bounded(value, 5)).toBe('["x"]')
    } finally {
      delete Array.prototype.toJSON
    }
  })

  it('keeps __proto__ as an ordinary bounded property', function () {
    var value = Object.create(null)
    Object.defineProperty(value, '__proto__', { value: { value: 1 }, enumerable: true })
    var json = '{"__proto__":{"value":1}}'
    expect(bounded(value, json.length)).toBe(json)
    expectSizeError(function () { bounded(value, json.length - 1) })
  })

  it('budgets BigInt hooks and preserves unsupported BigInt errors', function () {
    var bigint = typeof globalThis !== 'undefined' && globalThis.BigInt
    if (!bigint) return
    var value = bigint(1)
    expect(function () { bounded(value, 100) }).toThrowError(TypeError)
    expect(function () { bounded({ value: value }, 100) }).toThrowError(TypeError)
    expect(function () { bounded([value], 100) }).toThrowError(TypeError)
    bigint.prototype.toJSON = function () { return new Array(1001).join('x') }
    try {
      expectSizeError(function () { bounded(value, 100) })
      expectSizeError(function () { bounded({ value: value }, 100) })
      expectSizeError(function () { bounded([value], 100) })
      expectSizeError(function () { bounded(Object(value), 100) })
      bigint.prototype.toJSON = function () { return 'small' }
      expect(bounded(value, 7)).toBe('"small"')
      expect(bounded(Object(value), 7)).toBe('"small"')
    } finally {
      delete bigint.prototype.toJSON
    }
  })

  it('ignores hooks on primitive symbols and budgets hooks on boxed symbols', function () {
    var symbol = typeof globalThis !== 'undefined' && globalThis.Symbol
    if (!symbol) return
    var value = symbol('value')
    symbol.prototype.toJSON = function () { return new Array(1001).join('x') }
    try {
      expect(bounded(value, 100)).toBeUndefined()
      expect(bounded({ value: value }, 100)).toBe('{}')
      expect(bounded([value], 6)).toBe('[null]')
      expectSizeError(function () { bounded(Object(value), 100) })
    } finally {
      delete symbol.prototype.toJSON
    }
  })

  it('preserves circular and throwing-getter behavior within the budget', function () {
    var value = {}
    value.circular = value
    Object.defineProperty(value, 'bad', { enumerable: true, get: function () { throw new Error('oops') } })
    expect(bounded(value, 100)).toBe('{"circular":"[Circular]","bad":"[Throws: oops]"}')
    expectSizeError(function () { bounded(value, 20) })
  })

  it('rejects invalid limits and incompatible formatting options', function () {
    ;[0, -1, Infinity, NaN, 1.5, '100', 9007199254740992].forEach(function (maxBytes) {
      expect(function () { bounded({}, maxBytes) }).toThrowError(TypeError)
    })
    expect(function () { safeJsonStringify({}, null, 2, { maxBytes: 100 }) }).toThrowError(TypeError)
    expect(function () { safeJsonStringify({}, function (key, value) { return value }, null, { maxBytes: 100 }) }).toThrowError(TypeError)
  })
})
