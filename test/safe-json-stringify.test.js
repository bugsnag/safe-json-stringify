/* global describe, it, expect */

const safeJsonStringify = require('../')

describe('basic stringify', function () {
  it('works on simple values', function () {
    expect(safeJsonStringify('foo')).toBe('"foo"')
    expect(safeJsonStringify({ foo: 'bar' })).toBe('{"foo":"bar"}')
  })
})

describe('object identity', function () {
  it('works with an object with identical properties', function () {
    const a = { foo: 'bar' }
    const b = { one: a, two: a }
    expect(safeJsonStringify(b)).toBe('{"one":{"foo":"bar"},"two":{"foo":"bar"}}')
  })
})

describe('circular references', function () {
  it('doesn’t exceed stack size', function () {
    const a = {}
    a.a = a
    a.b = 'c'
    try {
      expect(safeJsonStringify(a)).toBeTruthy()
    } catch (e) {
      expect(e).toBeFalsy()
    }
  })

  it('returns [Circular] for circular references', function () {
    const a = {}
    a.a = a
    a.b = 'c'
    expect(safeJsonStringify(a)).toBe('{"a":"[Circular]","b":"c"}')
  })
})

describe('null', function () {
  it('should preserve null elements', function () {
    expect(safeJsonStringify({ x: null })).toBe('{"x":null}')
  })
})

describe('arrays', function () {
  it('should work with array elements', function () {
    const arr = [2]
    expect(safeJsonStringify(arr)).toBe('[2]')
    arr.push(arr)
    expect(safeJsonStringify(arr)).toBe('[2,"[Circular]"]')
    expect(safeJsonStringify({ x: arr })).toBe('{"x":[2,"[Circular]"]}')
  })
})

describe('errors', function () {
  it('should extract meaningful error properties', function () {
    const err = new Error('hello')
    expect(safeJsonStringify(err)).toBe('{"name":"Error","message":"hello"}')
  })
})

describe('throwing toJSON', function () {
  it('works when obj.toJSON() throws an error', function () {
    const obj = {
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
      const obj = Object.create(null, {
        foo: {
          get: function () { return 'bar' },
          enumerable: true
        }
      })

      expect(safeJsonStringify(obj)).toBe('{"foo":"bar"}')
    })

    it('handles errors thrown from getters and uses error message', function () {
      const obj = Object.create(null, {
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
      const obj = {}
      obj.__defineGetter__('foo', function () { return 'bar' })
      expect(safeJsonStringify(obj)).toBe('{"foo":"bar"}')
    })

    it('handles errors thrown from getters and uses error message', function () {
      const obj = {}
      obj.__defineGetter__('foo', function () { return undefined['oh my'] })
      expect(safeJsonStringify(obj)).toMatch(/\{"foo":"\[Throws: .*\]"\}/)
    })
  })
}

if (typeof Object.definePropery === 'function') {
  describe('enumerable defined getter properties using Object.defineProperty', function () {
    it('uses the return value of a non-throwing getter', function () {
      const obj = {}
      Object.defineProperty(obj, 'foo', { get: function () { return 'bar' }, enumerable: true })
      expect(safeJsonStringify(obj)).toBe('{"foo":"bar"}')
    })

    it('handles errors thrown from getters and uses error message', function () {
      const obj = {}
      Object.defineProperty(obj, 'foo', { get: function () { return undefined['oh my'] }, enumerable: true })
      expect(safeJsonStringify(obj)).toMatch(/\{"foo":"\[Throws: .*\]"\}/)
    })
  })
}

describe('formatting', function () {
  it('should pass the spaces argument through to JSON.stringify()', function () {
    const obj = { a: { b: 1, c: [{ d: 1 }] } } // some nested object
    const formatters = [3, '\t', '  ']
    for (let i = 0; i < formatters.length; i++) {
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
    const obj = { a: { b: 1, c: [{ d: 1 }] } } // some nested object
    const replacers = [
      ['a', 'c'],
      function (k, v) { return typeof v === 'number' ? '***' : v },
      function () { return undefined },
      []
    ]
    for (let i = 0; i < replacers.length; i++) {
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
    const o = nest(21, 2)
    const str = safeJsonStringify(o, null, 2)
    expect(str.indexOf('...')).toBeGreaterThan(1)
  })
})

describe('widely nested', function () {
  it('should replace objects that are nested too widely', function () {
    const o = {
      a: {
        b: {
          c: {
            d: {
              e: {
                f: {
                  g: {
                    h: {
                      i: {
                        j: {
                          k: {
                            l: {
                              m: {
                                n: {
                                  o: nest(2, 2000)
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    const str = safeJsonStringify(o)
    expect(str.indexOf('...')).toBeGreaterThan(1)
  })
  it('should not replace objects less than the MIN_PRESERVED_DEPTH', function () {
    const o = { a: nest(2, 1500) }
    const str = safeJsonStringify(o)
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
        expect(JSON.parse(safeJsonStringify({ window }))).toBeTruthy()
      })
    })
  }
}

function nest (n, m) {
  if (n === 0) return 'leaf'
  const o = {}
  for (let i = 0; i < m; i++) {
    o['foo_' + i] = nest(n - 1, m)
  }
  return o
}

describe('redaction options', function () {
  it('should redact nothing by default', function () {
    const fixture = require('./fixtures/01-example-payload.json')
    expect(safeJsonStringify(fixture)).toBe(JSON.stringify(fixture))
  })

  it('should only redact paths that are in "redactedPaths"', function () {
    const fixture = require('./fixtures/01-example-payload.json')
    expect(
      safeJsonStringify(fixture, null, null, { redactedKeys: ['subsystem'] })
    ).toBe(JSON.stringify(fixture))
    expect(
      safeJsonStringify(fixture, null, null, {
        redactedKeys: ['subsystem'],
        redactedPaths: ['events.[].metaData']
      })
    ).toBe(JSON.stringify(fixture).replace('{"name":"fs reader","widgetsAdded":10}', '"[REDACTED]"'))
  })

  it('should ignore case when redacting keys', function () {
    const fixture = require('./fixtures/01-example-payload.json')

    expect(
      safeJsonStringify(fixture, null, null, { redactedKeys: ['SuBsYsTeM'] })
    ).toBe(JSON.stringify(fixture))

    expect(
      safeJsonStringify(fixture, null, null, {
        redactedKeys: ['SuBsYsTeM'],
        redactedPaths: ['events.[].metaData']
      })
    ).toBe(JSON.stringify(fixture).replace('{"name":"fs reader","widgetsAdded":10}', '"[REDACTED]"'))
  })

  it('should work with regexes', function () {
    const fixture = require('./fixtures/01-example-payload.json')
    expect(
      safeJsonStringify(fixture, null, null, { redactedKeys: ['subsystem'] })
    ).toBe(JSON.stringify(fixture))
    expect(
      safeJsonStringify(fixture, null, null, {
        redactedKeys: [/na*/, /widget(s?)added/i],
        redactedPaths: ['events.[].metaData']
      })
    ).toBe(
      JSON.stringify(fixture).replace(
        '{"name":"fs reader","widgetsAdded":10}',
        '{"name":"[REDACTED]","widgetsAdded":"[REDACTED]"}'
      )
    )
  })
})
