import * as vscode from 'vscode';

export class FilterManager {
  private selectedAttributes: Set<string> = new Set();
  private searchQuery: string = '';
  private lamportClockVersion: number = 0;
  private _onFilterChanged = new vscode.EventEmitter<Set<string>>();
  onFilterChanged = this._onFilterChanged.event;

  constructor() {
    // Initialize with no filters (all shown)
  }

  setSelectedAttributes(attributes: string[]): void {
    this.selectedAttributes = new Set(attributes);
    this.incrementLamportClock();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  toggleAttributeInFilter(attribute: string): void {
    if (this.selectedAttributes.has(attribute)) {
      this.selectedAttributes.delete(attribute);
    } else {
      this.selectedAttributes.add(attribute);
    }
    this.incrementLamportClock();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  addAttributeToFilter(attribute: string): void {
    this.selectedAttributes.add(attribute);
    this.incrementLamportClock();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  removeAttributeFromFilter(attribute: string): void {
    this.selectedAttributes.delete(attribute);
    this.incrementLamportClock();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  clearAllFilters(): void {
    this.selectedAttributes.clear();
    this.searchQuery = '';
    this.incrementLamportClock();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.incrementLamportClock();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
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
