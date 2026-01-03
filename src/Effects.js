/**
 * Manages visual and environmental effects for a level.
 * Provides a flexible system for adding multiple effects.
 */
export class Effects {
  constructor(config = {}) {
    this.effectsMap = new Map();

    // Initialize from config
    Object.entries(config).forEach(([key, value]) => {
      this.effectsMap.set(key, value);
    });
  }

  /**
   * Set an effect value
   * @param {string} name - Effect name (e.g., 'timeOfDay', 'rain', 'fog')
   * @param {*} value - Effect value
   */
  set(name, value) {
    this.effectsMap.set(name, value);
  }

  /**
   * Get an effect value
   * @param {string} name - Effect name
   * @returns {*} Effect value or undefined
   */
  get(name) {
    return this.effectsMap.get(name);
  }

  /**
   * Check if an effect exists
   * @param {string} name - Effect name
   * @returns {boolean}
   */
  has(name) {
    return this.effectsMap.has(name);
  }

  /**
   * Remove an effect
   * @param {string} name - Effect name
   */
  remove(name) {
    this.effectsMap.delete(name);
  }

  /**
   * Get all effects as an object
   * @returns {Object}
   */
  getAll() {
    return Object.fromEntries(this.effectsMap);
  }

  /**
   * Copy effects from another Effects instance
   * @param {Effects} otherEffects - Effects to copy from
   */
  copyFrom(otherEffects) {
    otherEffects.effectsMap.forEach((value, key) => {
      this.effectsMap.set(key, value);
    });
  }

  /**
   * Merge with another Effects instance (other takes priority)
   * @param {Effects} otherEffects - Effects to merge
   */
  mergeWith(otherEffects) {
    otherEffects.effectsMap.forEach((value, key) => {
      if (value !== null && value !== undefined) {
        this.effectsMap.set(key, value);
      }
    });
  }
}
