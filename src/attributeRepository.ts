import { AttributeInfo } from './csharpParser';

/**
 * Represents a location where an attribute appears in the codebase
 */
export interface AttributeLocation {
  file: string;
  attribute: AttributeInfo;
  namespace: string | null;
}

/**
 * Manages attribute data storage and retrieval
 */
export class AttributeRepository {
  private attributeMap: Map<string, AttributeLocation[]> = new Map();

  /**
   * Add or update an attribute's locations
   */
  setAttributeLocations(attributeName: string, locations: AttributeLocation[]): void {
    if (locations.length === 0) {
      this.attributeMap.delete(attributeName);
    } else {
      this.attributeMap.set(attributeName, locations);
    }
  }

  /**
   * Get all locations for a specific attribute
   */
  getAttributeLocations(attributeName: string): AttributeLocation[] {
    return this.attributeMap.get(attributeName) || [];
  }

  /**
   * Get all attribute names
   */
  getAllAttributeNames(): Set<string> {
    return new Set(this.attributeMap.keys());
  }

  /**
   * Remove locations for a file from all attributes
   */
  removeLocationsFromFile(filePath: string): void {
    const keysToDelete: string[] = [];

    for (const [key, locations] of this.attributeMap.entries()) {
      const filtered = locations.filter(loc => loc.file !== filePath);
      if (filtered.length === 0) {
        keysToDelete.push(key);
      } else {
        this.attributeMap.set(key, filtered);
      }
    }

    for (const key of keysToDelete) {
      this.attributeMap.delete(key);
    }
  }

  /**
   * Get all locations as a map
   */
  getAllLocations(): Map<string, AttributeLocation[]> {
    return new Map(this.attributeMap);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.attributeMap.clear();
  }

  /**
   * Get total count of all attribute occurrences
   */
  getTotalOccurrenceCount(): number {
    let count = 0;
    for (const locations of this.attributeMap.values()) {
      count += locations.length;
    }
    return count;
  }

  /**
   * Get count of occurrences for a specific attribute
   */
  getAttributeOccurrenceCount(attributeName: string): number {
    return this.getAttributeLocations(attributeName).length;
  }
}
