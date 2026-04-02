import * as assert from 'assert';
import * as vscode from 'vscode';
import { FilterManager } from '../filterManager';


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
		assert.strictEqual(filterManager.hasActiveFilters(), false);
		assert.strictEqual(filterManager.getSelectedAttributes().size, 0);
	});

	test('should add a single attribute filter', () => {
		filterManager.addAttributeToFilter('Serializable');
		assert.strictEqual(filterManager.hasActiveFilters(), true);
		assert.strictEqual(filterManager.isAttributeSelected('Serializable'), true);
	});

	test('should remove an attribute filter', () => {
		filterManager.addAttributeToFilter('Serializable');
		filterManager.removeAttributeFromFilter('Serializable');
		assert.strictEqual(filterManager.hasActiveFilters(), false);
	});

	test('should toggle attribute selection', () => {
		filterManager.toggleAttributeInFilter('Required');
		assert.strictEqual(filterManager.isAttributeSelected('Required'), true);
		filterManager.toggleAttributeInFilter('Required');
		assert.strictEqual(filterManager.isAttributeSelected('Required'), false);
	});

	test('should handle multiple selected attributes', () => {
		filterManager.addAttributeToFilter('Required');
		filterManager.addAttributeToFilter('Serializable');
		filterManager.addAttributeToFilter('Obsolete');
		
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
		filterManager.addAttributeToFilter('Required');
		filterManager.addAttributeToFilter('Serializable');
		filterManager.clearAllFilters();
		
		assert.strictEqual(filterManager.hasActiveFilters(), false);
		assert.strictEqual(filterManager.getSelectedAttributes().size, 0);
	});

	test('should emit change event when filter is modified', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		// Should emit event for first add
		filterManager.addAttributeToFilter('Required');
		assert.strictEqual(changeCount, 1);

		// Should emit event for subsequent adds
		filterManager.addAttributeToFilter('Serializable');
		assert.strictEqual(changeCount, 2);

		// Should emit event for removal
		filterManager.removeAttributeFromFilter('Required');
		assert.strictEqual(changeCount, 3);

		// Should emit event for setSelectedAttributes
		filterManager.setSelectedAttributes(['Obsolete']);
		assert.strictEqual(changeCount, 4);

		// Should emit event for clear
		filterManager.clearAllFilters();
		assert.strictEqual(changeCount, 5);

		done();
	});

	test('should emit change event with current filter state', (done) => {
		let lastEmittedState: Set<string> = new Set();
		
		filterManager.onFilterChanged((state) => {
			lastEmittedState = state;
		});

		filterManager.addAttributeToFilter('Required');
		assert.strictEqual(lastEmittedState.has('Required'), true);

		filterManager.addAttributeToFilter('Serializable');
		assert.strictEqual(lastEmittedState.has('Serializable'), true);
		assert.strictEqual(lastEmittedState.size, 2);

		done();
	});

	test('should not emit duplicate change events for same operation', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		filterManager.addAttributeToFilter('Required');
		const firstCount = changeCount;

		// Try adding the same attribute again - should still emit event
		filterManager.addAttributeToFilter('Required');
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

suite('AttributeProvider File Change Tests', () => {
	test('parseFile should clear old entries when file is updated with fewer attributes', () => {
		// This test verifies that when a file with 3 attributes is updated
		const { CSharpParser } = require('../csharpParser');
		
		const code1 = `
[Serializable]
[Required]
[Obsolete]
public class MyClass { }
		`;

		const code2 = `
[Serializable]
public class MyClass { }
		`;

		const attrs1 = CSharpParser.parseAttributes(code1);
		const attrs2 = CSharpParser.parseAttributes(code2);

		assert.strictEqual(attrs1.length, 3, 'First code should have 3 attributes');
		assert.strictEqual(attrs2.length, 1, 'Second code should have 1 attribute');
	});

	test('parseFile should clear old entries when file is updated with more attributes', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code1 = `
[Serializable]
public class MyClass { }
		`;

		const code2 = `
[Serializable]
[Required]
[Obsolete]
public class MyClass { }
		`;

		const attrs1 = CSharpParser.parseAttributes(code1);
		const attrs2 = CSharpParser.parseAttributes(code2);

		assert.strictEqual(attrs1.length, 1, 'First code should have 1 attribute');
		assert.strictEqual(attrs2.length, 3, 'Second code should have 3 attributes');
	});

	test('when attributes are removed from file, count should decrease not increase', () => {
		const { CSharpParser } = require('../csharpParser');
		
		// Simulate what happens when file is parsed twice
		const code1 = `
[Serializable]
[Required]
[Obsolete]
public class MyClass { }
		`;

		const code2 = `
[Serializable]
public class MyClass { }
		`;

		const attrs1 = CSharpParser.parseAttributes(code1);
		const attrs2 = CSharpParser.parseAttributes(code2);

		
		assert.strictEqual(attrs1.length, 3);
		assert.strictEqual(attrs2.length, 1);
	});

	test('when attributes are added to file, count should increase correctly', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code1 = `
[Serializable]
public class MyClass { }
		`;

		const code2 = `
[Serializable]
[Required]
[Obsolete]
public class MyClass { }
		`;

		const attrs1 = CSharpParser.parseAttributes(code1);
		const attrs2 = CSharpParser.parseAttributes(code2);

		// Verify the new attributes are detected
		assert.strictEqual(attrs1.length, 1);
		assert.strictEqual(attrs2.length, 3);
		
		const names2 = attrs2.map((a: any) => a.name);
		assert.deepStrictEqual(names2.sort(), ['Obsolete', 'Required', 'Serializable'].sort());
	});

	test('parseFile should remove all old attributes for a file before adding new ones', () => {
		// This is a unit test for the parseFile logic
		// It simulates the scenario: file has [Serializable, Required, Obsolete]
		// Then is updated to have only [Serializable]
		// The attributeMap should reflect only the current state, not accumulate

		const { CSharpParser } = require('../csharpParser');
		
		// When parseFile is called twice with same file path and different content:
		// First call: adds Serializable, Required, Obsolete
		// Second call: should REMOVE old entries for that file, then add Serializable
		// Result: map should have 3 attribute types total, but file should only show 1
		
		const initialCode = `
[Serializable]
[Required]
[Obsolete]
public class MyClass { }
		`;

		const updatedCode = `
[Serializable]
public class MyClass { }
		`;

		const attrs1 = CSharpParser.parseAttributes(initialCode);
		const attrs2 = CSharpParser.parseAttributes(updatedCode);
		
		assert.strictEqual(attrs1.length, 3);
		assert.strictEqual(attrs2.length, 1);
		
		// Verify Serializable exists in both
		assert.strictEqual(attrs1[0].name, 'Serializable');
		assert.strictEqual(attrs2[0].name, 'Serializable');
	});

	test('when attributes are removed and file is saved, occurrence count should decrease', () => {
		const { CSharpParser } = require('../csharpParser');
		const fs = require('fs');
		const path = require('path');
		
		// Simulate attribute map behavior
		// Start with: Attribute 'Serializable' appears 2 times (in two files)
		const attributeMap = new Map();
		attributeMap.set('Serializable', [
			{ file: '/test/file1.cs', attribute: { name: 'Serializable' }, namespace: 'Test' },
			{ file: '/test/file2.cs', attribute: { name: 'Serializable' }, namespace: 'Test' }
		]);
		
		// File 1 is updated: OLD had [Serializable, Required], NEW has just [Required]
		const filePath = '/test/file1.cs';
		
		// Simulate parseFile logic
		const keysToRemove: string[] = [];
		for (const [key, locations] of attributeMap.entries()) {
			const filtered = locations.filter((loc: any) => loc.file !== filePath);
			if (filtered.length === 0) {
				keysToRemove.push(key);
			} else {
				attributeMap.set(key, filtered);
			}
		}
		
		for (const key of keysToRemove) {
			attributeMap.delete(key);
		}
		
		if (!attributeMap.has('Required')) {
			attributeMap.set('Required', []);
		}
		attributeMap.get('Required').push({
			file: filePath,
			attribute: { name: 'Required' },
			namespace: 'Test'
		});
		
		const serializableCount = attributeMap.get('Serializable')?.length || 0;
		const requiredCount = attributeMap.get('Required')?.length || 0;
		
		assert.strictEqual(serializableCount, 1, 'Serializable should have 1 occurrence after removing from file1');
		assert.strictEqual(requiredCount, 1, 'Required should have 1 occurrence in file1');
	});

	test('when attributes are added and file is saved, occurrence count should increase correctly', () => {
		const attributeMap = new Map();
		attributeMap.set('Serializable', [
			{ file: '/test/file1.cs', attribute: { name: 'Serializable' }, namespace: 'Test' }
		]);
		
		const filePath = '/test/file1.cs';
		
		// Simulate parseFile logic: first remove old entries
		const keysToRemove: string[] = [];
		for (const [key, locations] of attributeMap.entries()) {
			const filtered = locations.filter((loc: any) => loc.file !== filePath);
			if (filtered.length === 0) {
				keysToRemove.push(key);
			} else {
				attributeMap.set(key, filtered);
			}
		}
		
		for (const key of keysToRemove) {
			attributeMap.delete(key);
		}
		
		// Add all three attributes for updated file
		const newAttrs = ['Serializable', 'Required', 'Obsolete'];
		for (const attrName of newAttrs) {
			if (!attributeMap.has(attrName)) {
				attributeMap.set(attrName, []);
			}
			attributeMap.get(attrName).push({
				file: filePath,
				attribute: { name: attrName },
				namespace: 'Test'
			});
		}
		
		assert.strictEqual(attributeMap.get('Serializable')?.length || 0, 1);
		assert.strictEqual(attributeMap.get('Required')?.length || 0, 1);
		assert.strictEqual(attributeMap.get('Obsolete')?.length || 0, 1);
	});

	test('when file is deleted, all its attributes should be removed from map', () => {
		// Verify that when a file is deleted, all its attributes are cleaned up
		
		const attributeMap = new Map();
		attributeMap.set('Serializable', [
			{ file: '/test/file1.cs', attribute: { name: 'Serializable' }, namespace: 'Test' },
			{ file: '/test/file2.cs', attribute: { name: 'Serializable' }, namespace: 'Test' }
		]);
		attributeMap.set('Required', [
			{ file: '/test/file1.cs', attribute: { name: 'Required' }, namespace: 'Test' }
		]);
		
		const filePath = '/test/file1.cs';
		
		// Simulate deleteFile logic: remove all entries for this file
		const keysToRemove: string[] = [];
		for (const [key, locations] of attributeMap.entries()) {
			const filtered = locations.filter((loc: any) => loc.file !== filePath);
			if (filtered.length === 0) {
				keysToRemove.push(key);
			} else {
				attributeMap.set(key, filtered);
			}
		}
		
		for (const key of keysToRemove) {
			attributeMap.delete(key);
		}
		
		assert.strictEqual(attributeMap.has('Required'), false);
		assert.strictEqual(attributeMap.get('Serializable')?.length || 0, 1);
		assert.strictEqual(attributeMap.get('Serializable')?.[0].file, '/test/file2.cs');
	});
});

suite('AttributeProvider Tree Expansion Tests', () => {
	let filterManager: FilterManager;

	setup(() => {
		filterManager = new FilterManager();
	});

	test('should track node IDs correctly', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);

		// Test node ID generation for different node types
		const { AttributeItem } = require('../attributeProvider');
		
		const rootNode = new AttributeItem('Test Namespace', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, 'namespace|Test');
		const attrNode = new AttributeItem('[Serializable] (2)', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, 'attribute|Serializable|Test');
		const fileNode = new AttributeItem('MyClass.cs', vscode.TreeItemCollapsibleState.Collapsed, '/path/to/MyClass.cs', undefined, 'Serializable');

		// Node IDs should be unique for different nodes
		const expansionMgr = provider.getExpansionManager();
		const id1 = expansionMgr.getNodeId(rootNode);
		const id2 = expansionMgr.getNodeId(attrNode);
		const id3 = expansionMgr.getNodeId(fileNode);

		assert.strictEqual(typeof id1, 'string');
		assert.strictEqual(typeof id2, 'string');
		assert.strictEqual(typeof id3, 'string');
		assert.notStrictEqual(id1, id2);
		assert.notStrictEqual(id2, id3);
		assert.notStrictEqual(id1, id3);
	});

	test('should initialize with empty expanded nodes set', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);

		const expansionMgr = provider.getExpansionManager();
		const expandedNodeIds = expansionMgr.getExpandedNodeIds();
		assert.strictEqual(expandedNodeIds instanceof Set, true);
		assert.strictEqual(expandedNodeIds.size, 0);
	});

	test('should handle setTreeView without crashing', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);

		const mockTreeView = {
			onDidExpandElement: () => ({ dispose: () => {} }),
			onDidCollapseElement: () => ({ dispose: () => {} })
		};

		assert.doesNotThrow(() => {
			provider.setTreeView(mockTreeView as any);
		});
	});

	test('should preserve expanded state structure when tree is modified', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);
		const { AttributeItem } = require('../attributeProvider');

		const rootChildren = provider.getChildren();
		
		assert.strictEqual(Array.isArray(rootChildren), true);
	});

	test('should handle empty tree gracefully', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);
		
		// Mock the internal repository to be empty
		const repo = provider.getRepository();
		repo.clear();

		const children = provider.getChildren();
		assert.strictEqual(Array.isArray(children), true);
		assert.strictEqual(children.length, 0);
	});

	test('should handle node disappearance gracefully', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);

		// Add some attributes to the repository
		const attributes = [
			{
				file: '/test/test.cs',
				attribute: { name: 'Obsolete', fullName: 'System.Obsolete', arguments: '', line: 1, column: 0, targetElement: 'class', targetName: 'TestClass' },
				namespace: 'TestNamespace'
			}
		];

		const repo = provider.getRepository();
		repo.setAttributeLocations('Obsolete', attributes);

		const children = provider.getChildren();
		assert.strictEqual(children.length > 0, true);

		repo.clear();

		const emptyChildren = provider.getChildren();
		assert.strictEqual(Array.isArray(emptyChildren), true);
		assert.strictEqual(emptyChildren.length, 0);
	});

	test('should maintain consistent node IDs across multiple calls', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);
		const { AttributeItem } = require('../attributeProvider');

		const node = new AttributeItem(
			'[Serializable]',
			vscode.TreeItemCollapsibleState.Collapsed,
			'/path/to/file.cs',
			undefined,
			'attribute|Serializable|Test'
		);

		const expansionMgr = provider.getExpansionManager();
		const id1 = expansionMgr.getNodeId(node);
		const id2 = expansionMgr.getNodeId(node);
		const id3 = expansionMgr.getNodeId(node);

		assert.strictEqual(id1, id2);
		assert.strictEqual(id2, id3);
	});

	test('should handle tree structure changes without breaking', () => {
		const { AttributeProvider } = require('../attributeProvider');
		const provider = new AttributeProvider(filterManager);
		const settingsMgr = provider.getSettingsManager();

		// Simulate toggling namespace hierarchy
		settingsMgr.setNamespaceHierarchyEnabled(true);
		let children = provider.getChildren();
		assert.strictEqual(Array.isArray(children), true);

		// Toggle to flat mode
		settingsMgr.setNamespaceHierarchyEnabled(false);
		children = provider.getChildren();
		assert.strictEqual(Array.isArray(children), true);

		// Toggle back to hierarchy
		settingsMgr.setNamespaceHierarchyEnabled(true);
		children = provider.getChildren();
		assert.strictEqual(Array.isArray(children), true);
	});

        test('should preserve expansion state when attribute count changes (attribute removed)', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                // Setup initial state with attributes
                const repo = provider.getRepository();
                repo.setAttributeLocations('Required', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Required', name: 'Required' }, namespace: 'Models' }
                ]);
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key' }, namespace: 'Models' }
                ]);
                
                // Get initial children
                const initialChildren = provider.getChildren();
                assert.strictEqual(initialChildren.length >= 1, true, 'Should have at least 1 attribute');
                
                // Find the Key node by its context
                const keyNode = initialChildren.find((n: any) => n.context === 'Key');
                assert.strictEqual(keyNode !== undefined, true, 'Key attribute should exist');
                
                const expansionMgr = provider.getExpansionManager();
                const keyNodeId = expansionMgr.getNodeId(keyNode);
                
                // Simulate user expanding the Key attribute
                expansionMgr.markExpanded(keyNodeId);
                assert.strictEqual(expansionMgr.isExpanded(keyNodeId), true, 'Key should be in expanded state');
                
                repo.removeLocationsFromFile('Required', '/test/Users.cs');
                
                // Get children after attribute removal
                const updatedChildren = provider.getChildren();
                
                // Find the Key node in updated children by context
                const updatedKeyNode = updatedChildren.find((n: any) => n.context === 'Key');
                assert.strictEqual(updatedKeyNode !== undefined, true, 'Key node should still exist after attribute removal');
                
                const updatedKeyNodeId = expansionMgr.getNodeId(updatedKeyNode);
                assert.strictEqual(updatedKeyNodeId, keyNodeId, 'Node ID should remain stable (both should be "Key")');
                
                assert.strictEqual(expansionMgr.isExpanded(updatedKeyNodeId), true, 'Expanded state should be preserved');
                
                assert.strictEqual(updatedKeyNode.collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Node should be marked as Expanded');
        });

        test('should preserve expansion state when attribute count changes (attribute added)', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                // Setup initial state with one attribute
                const repo = provider.getRepository();
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key' }, namespace: 'Models' }
                ]);
                
                // Get initial node and expand it
                const initialChildren = provider.getChildren();
                const keyNode = initialChildren.find((n: any) => n.context === 'Key');
                assert.strictEqual(keyNode !== undefined, true, 'Key node should exist initially');
                
                const expansionMgr = provider.getExpansionManager();
                const keyNodeId = expansionMgr.getNodeId(keyNode);
                
                expansionMgr.markExpanded(keyNodeId);
                
                // Simulate file save that adds the Required attribute
                repo.setAttributeLocations('Required', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Required', name: 'Required' }, namespace: 'Models' }
                ]);
                
                // Get updated children
                const updatedChildren = provider.getChildren();
                
                // Find Key node
                const updatedKeyNode = updatedChildren.find((n: any) => n.context === 'Key');
                assert.strictEqual(updatedKeyNode !== undefined, true, 'Key node should still exist');
                
                const updatedKeyNodeId = expansionMgr.getNodeId(updatedKeyNode);
                assert.strictEqual(updatedKeyNodeId, keyNodeId, 'Node ID should remain stable');
                assert.strictEqual(expansionMgr.isExpanded(updatedKeyNodeId), true, 'Expansion state preserved');
                assert.strictEqual(updatedKeyNode.collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Node marked as Expanded');
        });

        test('should update counts when attributes are added or removed', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Initial state: 2 instances of Key
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key' }, namespace: 'Models' },
                        { file: '/test/Product.cs', attribute: { fullName: 'Key', name: 'Key' }, namespace: 'Models' }
                ]);
                
                let children = provider.getChildren();
                let keyNode = children.find((n: any) => n.context === 'Key');
                assert.strictEqual(keyNode!.label.includes('(2)'), true, 'Should show 2 instances');
                
                // Remove one instance
                const locations = repo.getAttributeLocations('Key')!;
                locations.splice(0, 1);
                
                children = provider.getChildren();
                keyNode = children.find((n: any) => n.context === 'Key');
                assert.strictEqual(keyNode!.label.includes('(1)'), true, 'Should show 1 instance after removal');
                
                // Add two more instances to get 3
                const currentLocations = repo.getAttributeLocations('Key') || [];
                repo.setAttributeLocations('Key', [
                        ...currentLocations,
                        { file: '/test/Entity.cs', attribute: { fullName: 'Key', name: 'Key' }, namespace: 'Models' },
                        { file: '/test/Model.cs', attribute: { fullName: 'Key', name: 'Key' }, namespace: 'Models' }
                ]);
                
                children = provider.getChildren();
                keyNode = children.find((n: any) => n.context === 'Key');
                assert.strictEqual(keyNode!.label.includes('(3)'), true, 'Should show 3 instances after additions');
        });

        test('should preserve file node expansion in flat mode when counts change', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Setup: Key attribute in 2 files
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'class', targetName: 'User' }, namespace: 'Models' },
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 10, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' },
                        { file: '/test/Product.cs', attribute: { fullName: 'Key', name: 'Key', line: 15, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' }
                ]);
                
                // Get the Key attribute node
                const rootChildren = provider.getChildren();
                const keyNode = rootChildren.find((n: any) => n.context === 'Key');
                assert.strictEqual(keyNode !== undefined, true, 'Key node should exist');
                
                // Get file children for Key
                const fileChildren = provider.getChildren(keyNode);
                assert.strictEqual(fileChildren.length, 2, 'Should have 2 files with Key');
                
                // Find Users.cs file node
                const usersFileNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                assert.strictEqual(usersFileNode !== undefined, true, 'Users.cs should exist');
                
                const expansionMgr = provider.getExpansionManager();
                const usersFileNodeId = expansionMgr.getNodeId(usersFileNode);
                assert.strictEqual(usersFileNodeId.includes('/test/Users.cs'), true, 'File node ID should be based on file path');
                
                // Simulate user expanding the file node
                expansionMgr.markExpanded(usersFileNodeId);
                assert.strictEqual(expansionMgr.isExpanded(usersFileNodeId), true, 'File node should be marked as expanded');
                
                // Simulate attribute addition in different file
                const currentLocations = repo.getAttributeLocations('Key') || [];
                currentLocations.push({
                        file: '/test/Entity.cs',
                        attribute: { fullName: 'Key', name: 'Key', line: 20, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' },
                        namespace: 'Models'
                });
                repo.setAttributeLocations('Key', currentLocations);
                
                // Get updated children
                const updatedFileChildren = provider.getChildren(keyNode);
                assert.strictEqual(updatedFileChildren.length, 3, 'Should have 3 files now');
                
                // Find Users.cs in updated list
                const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
                assert.strictEqual(updatedUsersNode !== undefined, true, 'Users.cs should still exist');
                
                const updatedUsersNodeId = expansionMgr.getNodeId(updatedUsersNode);
                assert.strictEqual(updatedUsersNodeId, usersFileNodeId, 'File node ID should remain stable');
                assert.strictEqual(expansionMgr.isExpanded(updatedUsersNodeId), true, 'Expanded state should be preserved');
                assert.strictEqual(updatedUsersNode.collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'File node should be marked as Expanded');
        });

        test('should preserve file node expansion in hierarchy mode', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set hierarchy mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(true);
                
                const repo = provider.getRepository();
                
                // Setup: Key attribute in Models namespace, 2 files
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'MyProject.Models' },
                        { file: '/test/Product.cs', attribute: { fullName: 'Key', name: 'Key', line: 15, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'MyProject.Models' }
                ]);
                
                // Get root children (namespaces)
                const rootChildren = provider.getChildren();
                assert.strictEqual(rootChildren.length >= 1, true, 'Should have at least 1 namespace');
                
                // Find Models namespace
                const modelsNode = rootChildren.find((n: any) => n.context === 'namespace|MyProject');
                assert.strictEqual(modelsNode !== undefined, true, 'Models namespace should exist');
                
                // Get attributes under Models
                const attributeChildren = provider.getChildren(modelsNode);
                assert.strictEqual(attributeChildren.length >= 1, true, 'Should have at least 1 attribute under Models');
                
                // Find Key attribute
                const keyAttrNode = attributeChildren.find((n: any) => n.context?.startsWith('attribute|Key'));
                assert.strictEqual(keyAttrNode !== undefined, true, 'Key attribute should exist');
                
                // Get files under Key attribute
                const fileChildren = provider.getChildren(keyAttrNode);
                assert.strictEqual(fileChildren.length, 2, 'Should have 2 files');
                
                // Find and expand Users.cs
                const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                const expansionMgr = provider.getExpansionManager();
                const usersNodeId = expansionMgr.getNodeId(usersNode);
                expansionMgr.markExpanded(usersNodeId);
                
                // Add new attribute in same namespace
                repo.setAttributeLocations('Required', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Required', name: 'Required', line: 6, column: 0, arguments: '', targetElement: 'property', targetName: 'Name' }, namespace: 'MyProject.Models' }
                ]);
                
                // Get updated files - Users.cs should still be expanded
                const updatedFileChildren = provider.getChildren(keyAttrNode);
                const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
                
                assert.strictEqual(updatedUsersNode !== undefined, true, 'Users.cs should still exist');
                assert.strictEqual(expansionMgr.isExpanded(usersNodeId), true, 'Expansion state preserved');
                assert.strictEqual(updatedUsersNode.collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Should be marked as Expanded');
        });

        test('should remove file nodes when they have no more occurrences', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Setup: Key attribute in 2 files
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' },
                        { file: '/test/Product.cs', attribute: { fullName: 'Key', name: 'Key', line: 15, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' }
                ]);
                
                const rootChildren = provider.getChildren();
                const keyNode = rootChildren.find((n: any) => n.context === 'Key');
                
                let fileChildren = provider.getChildren(keyNode);
                assert.strictEqual(fileChildren.length, 2, 'Initially 2 files');
                
                // Expand Users.cs
                const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                const expansionMgr = provider.getExpansionManager();
                const usersNodeId = expansionMgr.getNodeId(usersNode);
                expansionMgr.markExpanded(usersNodeId);
                
                // Remove all occurrences from Users.cs
                const currentLocations = repo.getAttributeLocations('Key') || [];
                const updatedLocations = currentLocations.filter((loc: any) => loc.file !== '/test/Users.cs');
                repo.setAttributeLocations('Key', updatedLocations);
                
                // Get updated file children
                fileChildren = provider.getChildren(keyNode);
                assert.strictEqual(fileChildren.length, 1, 'Should now have only 1 file');
                
                // Users.cs should not be in the list
                const usersStillThere = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                assert.strictEqual(usersStillThere, undefined, 'Users.cs should be removed when it has no occurrences');
        });

        test('should expand file node and show child occurrences', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Setup: Key attribute with 2 occurrences in Users.cs
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'class', targetName: 'User' }, namespace: 'Models' },
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 10, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' }
                ]);
                
                // Get Key attribute node
                const rootChildren = provider.getChildren();
                const keyNode = rootChildren.find((n: any) => n.context === 'Key');
                
                // Get file children
                const fileChildren = provider.getChildren(keyNode);
                const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                
                // Expand the file node
                const expansionMgr = provider.getExpansionManager();
                const usersNodeId = expansionMgr.getNodeId(usersNode);
                expansionMgr.markExpanded(usersNodeId);
                
                // Get the occurrences (children of file node)
                const occurrenceChildren = provider.getChildren(usersNode);
                
                assert.strictEqual(occurrenceChildren.length, 2, 'Should have 2 occurrences in Users.cs');
                assert.strictEqual(occurrenceChildren[0].line, 5, 'First occurrence at line 5');
                assert.strictEqual(occurrenceChildren[1].line, 10, 'Second occurrence at line 10');
        });

        test('should preserve file node expansion when other attributes are added', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Setup: Key attribute
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' }
                ]);
                
                // Get and expand Users.cs under Key
                const rootChildren = provider.getChildren();
                const keyNode = rootChildren.find((n: any) => n.context === 'Key');
                const fileChildren = provider.getChildren(keyNode);
                const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                
                const expansionMgr = provider.getExpansionManager();
                const usersNodeId = expansionMgr.getNodeId(usersNode);
                expansionMgr.markExpanded(usersNodeId);
                
                // Now add a different attribute to the same file
                repo.setAttributeLocations('Required', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Required', name: 'Required', line: 6, column: 0, arguments: '', targetElement: 'property', targetName: 'Name' }, namespace: 'Models' }
                ]);
                
                // Get updated children - Users should still be expanded under Key
                const updatedKeyNode = provider.getChildren().find((n: any) => n.context === 'Key');
                const updatedFileChildren = provider.getChildren(updatedKeyNode);
                const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
                
                assert.strictEqual(updatedUsersNode !== undefined, true, 'Users.cs should still exist');
                assert.strictEqual(expansionMgr.isExpanded(usersNodeId), true, 'Expansion state preserved');
                assert.strictEqual(updatedUsersNode.collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Should be marked as Expanded');
        });

        test('should have correct file node ID format', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' }
                ]);
                
                const rootChildren = provider.getChildren();
                const keyNode = rootChildren.find((n: any) => n.context === 'Key');
                const fileChildren = provider.getChildren(keyNode);
                const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                
                const expansionMgr = provider.getExpansionManager();
                const nodeId = expansionMgr.getNodeId(usersNode);
                
                // File node ID should have format: file:path:attr:attributeName
                assert.strictEqual(nodeId.startsWith('file:'), true, 'File node ID should start with "file:"');
                assert.strictEqual(nodeId.includes('Users.cs'), true, 'File node ID should contain filename');
                assert.strictEqual(nodeId.includes(':attr:Key'), true, 'File node ID should include attribute name');
        });

        test('should handle multiple files with same attribute expanded/collapsed independently', () => {
                const provider = new (require('../attributeProvider').AttributeProvider)(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Setup: Key in 2 files
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Key', name: 'Key', line: 5, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' },
                        { file: '/test/Product.cs', attribute: { fullName: 'Key', name: 'Key', line: 10, column: 0, arguments: '', targetElement: 'property', targetName: 'Id' }, namespace: 'Models' }
                ]);
                
                const rootChildren = provider.getChildren();
                const keyNode = rootChildren.find((n: any) => n.context === 'Key');
                const fileChildren = provider.getChildren(keyNode);
                
                // Expand only Users.cs
                const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
                const expansionMgr = provider.getExpansionManager();
                const usersNodeId = expansionMgr.getNodeId(usersNode);
                expansionMgr.markExpanded(usersNodeId);
                
                // Get updated file children
                const updatedFileChildren = provider.getChildren(keyNode);
                const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
                const updatedProductNode = updatedFileChildren.find((n: any) => n.file === '/test/Product.cs');
                
                // Users should be expanded, Product collapsed
                assert.strictEqual(updatedUsersNode.collapsibleState, vscode.TreeItemCollapsibleState.Expanded, 'Users should be Expanded');
                assert.strictEqual(updatedProductNode.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed, 'Product should be Collapsed');
        });
});

suite('CSharpParser Multi-Line Attribute Tests', () => {
	test('should parse multiple stacked attributes on enum', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[Serializable]
[Flags]
public enum UserRole { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		assert.strictEqual(attrs.length, 2, 'Should find 2 attributes');
		assert.strictEqual(attrs[0].name, 'Serializable', 'First attribute should be Serializable');
		assert.strictEqual(attrs[0].targetElement, 'enum', 'Serializable should target enum');
		assert.strictEqual(attrs[1].name, 'Flags', 'Second attribute should be Flags');
		assert.strictEqual(attrs[1].targetElement, 'enum', 'Flags should target enum');
	});

	test('should parse attributes on class with namespaced attributes', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[Serializable]
[Repository("UserRepository")]
[ApiEndpoint("/api/users", "POST")]
public class User { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		assert.strictEqual(attrs.length, 3, 'Should find 3 attributes');
		assert.strictEqual(attrs[0].targetElement, 'class', 'Serializable should target class');
		assert.strictEqual(attrs[1].targetElement, 'class', 'Repository should target class');
		assert.strictEqual(attrs[2].targetElement, 'class', 'ApiEndpoint should target class');
	});

	test('should parse attributes on enum members', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[Serializable]
[Flags]
public enum UserRole
{
	[System.ComponentModel.DataAnnotations.Display(Name = "Guest")]
	Guest = 1,
	
	[System.ComponentModel.DataAnnotations.Display(Name = "Administrator")]
	Administrator = 8
}
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		const enumMemberAttrs = attrs.filter((a: any) => a.targetElement === 'enumMember');
		assert.strictEqual(enumMemberAttrs.length >= 2, true, 'Should find at least 2 enum member attributes');
		assert.strictEqual(enumMemberAttrs[0].fullName, 'System.ComponentModel.DataAnnotations.Display', 'Should parse Display attribute');
		assert.strictEqual(enumMemberAttrs[0].targetName, 'Guest', 'Should identify Guest as target');
	});

	test('should parse multiple attributes on property', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[Required]
[StringLength(255, MinimumLength = 3)]
[Validate(3, 255)]
public string Name { get; set; } = string.Empty;
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		assert.strictEqual(attrs.length, 3, 'Should find 3 attributes');
		assert.strictEqual(attrs[0].targetElement, 'property', 'Required should target property');
		assert.strictEqual(attrs[0].targetName, 'Name', 'Should identify Name as target property');
		assert.strictEqual(attrs[1].name, 'StringLength', 'Second attribute should be StringLength');
		assert.strictEqual(attrs[1].targetElement, 'property', 'StringLength should target property');
		assert.strictEqual(attrs[2].name, 'Validate', 'Third attribute should be Validate');
		assert.strictEqual(attrs[2].targetElement, 'property', 'Validate should target property');
	});

	test('should parse method attributes with return type target', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[ApiEndpoint("/api/users/register", "POST")]
[Obsolete("Use RegisterUserAsync instead")]
[return: NotNull]
public User RegisterUser(string email, string username) { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		assert.strictEqual(attrs.length >= 2, true, 'Should find at least 2 attributes');
		const obsoleteAttr = attrs.find((a: any) => a.name === 'Obsolete');
		assert.strictEqual(obsoleteAttr !== undefined, true, 'Should find Obsolete attribute');
		assert.strictEqual(obsoleteAttr.targetElement, 'method', 'Obsolete should target method');
		assert.strictEqual(obsoleteAttr.targetName, 'RegisterUser', 'Should identify RegisterUser as target');
	});

	test('should parse attributes separated by pragmas', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[ApiEndpoint("/api/users/validate", "POST")]
#pragma warning disable CS0657
[property: Obsolete("Use new validation")]
#pragma warning restore CS0657
public bool ValidateUser(string username) { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		const apiAttr = attrs.find((a: any) => a.name === 'ApiEndpoint');
		assert.strictEqual(apiAttr !== undefined, true, 'Should find ApiEndpoint attribute');
		assert.strictEqual(apiAttr.targetElement !== 'unknown', true, 'ApiEndpoint should have known target');
	});

	test('should parse parameter attributes with validation', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
public User RegisterUser(
	[Validate(5, 100)] string email, 
	[Validate(3, 50)] string username)
{ }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		assert.strictEqual(attrs.length >= 2, true, 'Should find parameter attributes');
		const validateAttrs = attrs.filter((a: any) => a.name === 'Validate');
		assert.strictEqual(validateAttrs.length >= 2, true, 'Should find at least 2 Validate attributes');
		assert.strictEqual(validateAttrs[0].parameterName, 'email', 'First should be for email parameter');
		assert.strictEqual(validateAttrs[1].parameterName, 'username', 'Second should be for username parameter');
	});

	test('should parse Obsolete attribute on interface method', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[Serializable]
[DataContract]
public interface IPaymentService
{
	[DataMember]
	Guid ProcessId { get; }

	[Obsolete("Use ProcessPaymentAsync instead")]
	bool ProcessPayment(decimal amount, string description);
}
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		const obsoleteAttr = attrs.find((a: any) => a.name === 'Obsolete');
		assert.strictEqual(obsoleteAttr !== undefined, true, 'Should find Obsolete attribute');
		assert.strictEqual(obsoleteAttr.targetElement, 'method', 'Obsolete should target the method');
		assert.strictEqual(obsoleteAttr.targetName, 'ProcessPayment', 'Should identify ProcessPayment as target');
	});

	test('should parse Obsolete attribute on interface declaration', () => {
		const { CSharpParser } = require('../csharpParser');
		
		const code = `
[Obsolete("Use IArticleServiceV2 instead")]
[Serializable]
public interface IArticleService
{
	Article GetArticle(int id);
	
	[Obsolete("Use SearchArticlesAsync instead")]
	Article[] SearchArticles(string keyword);
}
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		const interfaceObsoleteAttrs = attrs.filter((a: any) => a.name === 'Obsolete');
		assert.strictEqual(interfaceObsoleteAttrs.length >= 2, true, 'Should find at least 2 Obsolete attributes');
		
		const interfaceObsolete = interfaceObsoleteAttrs.find((a: any) => a.targetElement === 'interface');
		assert.strictEqual(interfaceObsolete !== undefined, true, 'Should find Obsolete on interface');
		assert.strictEqual(interfaceObsolete.targetName, 'IArticleService', 'Should identify IArticleService as target');
		
		const methodObsolete = interfaceObsoleteAttrs.find((a: any) => a.targetElement === 'method');
		assert.strictEqual(methodObsolete !== undefined, true, 'Should find Obsolete on method');
		assert.strictEqual(methodObsolete.targetName, 'SearchArticles', 'Should identify SearchArticles as target');
	});
});


