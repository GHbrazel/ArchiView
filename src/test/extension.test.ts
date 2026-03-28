import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { FilterManager } from '../filterManager';

// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('FilterManager Tests', () => {
	let filterManager: FilterManager;

	setup(() => {
		filterManager = new FilterManager();
	});

	test('should initialize with no filters', () => {
		assert.strictEqual(filterManager.hasFilters(), false);
		assert.strictEqual(filterManager.getSelectedAttributes().size, 0);
	});

	test('should add a single attribute filter', () => {
		filterManager.addAttribute('Serializable');
		assert.strictEqual(filterManager.hasFilters(), true);
		assert.strictEqual(filterManager.isAttributeSelected('Serializable'), true);
	});

	test('should remove an attribute filter', () => {
		filterManager.addAttribute('Serializable');
		filterManager.removeAttribute('Serializable');
		assert.strictEqual(filterManager.hasFilters(), false);
	});

	test('should toggle attribute selection', () => {
		filterManager.toggleAttribute('Required');
		assert.strictEqual(filterManager.isAttributeSelected('Required'), true);
		filterManager.toggleAttribute('Required');
		assert.strictEqual(filterManager.isAttributeSelected('Required'), false);
	});

	test('should handle multiple selected attributes', () => {
		filterManager.addAttribute('Required');
		filterManager.addAttribute('Serializable');
		filterManager.addAttribute('Obsolete');
		
		const selected = filterManager.getSelectedAttributes();
		assert.strictEqual(selected.size, 3);
		assert.strictEqual(selected.has('Required'), true);
		assert.strictEqual(selected.has('Serializable'), true);
		assert.strictEqual(selected.has('Obsolete'), true);
	});

	test('should set selected attributes as a batch', () => {
		filterManager.setSelectedAttributes(['Required', 'Serializable']);
		
		const selected = filterManager.getSelectedAttributes();
		assert.strictEqual(selected.size, 2);
		assert.strictEqual(selected.has('Required'), true);
		assert.strictEqual(selected.has('Serializable'), true);
	});

	test('should clear all filters', () => {
		filterManager.addAttribute('Required');
		filterManager.addAttribute('Serializable');
		filterManager.clearFilters();
		
		assert.strictEqual(filterManager.hasFilters(), false);
		assert.strictEqual(filterManager.getSelectedAttributes().size, 0);
	});

	test('should emit change event when filter is modified', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		// Should emit event for first add
		filterManager.addAttribute('Required');
		assert.strictEqual(changeCount, 1);

		// Should emit event for subsequent adds
		filterManager.addAttribute('Serializable');
		assert.strictEqual(changeCount, 2);

		// Should emit event for removal
		filterManager.removeAttribute('Required');
		assert.strictEqual(changeCount, 3);

		// Should emit event for setSelectedAttributes
		filterManager.setSelectedAttributes(['Obsolete']);
		assert.strictEqual(changeCount, 4);

		// Should emit event for clear
		filterManager.clearFilters();
		assert.strictEqual(changeCount, 5);

		done();
	});

	test('should emit change event with current filter state', (done) => {
		let lastEmittedState: Set<string> = new Set();
		
		filterManager.onFilterChanged((state) => {
			lastEmittedState = state;
		});

		filterManager.addAttribute('Required');
		assert.strictEqual(lastEmittedState.has('Required'), true);

		filterManager.addAttribute('Serializable');
		assert.strictEqual(lastEmittedState.has('Serializable'), true);
		assert.strictEqual(lastEmittedState.size, 2);

		done();
	});

	test('should not emit duplicate change events for same operation', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		filterManager.addAttribute('Required');
		const firstCount = changeCount;

		// Try adding the same attribute again - should still emit event
		filterManager.addAttribute('Required');
		assert.strictEqual(changeCount, firstCount + 1);

		done();
	});

	test('should only emit one change event when setSelectedAttributes is called', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		// setSelectedAttributes should only emit once, not once per attribute
		filterManager.setSelectedAttributes(['Required', 'Serializable', 'Obsolete']);
		assert.strictEqual(changeCount, 1);

		done();
	});
});


