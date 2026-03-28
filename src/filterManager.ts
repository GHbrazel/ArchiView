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

  /**
   * Toggle an attribute in the filter
   */
  toggleAttribute(attribute: string): void {
    if (this.selectedAttributes.has(attribute)) {
      this.selectedAttributes.delete(attribute);
    } else {
      this.selectedAttributes.add(attribute);
    }
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  /**
   * Add an attribute to the filter
   */
  addAttribute(attribute: string): void {
    this.selectedAttributes.add(attribute);
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  /**
   * Remove an attribute from the filter
   */
  removeAttribute(attribute: string): void {
    this.selectedAttributes.delete(attribute);
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.selectedAttributes.clear();
    this._onFilterChanged.fire(new Set(this.selectedAttributes));
  }

  /**
   * Get currently selected attributes
   */
  getSelectedAttributes(): Set<string> {
    return new Set(this.selectedAttributes);
  }

  /**
   * Check if any filters are active
   */
  hasFilters(): boolean {
    return this.selectedAttributes.size > 0;
  }

  /**
   * Check if a specific attribute is selected
   */
  isAttributeSelected(attribute: string): boolean {
    return this.selectedAttributes.has(attribute);
  }
}
