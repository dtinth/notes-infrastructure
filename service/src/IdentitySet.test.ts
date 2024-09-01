import { expect, test } from 'bun:test'
import { IdentitySet } from './IdentitySet'

test('IdentitySet - basic operations', () => {
  const set = new IdentitySet<string>()

  // Test initial size
  expect(set.size).toBe(0)

  // Test add and has
  set.add('a')
  expect(set.has('a')).toBe(true)
  expect(set.has('b')).toBe(false)
  expect(set.size).toBe(1)

  // Test adding duplicate
  set.add('a')
  expect(set.size).toBe(1)

  // Test delete
  expect(set.delete('a')).toBe(true)
  expect(set.has('a')).toBe(false)
  expect(set.size).toBe(0)

  // Test delete non-existent item
  expect(set.delete('b')).toBe(false)

  // Test clear
  set.add('x')
  set.add('y')
  set.clear()
  expect(set.size).toBe(0)
  expect(set.has('x')).toBe(false)
  expect(set.has('y')).toBe(false)
})

test('IdentitySet - get method', () => {
  const set = new IdentitySet<string>()

  // Test get for non-existent item
  expect(set.get('a')).not.toBe(set.get('a'))

  // Test get for existing item
  set.add('a')
  expect(set.get('a')).toBe(set.get('a'))

  // Test get after delete
  set.delete('a')
  expect(set.get('a')).not.toBe(set.get('a'))
})

test('IdentitySet - iterator', () => {
  const set = new IdentitySet<string>()
  set.add('a').add('b').add('c')

  // Test get for non-existent item
  expect([...set]).toEqual(['a', 'b', 'c'])
  expect([...set.keys()]).toEqual(['a', 'b', 'c'])
  expect([...set.values()]).toEqual(['a', 'b', 'c'])
})
