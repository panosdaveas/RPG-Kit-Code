export class HeroAttributes {
    constructor() {
        this.data = new Map();
    }

    // Set a single attribute
    set(name, value) {
        this.data.set(name, value);
    }

    // Get a single attribute
    get(name) {
        return this.data.get(name);
    }

    // Check if attribute exists
    has(name) {
        return this.data.has(name);
    }

    // Get all attributes as object (for network sync)
    getAll() {
        const obj = {};
        this.data.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }

    // Set multiple attributes from object (for network sync)
    setMultiple(attributesObject) {
        Object.keys(attributesObject).forEach(key => {
            this.data.set(key, attributesObject[key]);
        });
    }

    // Remove an attribute
    remove(name) {
        this.data.delete(name);
    }

    // Clear all attributes
    clear() {
        this.data.clear();
    }
}