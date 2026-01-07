import {Vector2} from "./Vector2.js";
import {events} from "./Events.js";

export class GameObject {
  constructor({ position }) {
    this.position = position ?? new Vector2(0, 0);
    this.children = [];
    this.parent = null;
    this.hasReadyBeenCalled = false;
    this.isSolid = false;
    this.drawLayer = null;

    // Performance optimization: separate static and dynamic children
    // Static children (trees, rocks, buildings) are pre-sorted once
    // Dynamic children (player, NPCs) are re-sorted when they move
    this._staticChildren = [];
    this._dynamicChildren = [];
    this._mergedCache = null;
    this._sortedChildrenDirty = true;
  }

  // First entry point of the loop
  stepEntry(delta, root) {
    // Call updates on all children first
    this.children.forEach((child) => child.stepEntry(delta, root));

    // Call ready on the first frame
    if (!this.hasReadyBeenCalled) {
      this.hasReadyBeenCalled = true;
      this.ready();
    }

    // Call any implemented Step code
    this.step(delta, root);
  }

  // Called before the first `step`
  ready() {
    // ...
  }

  // Called once every frame
  step(_delta) {
    // ...
  }

  /* draw entry */
  draw(ctx, x, y) {
    const drawPosX = x + this.position.x;
    const drawPosY = y + this.position.y;

    // Do the actual rendering for Images
    this.drawImage(ctx, drawPosX, drawPosY);

    // Pass on to children (skip children with special draw layers like HUD or LIGHTS)
    this.getDrawChildrenOrdered().forEach((child) => {
      // Skip children with HUD or LIGHTS drawLayer (they render in separate passes)
      if (child.drawLayer === "HUD" || child.drawLayer === "LIGHTS") {
        return;
      }
      child.draw(ctx, drawPosX, drawPosY);
    });
  }

  // Comparator for Y-sorting objects
  _compareByY(a, b) {
    if (b.drawLayer === "FLOOR") {
      return 1;
    }

    // Use sortingOffsetY if defined, otherwise default to 0
    const aSortY = a.position.y + (a.sortingOffsetY ?? 0);
    const bSortY = b.position.y + (b.sortingOffsetY ?? 0);

    // Proper comparison: return 0 when equal for stable sorting
    if (aSortY < bSortY) return -1;
    if (aSortY > bSortY) return 1;
    return 0;
  }

  // Merge two sorted arrays into one sorted array (O(n+m) instead of O(n log n))
  _mergeSortedArrays(arr1, arr2) {
    const result = [];
    let i = 0, j = 0;

    while (i < arr1.length && j < arr2.length) {
      if (this._compareByY(arr1[i], arr2[j]) <= 0) {
        result.push(arr1[i]);
        i++;
      } else {
        result.push(arr2[j]);
        j++;
      }
    }

    // Add remaining elements
    while (i < arr1.length) result.push(arr1[i++]);
    while (j < arr2.length) result.push(arr2[j++]);

    return result;
  }

  getDrawChildrenOrdered() {
    // #future #engine #culling #performance
    // OPTIMIZATION TODO: Currently sorting ALL children regardless of viewport visibility.
    // For large levels with hundreds of objects, consider only sorting objects within/near
    // the camera viewport. Culling happens later during render, but we're still sorting
    // off-screen objects unnecessarily.

    // Return cached merged result if available and not dirty
    if (this._mergedCache && !this._sortedChildrenDirty) {
      return this._mergedCache;
    }

    // Sort only the dynamic children (static children are already sorted)
    const sortedDynamic = [...this._dynamicChildren].sort((a, b) => this._compareByY(a, b));

    // Merge pre-sorted static children with newly sorted dynamic children
    this._mergedCache = this._mergeSortedArrays(this._staticChildren, sortedDynamic);

    this._sortedChildrenDirty = false;
    console.log(this._mergedCache.length);
    return this._mergedCache;
  }

  drawImage(ctx, drawPosX, drawPosY) {
    //...
  }

  // Remove from the tree
  destroy() {
    this.children.forEach(child => {
      child.destroy();
    })
    this.parent.removeChild(this)
  }

  /* Other Game Objects are nestable inside this one */
  addChild(gameObject) {
    gameObject.parent = this;
    this.children.push(gameObject);

    // Add to appropriate array based on whether object will move
    // Objects can set this.isDynamic = true in their constructor
    if (gameObject.isDynamic) {
      this._dynamicChildren.push(gameObject);
    } else {
      // Insert static child in sorted position
      this._insertSorted(gameObject);
    }

    // Invalidate sorted children cache when children are added
    this._sortedChildrenDirty = true;
    // Invalidate Main's layer cache when scene graph changes
    this.invalidateRootLayerCache();
  }

  // Insert a static child into the pre-sorted static children array
  _insertSorted(gameObject) {
    // Find insertion point using binary search for better performance
    let low = 0;
    let high = this._staticChildren.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this._compareByY(this._staticChildren[mid], gameObject) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this._staticChildren.splice(low, 0, gameObject);
  }

  removeChild(gameObject) {
    events.unsubscribe(gameObject);
    this.children = this.children.filter(g => {
      return gameObject !== g;
    })

    // Remove from static or dynamic array
    this._staticChildren = this._staticChildren.filter(g => g !== gameObject);
    this._dynamicChildren = this._dynamicChildren.filter(g => g !== gameObject);

    // Invalidate sorted children cache when children are removed
    this._sortedChildrenDirty = true;
    // Invalidate Main's layer cache when scene graph changes
    this.invalidateRootLayerCache();
  }

  // Call this when an object's Y position changes to invalidate parent's sorting cache
  invalidateParentSorting() {
    if (this.parent) {
      this.parent._sortedChildrenDirty = true;
    }
  }

  // Walk up the tree to find and invalidate Main's layer cache
  invalidateRootLayerCache() {
    let current = this;
    while (current) {
      if (current.invalidateLayerCache) {
        current.invalidateLayerCache();
        return;
      }
      current = current.parent;
    }
  }
}