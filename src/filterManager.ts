import * as vscode from 'vscode';

export class FilterManager {
  private selectedAttributes: Set<string> = new Set();
  private _onFilterChanged = new vscode.EventEmitter<Set<string>>();
  onFilterChanged = this._onFilterChanged.event;

  constructor() {
    // Initialize with no filters (all shown)
  }

  /**
   * Set the selected attributes to filter by
   */
  setSelectedAttributes(attributes: string[]): void {
    this.selectedAttributes = new Set(attributes);
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  toggleAttributeInFilter(attribute: string): void {
    if (this.selectedAttributes.has(attribute)) {
      this.selectedAttributes.delete(attribute);
    } else {
      this.selectedAttributes.add(attribute);
    }
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  addAttributeToFilter(attribute: string): void {
    this.selectedAttributes.add(attribute);
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  removeAttributeFromFilter(attribute: string): void {
    this.selectedAttributes.delete(attribute);
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  clearAllFilters(): void {
    this.selectedAttributes.clear();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  getSelectedAttributes(): Set<string> {
    return new Set(this.selectedAttributes);
  }

  hasActiveFilters(): boolean {
    return this.selectedAttributes.size > 0;
  }

  isAttributeSelected(attribute: string): boolean {
    return this.selectedAttributes.has(attribute);
  }
}
