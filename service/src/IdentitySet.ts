/**
 * An object that represents a unique identity, suitable for use as a key in a WeakMap.
 */
export class Identity<T = string> {
  constructor(public readonly id: T) {
    Object.freeze(this)
  }
}

/**
 * A set that remembers the unique identity of each value added to it.
 */
export class IdentitySet<T = string> {
  private readonly map = new Map<T, Identity<T>>()

  /**
   * The number of unique ids in the set.
   */
  get size(): number {
    return this.map.size
  }

  /**
   * Adds the given `id` to the set if it is not already present.
   * Effectively, this makes future calls to `get` return the same
   * identity object until the value is removed.
   */
  add(id: T): this {
    if (this.map.has(id)) return this
    this.map.set(id, new Identity(id))
    return this
  }

  /**
   * Checks if the given `id` is being remembered by this set.
   */
  has(id: T): boolean {
    return this.map.has(id)
  }

  /**
   * Removes the given `id` from the set.
   */
  delete(id: T): boolean {
    return this.map.delete(id)
  }

  /**
   * Removes all ids from the set.
   */
  clear(): void {
    this.map.clear()
  }

  /**
   * Returns the corresonding identity object for the given `id`.
   * It always returns an identity object, even if the `id` was not
   * previously added to the set, so returned value can directly be
   * used as a key in a WeakMap.
   *
   * - If the `id` was in the set, the returned object will be
   *   referentially stable. i.e. `get(id) === get(id)` will hold.
   * - If the `id` was not in the set, a new identity object will
   *   be created and returned each time. i.e. `get(id) !== get(id)`.
   */
  get(id: T): Identity<T> {
    return this.map.get(id) || new Identity(id)
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.map.keys()
  }

  keys(): IterableIterator<T> {
    return this.map.keys()
  }

  values(): IterableIterator<T> {
    return this.map.keys()
  }
}
