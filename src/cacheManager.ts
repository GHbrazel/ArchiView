import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AttributeRepository, AttributeLocation } from './attributeRepository';
import { AttributeInfo } from './csharpParser';

/**
 * Manages caching of parsed C# attributes to disk.
 * Persists attribute data on startup to avoid re-parsing large projects,
 * and invalidates the cache when attributes are added/removed.
 */
export class CacheManager {
  private cacheFilePath: string;
  private isDirty: boolean = false;
  private cacheWriteTimeout: NodeJS.Timeout | null = null;

  constructor(storagePath: string) {
    this.cacheFilePath = path.join(storagePath, 'attributes.cache.json');
  }

  /**
   * Load cached attributes from disk into the repository
   * Returns true if cache was loaded successfully, false if no cache or error
   */
  async loadCache(repository: AttributeRepository): Promise<boolean> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        console.debug('No cache file found');
        return false;
      }

      const cacheData = fs.readFileSync(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(cacheData);

      if (!parsed.attributes || typeof parsed.attributes !== 'object') {
        console.debug('Invalid cache format');
        return false;
      }

      // Restore the attribute map into the repository
      for (const [attrName, locations] of Object.entries(parsed.attributes)) {
        const restoredLocations = (locations as any[]).map(loc => ({
          file: loc.file,
          attribute: {
            name: loc.attribute.name,
            fullName: loc.attribute.fullName,
            arguments: loc.attribute.arguments,
            line: loc.attribute.line,
            column: loc.attribute.column,
            targetElement: loc.attribute.targetElement,
            targetSpecifier: loc.attribute.targetSpecifier,
            targetName: loc.attribute.targetName,
            parameterType: loc.attribute.parameterType,
            parameterName: loc.attribute.parameterName
          } as AttributeInfo,
          namespace: loc.namespace
        } as AttributeLocation));

        repository.setAttributeLocations(attrName, restoredLocations);
      }

      console.debug(`Loaded ${Object.keys(parsed.attributes).length} attributes from cache`);
      this.isDirty = false;
      return true;
    } catch (error) {
      console.error('Error loading cache:', error);
      return false;
    }
  }

  /**
   * Save repository data to cache file
   * Uses debouncing to avoid excessive I/O during rapid changes
   */
  async saveCache(repository: AttributeRepository): Promise<void> {
    this.isDirty = true;

    // Clear existing timeout
    if (this.cacheWriteTimeout) {
      clearTimeout(this.cacheWriteTimeout);
    }

    // Debounce the write: wait 500ms before actually writing
    this.cacheWriteTimeout = setTimeout(async () => {
      try {
        const allLocations = repository.getAllLocations();
        const attributesData: Record<string, any[]> = {};

        for (const [attrName, locations] of allLocations.entries()) {
          attributesData[attrName] = locations.map(loc => ({
            file: loc.file,
            attribute: {
              name: loc.attribute.name,
              fullName: loc.attribute.fullName,
              arguments: loc.attribute.arguments,
              line: loc.attribute.line,
              column: loc.attribute.column,
              targetElement: loc.attribute.targetElement,
              targetSpecifier: loc.attribute.targetSpecifier,
              targetName: loc.attribute.targetName,
              parameterType: loc.attribute.parameterType,
              parameterName: loc.attribute.parameterName
            },
            namespace: loc.namespace
          }));
        }

        const cacheData = {
          version: 1,
          timestamp: new Date().toISOString(),
          attributes: attributesData
        };

        // Ensure directory exists
        const cacheDir = path.dirname(this.cacheFilePath);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }

        fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
        this.isDirty = false;
        console.debug(`Saved cache with ${Object.keys(attributesData).length} attributes`);
      } catch (error) {
        console.error('Error saving cache:', error);
      }
    }, 500);
  }

  /**
   * Invalidate cache when attributes are significantly changed
   */
  invalidateCache(): Promise<void> {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        fs.unlinkSync(this.cacheFilePath);
        console.debug('Cache invalidated');
      }
      this.isDirty = false;
      return Promise.resolve();
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Check if cache exists and is valid
   */
  cacheExists(): boolean {
    return fs.existsSync(this.cacheFilePath);
  }

  /**
   * Get cache file info for debugging
   */
  getCacheInfo(): { exists: boolean; path: string; isDirty: boolean; size?: number } {
    return {
      exists: this.cacheExists(),
      path: this.cacheFilePath,
      isDirty: this.isDirty,
      size: this.cacheExists() ? fs.statSync(this.cacheFilePath).size : undefined
    };
  }
}
