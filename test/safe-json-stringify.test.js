/* global describe, it, expect */

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
    expect(str.indexOf('[MAX_DEPTH exceeded]')).toBeGreaterThan(1)
  })
})

describe('widely nested', function () {
  it('should replace objects that are nested too widely', function () {
    var o = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: { l: { m: { n: {
      o: nest(2, 2000)
    } } } } } } } } } } } } } } }
    var str = safeJsonStringify(o)
    expect(str.indexOf('[MAX_EDGES exceeded]')).toBeGreaterThan(1)
  })
  it('should not replace objects less than the MIN_PRESERVED_DEPTH widely', function () {
    var o = { a: nest(2, 2000) }
    var str = safeJsonStringify(o)
    expect(str.indexOf('[MAX_EDGES exceeded]')).toBe(-1)
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
