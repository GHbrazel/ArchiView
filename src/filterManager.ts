import * as vscode from 'vscode';

export class FilterManager {
  private selectedAttributes: Set<string> = new Set();
  private searchQuery: string = '';
  private lamportClockVersion: number = 0;
  private _onFilterChanged = new vscode.EventEmitter<{attributes: Set<string>, version: number}>();
  onFilterChanged = this._onFilterChanged.event;

  constructor() {
    // Initialize with no filters (all shown)
  }

  setSelectedAttributes(attributes: string[]): void {
    this.selectedAttributes = new Set(attributes);
    this.incrementLamportClock();
    this._onFilterChanged.fire({attributes: new Set(this.selectedAttributes), version: this.lamportClockVersion});
  }

  toggleAttributeInFilter(attribute: string): void {
    if (this.selectedAttributes.has(attribute)) {
      this.selectedAttributes.delete(attribute);
    } else {
      this.selectedAttributes.add(attribute);
    }
    this.incrementLamportClock();
    this._onFilterChanged.fire({attributes: new Set(this.selectedAttributes), version: this.lamportClockVersion});
  }

  addAttributeToFilter(attribute: string): void {
    this.selectedAttributes.add(attribute);
    this.incrementLamportClock();
    this._onFilterChanged.fire({attributes: new Set(this.selectedAttributes), version: this.lamportClockVersion});
  }

  removeAttributeFromFilter(attribute: string): void {
    this.selectedAttributes.delete(attribute);
    this.incrementLamportClock();
    this._onFilterChanged.fire({attributes: new Set(this.selectedAttributes), version: this.lamportClockVersion});
  }

  clearAllFilters(): void {
    this.selectedAttributes.clear();
    this.searchQuery = '';
    this.incrementLamportClock();
    this._onFilterChanged.fire({attributes: new Set(this.selectedAttributes), version: this.lamportClockVersion});
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.incrementLamportClock();
    this._onFilterChanged.fire({attributes: new Set(this.selectedAttributes), version: this.lamportClockVersion});
  }

  getSearchQuery(): string {
    return this.searchQuery;
  }

  matchesSearchQuery(attributeName: string): boolean {
    if (!this.searchQuery) {
      return true;
    }
    
    // Remove brackets and case-insensitive match
    const cleanedName = attributeName.replace(/[\[\]]/g, '').toLowerCase();
    return cleanedName.includes(this.searchQuery);
  }

  private incrementLamportClock(): void {
    this.lamportClockVersion++;
  }

  getLamportClockVersion(): number {
    return this.lamportClockVersion;
  }

  getSelectedAttributes(): Set<string> {
    return new Set(this.selectedAttributes);
  }

  hasActiveFilters(): boolean {
    return this.selectedAttributes.size > 0 || this.searchQuery.length > 0;
  }

  isAttributeSelected(attribute: string): boolean {
    return this.selectedAttributes.has(attribute);
  }
}
