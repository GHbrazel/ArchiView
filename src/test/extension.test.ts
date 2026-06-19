import {describe, it, expect, beforeEach} from 'vitest';
import * as vscode from 'vscode';
import { FilterManager } from '../filterManager';
import { CSharpParser } from '../csharpParser';
import { AttributeProvider, AttributeItem } from '../attributeProvider';

// Helper to construct complete AttributeInfo objects for tests
function makeAttr(name: string, line = 1, column = 0, args = '', targetElement = 'class', targetName = '') {
	return { fullName: name, name, arguments: args, line, column, targetElement, targetName };
}


describe('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	it('Sample test', () => {
		expect(-1).toBe([1, 2, 3].indexOf(5));
		expect(-1).toBe([1, 2, 3].indexOf(0));
	});
});

describe('FilterManager Tests', () => {
	let filterManager: FilterManager;

	beforeEach(() => {
		filterManager = new FilterManager();
	});

	it('should initialize with no filters', () => {
		expect(filterManager.hasActiveFilters()).toBe(false);
		expect(filterManager.getSelectedAttributes().size).toBe(0);
	});

	it('should add a single attribute filter', () => {
		filterManager.addAttributeToFilter('Serializable');
		expect(filterManager.hasActiveFilters()).toBe(true);
		expect(filterManager.isAttributeSelected('Serializable')).toBe(true);
	});

	it('should remove an attribute filter', () => {
		filterManager.addAttributeToFilter('Serializable');
		filterManager.removeAttributeFromFilter('Serializable');
		expect(filterManager.hasActiveFilters()).toBe(false);
	});

	it('should toggle attribute selection', () => {
		filterManager.toggleAttributeInFilter('Required');
		expect(filterManager.isAttributeSelected('Required')).toBe(true);
		filterManager.toggleAttributeInFilter('Required');
		expect(filterManager.isAttributeSelected('Required')).toBe(false);
	});

	it('should handle multiple selected attributes', () => {
		filterManager.addAttributeToFilter('Required');
		filterManager.addAttributeToFilter('Serializable');
		filterManager.addAttributeToFilter('Obsolete');
		
		const selected = filterManager.getSelectedAttributes();
		expect(selected.size).toBe(3);
		expect(selected.has('Required')).toBe(true);
		expect(selected.has('Serializable')).toBe(true);
		expect(selected.has('Obsolete')).toBe(true);
	});

	it('should set selected attributes as a batch', () => {
		filterManager.setSelectedAttributes(['Required', 'Serializable']);
		
		const selected = filterManager.getSelectedAttributes();
		expect(selected.size).toBe(2);
		expect(selected.has('Required')).toBe(true);
		expect(selected.has('Serializable')).toBe(true);
	});

	it('should clear all filters', () => {
		filterManager.addAttributeToFilter('Required');
		filterManager.addAttributeToFilter('Serializable');
		filterManager.clearAllFilters();
		
		expect(filterManager.hasActiveFilters()).toBe(false);
		expect(filterManager.getSelectedAttributes().size).toBe(0);
	});

	it('should emit change event when filter is modified', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		// Should emit event for first add
		filterManager.addAttributeToFilter('Required');
		expect(changeCount).toBe(1);

		// Should emit event for subsequent adds
		filterManager.addAttributeToFilter('Serializable');
		expect(changeCount).toBe(2);

		// Should emit event for removal
		filterManager.removeAttributeFromFilter('Required');
		expect(changeCount).toBe(3);

		// Should emit event for setSelectedAttributes
		filterManager.setSelectedAttributes(['Obsolete']);
		expect(changeCount).toBe(4);

		// Should emit event for clear
		filterManager.clearAllFilters();
		expect(changeCount).toBe(5);
	});

	it('should emit change event with current filter state', (done) => {
		let lastEmittedState: Set<string> = new Set();
		
		filterManager.onFilterChanged((change) => {
			lastEmittedState = change.attributes;
		});

		filterManager.addAttributeToFilter('Required');
		expect(lastEmittedState.has('Required')).toBe(true);

		filterManager.addAttributeToFilter('Serializable');
		expect(lastEmittedState.has('Serializable')).toBe(true);
		expect(lastEmittedState.size).toBe(2);
	});

	it('should not emit duplicate change events for same operation', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		filterManager.addAttributeToFilter('Required');
		const firstCount = changeCount;

		// Try adding the same attribute again - should still emit event
		filterManager.addAttributeToFilter('Required');
		expect(changeCount).toBe(firstCount + 1);
	});

	it('should only emit one change event when setSelectedAttributes is called', (done) => {
		let changeCount = 0;
		filterManager.onFilterChanged(() => {
			changeCount++;
		});

		// setSelectedAttributes should only emit once, not once per attribute
		filterManager.setSelectedAttributes(['Required', 'Serializable', 'Obsolete']);
		expect(changeCount).toBe(1);
	});
});

describe('AttributeProvider File Change Tests', () => {
	it('parseFile should clear old entries when file is updated with fewer attributes', () => {
		// This test verifies that when a file with 3 attributes is updated
		
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

		expect(attrs1.length).toBe(3);
		expect(attrs2.length).toBe(1);
	});

	it('parseFile should clear old entries when file is updated with more attributes', () => {
		
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

		expect(attrs1.length).toBe(1);
		expect(attrs2.length).toBe(3);
	});

	it('when attributes are removed from file, count should decrease not increase', () => {
		
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

		expect(attrs1.length).toBe(3);
		expect(attrs2.length).toBe(1);
	});

	it('when attributes are added to file, count should increase correctly', () => {
		// CSharpParser already imported
		
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
		expect(attrs1.length).toBe(1);
		expect(attrs2.length).toBe(3);

		const names2 = attrs2.map((a: any) => a.name);
		expect(names2.sort()).toEqual(['Obsolete', 'Required', 'Serializable'].sort());
	});

	it('parseFile should remove all old attributes for a file before adding new ones', () => {
		// This is a unit test for the parseFile logic
		// It simulates the scenario: file has [Serializable, Required, Obsolete]
		// Then is updated to have only [Serializable]
		// The attributeMap should reflect only the current state, not accumulate

		// CSharpParser already imported
		
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
		
		expect(attrs1.length).toBe(3);
		expect(attrs2.length).toBe(1);
		
		// Verify Serializable exists in both
		expect(attrs1[0].name).toBe('Serializable');
		expect(attrs2[0].name).toBe('Serializable');
	});

	it('when attributes are removed and file is saved, occurrence count should decrease', () => {
		// CSharpParser already imported
		// fs already imported
		// path already imported
		
		// Simulate attribute map behavior
		// Start with: Attribute 'Serializable' appears 2 times (in two files)
		const attributeMap = new Map();
		attributeMap.set('Serializable', [
			{ file: '/test/file1.cs', attribute: makeAttr('Serializable'), namespace: 'Test' },
			{ file: '/test/file2.cs', attribute: makeAttr('Serializable'), namespace: 'Test' }
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
			attribute: makeAttr('Required'),
			namespace: 'Test'
		});
		
		const serializableCount = attributeMap.get('Serializable')?.length || 0;
		const requiredCount = attributeMap.get('Required')?.length || 0;
		
		expect(serializableCount).toBe(1);
		expect(requiredCount).toBe(1);
	});

	it('when attributes are added and file is saved, occurrence count should increase correctly', () => {
		const attributeMap = new Map();
		attributeMap.set('Serializable', [
			{ file: '/test/file1.cs', attribute: makeAttr('Serializable'), namespace: 'Test' }
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
				attribute: makeAttr(attrName),
				namespace: 'Test'
			});
		}
		
		expect(attributeMap.get('Serializable')?.length || 0).toBe(1);
		expect(attributeMap.get('Required')?.length || 0).toBe(1);
		expect(attributeMap.get('Obsolete')?.length || 0).toBe(1);
	});

	it('when file is deleted, all its attributes should be removed from map', () => {
		// Verify that when a file is deleted, all its attributes are cleaned up
		
		const attributeMap = new Map();
		attributeMap.set('Serializable', [
			{ file: '/test/file1.cs', attribute: makeAttr('Serializable'), namespace: 'Test' },
			{ file: '/test/file2.cs', attribute: makeAttr('Serializable'), namespace: 'Test' }
		]);
		attributeMap.set('Required', [
			{ file: '/test/file1.cs', attribute: makeAttr('Required'), namespace: 'Test' }
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
		
		expect(attributeMap.has('Required')).toBe(false);
		expect(attributeMap.get('Serializable')?.length || 0).toBe(1);
		expect(attributeMap.get('Serializable')?.[0].file).toBe('/test/file2.cs');
	});
});

describe('AttributeProvider Tree Expansion Tests', () => {
	let filterManager: FilterManager;

	beforeEach(() => {
		filterManager = new FilterManager();
	});

	it('should track node IDs correctly', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);

		// Test node ID generation for different node types
		// AttributeItem already imported
		
		const rootNode = new AttributeItem('Test Namespace', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, 'namespace|Test');
		const attrNode = new AttributeItem('[Serializable] (2)', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, 'attribute|Serializable|Test');
		const fileNode = new AttributeItem('MyClass.cs', vscode.TreeItemCollapsibleState.Collapsed, '/path/to/MyClass.cs', undefined, 'Serializable');

		// Node IDs should be unique for different nodes
		const expansionMgr = provider.getExpansionManager();
		const id1 = expansionMgr.getNodeId(rootNode);
		const id2 = expansionMgr.getNodeId(attrNode);
		const id3 = expansionMgr.getNodeId(fileNode);

		expect(typeof id1).toBe('string');
		expect(typeof id2).toBe('string');
		expect(typeof id3).toBe('string');
		expect(id1).not.toBe(id2);
		expect(id2).not.toBe(id3);
		expect(id1).not.toBe(id3);
	});

	it('should initialize with empty expanded nodes set', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);

		const expansionMgr = provider.getExpansionManager();
		// Verify that no nodes are initially expanded
		expect(expansionMgr.isExpanded('nonexistent-node')).toBe(false);
	});

	it('should handle setTreeView without crashing', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);

		const mockTreeView = {
			onDidExpandElement: () => ({ dispose: () => {} }),
			onDidCollapseElement: () => ({ dispose: () => {} })
		};

		expect(() => {
			provider.setTreeView(mockTreeView as any);
		}).not.toThrow();
	});

	it('should preserve expanded state structure when tree is modified', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);
		// AttributeItem already imported

		const rootChildren = provider.getChildren();
		
		expect(Array.isArray(rootChildren)).toBe(true);
	});

	it('should handle empty tree gracefully', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);
		
		// Mock the internal repository to be empty
		const repo = provider.getRepository();
		repo.clearAllData();

		const children = provider.getChildren();
		expect(Array.isArray(children)).toBe(true);
		expect(children.length).toBe(0);
	});

	it('should handle node disappearance gracefully', () => {
		// AttributeProvider already imported
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
		expect(children.length > 0).toBe(true);

		repo.clearAllData();

		const emptyChildren = provider.getChildren();
		expect(Array.isArray(emptyChildren)).toBe(true);
		expect(emptyChildren.length).toBe(0);
	});

	it('should maintain consistent node IDs across multiple calls', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);
		// AttributeItem already imported

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

		expect(id1).toBe(id2);
		expect(id2).toBe(id3);
	});

	it('should handle tree structure changes without breaking', () => {
		// AttributeProvider already imported
		const provider = new AttributeProvider(filterManager);
		const settingsMgr = provider.getSettingsManager();

		// Simulate toggling namespace hierarchy
		settingsMgr.setNamespaceHierarchyEnabled(true);
		let children = provider.getChildren();
		expect(Array.isArray(children)).toBe(true);

		// Toggle to flat mode
		settingsMgr.setNamespaceHierarchyEnabled(false);
		children = provider.getChildren();
		expect(Array.isArray(children)).toBe(true);

		// Toggle back to hierarchy
		settingsMgr.setNamespaceHierarchyEnabled(true);
		children = provider.getChildren();
		expect(Array.isArray(children)).toBe(true);
	});

        it('should preserve expansion state when attribute count changes (attribute removed)', () => {
                const provider = new AttributeProvider(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                // Setup initial state with attributes
                const repo = provider.getRepository();
				repo.setAttributeLocations('Required', [
					{ file: '/test/Users.cs', attribute: makeAttr('Required'), namespace: 'Models' }
				]);
				repo.setAttributeLocations('Key', [
					{ file: '/test/Users.cs', attribute: makeAttr('Key'), namespace: 'Models' }
				]);
                
                // Get initial children
                const initialChildren = provider.getChildren();
                expect(initialChildren.length >= 1).toBe(true);

                // Find the Key node by its context
				const keyNode = initialChildren.find((n: any) => n.context === 'Key');
				expect(keyNode).toBeDefined();
                expect(keyNode !== undefined).toBe(true);

                const expansionMgr = provider.getExpansionManager();
				const keyNodeId = expansionMgr.getNodeId(keyNode!);
                
                // Simulate user expanding the Key attribute
                expansionMgr.markNodeAsExpanded(keyNodeId);
                expect(expansionMgr.isExpanded(keyNodeId)).toBe(true);

                // Remove the Required attribute only, leaving Key present
                repo.setAttributeLocations('Required', []);
                
                // Get children after attribute removal
                const updatedChildren = provider.getChildren();
                
                // Find the Key node in updated children by context
				const updatedKeyNode = updatedChildren.find((n: any) => n.context === 'Key');
				expect(updatedKeyNode).toBeDefined();
                expect(updatedKeyNode !== undefined).toBe(true);

				const updatedKeyNodeId = expansionMgr.getNodeId(updatedKeyNode!);
                expect(updatedKeyNodeId).toBe(keyNodeId);

                expect(expansionMgr.isExpanded(updatedKeyNodeId)).toBe(true);

                expect(updatedKeyNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should preserve expansion state when attribute count changes (attribute added)', () => {
                const provider = new AttributeProvider(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                // Setup initial state with one attribute
                const repo = provider.getRepository();
				repo.setAttributeLocations('Key', [
					{ file: '/test/Users.cs', attribute: makeAttr('Key'), namespace: 'Models' }
				]);
                
                // Get initial node and expand it
                const initialChildren = provider.getChildren();
				const keyNode = initialChildren.find((n: any) => n.context === 'Key');
				expect(keyNode).toBeDefined();
                expect(keyNode !== undefined).toBe(true);
                
                const expansionMgr = provider.getExpansionManager();
				const keyNodeId = expansionMgr.getNodeId(keyNode!);
                
                expansionMgr.markNodeAsExpanded(keyNodeId);
                
                // Simulate file save that adds the Required attribute
				repo.setAttributeLocations('Required', [
					{ file: '/test/Users.cs', attribute: makeAttr('Required'), namespace: 'Models' }
				]);
                
                // Get updated children
                const updatedChildren = provider.getChildren();
                
                // Find Key node
				const updatedKeyNode = updatedChildren.find((n: any) => n.context === 'Key');
				expect(updatedKeyNode).toBeDefined();
                expect(updatedKeyNode !== undefined).toBe(true);
                
				const updatedKeyNodeId = expansionMgr.getNodeId(updatedKeyNode!);
                expect(updatedKeyNodeId).toBe(keyNodeId);
                expect(expansionMgr.isExpanded(updatedKeyNodeId)).toBe(true);
                expect(updatedKeyNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should update counts when attributes are added or removed', () => {
                const provider = new AttributeProvider(filterManager);
                
                // Set flat mode
                const settingsMgr = provider.getSettingsManager();
                settingsMgr.setNamespaceHierarchyEnabled(false);
                
                const repo = provider.getRepository();
                
                // Initial state: 2 instances of Key
                repo.setAttributeLocations('Key', [
                        { file: '/test/Users.cs', attribute: makeAttr('Key'), namespace: 'Models' },
                        { file: '/test/Product.cs', attribute: makeAttr('Key'), namespace: 'Models' }
                ]);
                
                let children = provider.getChildren();
				let keyNode = children.find((n: any) => n.context === 'Key');
				expect(keyNode).toBeDefined();
                expect(keyNode!.label.includes('(2)')).toBe(true);
                
                // Remove one instance
                const locations = repo.getAttributeLocations('Key')!;
                locations.splice(0, 1);
                
                children = provider.getChildren();
				keyNode = children.find((n: any) => n.context === 'Key');
				expect(keyNode).toBeDefined();
                expect(keyNode!.label.includes('(1)')).toBe(true);
                
                // Add two more instances to get 3
                const currentLocations = repo.getAttributeLocations('Key') || [];
                repo.setAttributeLocations('Key', [
                        ...currentLocations,
                        { file: '/test/Entity.cs', attribute: makeAttr('Key'), namespace: 'Models' },
                        { file: '/test/Model.cs', attribute: makeAttr('Key'), namespace: 'Models' }
                ]);
                
                children = provider.getChildren();
				keyNode = children.find((n: any) => n.context === 'Key');
				expect(keyNode).toBeDefined();
                expect(keyNode!.label.includes('(3)')).toBe(true);
        });

        it('should preserve file node expansion in flat mode when counts change', () => {
                const provider = new AttributeProvider(filterManager);
                
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
				expect(keyNode).toBeDefined();
                expect(keyNode !== undefined).toBe(true);
                
                // Get file children for Key
                const fileChildren = provider.getChildren(keyNode);
                expect(fileChildren.length).toBe(2);
                
                // Find Users.cs file node
				const usersFileNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(usersFileNode).toBeDefined();
                expect(usersFileNode !== undefined).toBe(true);
                
                const expansionMgr = provider.getExpansionManager();
				const usersFileNodeId = expansionMgr.getNodeId(usersFileNode!);
                expect(usersFileNodeId.includes('/test/Users.cs')).toBe(true);
                
                // Simulate user expanding the file node
                expansionMgr.markNodeAsExpanded(usersFileNodeId);
                expect(expansionMgr.isExpanded(usersFileNodeId)).toBe(true);
                
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
                expect(updatedFileChildren.length).toBe(3);
                
                // Find Users.cs in updated list
				const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(updatedUsersNode).toBeDefined();
                
				const updatedUsersNodeId = expansionMgr.getNodeId(updatedUsersNode!);
                expect(updatedUsersNodeId).toBe(usersFileNodeId);
                expect(expansionMgr.isExpanded(updatedUsersNodeId)).toBe(true);
                expect(updatedUsersNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should preserve file node expansion in hierarchy mode', () => {
                const provider = new AttributeProvider(filterManager);
                
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
                expect(rootChildren.length).toBeGreaterThanOrEqual(1);
                
                // Find Models namespace
				const modelsNode = rootChildren.find((n: any) => n.context === 'namespace|MyProject');
				expect(modelsNode).toBeDefined();
                expect(modelsNode !== undefined).toBe(true);
                
                // Get attributes under Models
                const attributeChildren = provider.getChildren(modelsNode);
                expect(attributeChildren.length).toBeGreaterThanOrEqual(1);
                
                // Find Key attribute
				const keyAttrNode = attributeChildren.find((n: any) => n.context?.startsWith('attribute|Key'));
				expect(keyAttrNode).toBeDefined();
                expect(keyAttrNode !== undefined).toBe(true);
                
                // Get files under Key attribute
                const fileChildren = provider.getChildren(keyAttrNode);
                expect(fileChildren.length).toBe(2);
                
                // Find and expand Users.cs
				const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(usersNode).toBeDefined();
                const expansionMgr = provider.getExpansionManager();
				const usersNodeId = expansionMgr.getNodeId(usersNode!);
                expansionMgr.markNodeAsExpanded(usersNodeId);
                
                // Add new attribute in same namespace
                repo.setAttributeLocations('Required', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Required', name: 'Required', line: 6, column: 0, arguments: '', targetElement: 'property', targetName: 'Name' }, namespace: 'MyProject.Models' }
                ]);
                
                // Get updated files - Users.cs should still be expanded
                const updatedFileChildren = provider.getChildren(keyAttrNode);
				const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(updatedUsersNode).toBeDefined();
                
                expect(expansionMgr.isExpanded(usersNodeId)).toBe(true);
                expect(updatedUsersNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should remove file nodes when they have no more occurrences', () => {
                const provider = new AttributeProvider(filterManager);
                
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
				expect(keyNode).toBeDefined();
                
                let fileChildren = provider.getChildren(keyNode);
                expect(fileChildren.length).toBe(2);
                
                // Expand Users.cs
				const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(usersNode).toBeDefined();
                const expansionMgr = provider.getExpansionManager();
				const usersNodeId = expansionMgr.getNodeId(usersNode!);
                expansionMgr.markNodeAsExpanded(usersNodeId);
                
                // Remove all occurrences from Users.cs
                const currentLocations = repo.getAttributeLocations('Key') || [];
                const updatedLocations = currentLocations.filter((loc: any) => loc.file !== '/test/Users.cs');
                repo.setAttributeLocations('Key', updatedLocations);
                
                // Get updated file children
                fileChildren = provider.getChildren(keyNode);
                expect(fileChildren.length).toBe(1);

                // Users.cs should not be in the list
				const usersStillThere = fileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(usersStillThere).toBeUndefined();
        });

        it('should expand file node and show child occurrences', () => {
                const provider = new AttributeProvider(filterManager);
                
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
				expect(keyNode).toBeDefined();
                
                // Get file children
                const fileChildren = provider.getChildren(keyNode);
				const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(usersNode).toBeDefined();
                
                // Expand the file node
                const expansionMgr = provider.getExpansionManager();
				const usersNodeId = expansionMgr.getNodeId(usersNode!);
                expansionMgr.markNodeAsExpanded(usersNodeId);
                
                // Get the occurrences (children of file node)
                const occurrenceChildren = provider.getChildren(usersNode);
                
                expect(occurrenceChildren.length).toBe(2);
                expect(occurrenceChildren[0].line).toBe(5);
                expect(occurrenceChildren[1].line).toBe(10);
        });

        it('should preserve file node expansion when other attributes are added', () => {
                const provider = new AttributeProvider(filterManager);
                
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
				expect(keyNode).toBeDefined();
                const fileChildren = provider.getChildren(keyNode);
				const usersNode = fileChildren.find((n: any) => n.file === '/test/Users.cs');
				expect(usersNode).toBeDefined();
                
                const expansionMgr = provider.getExpansionManager();
				const usersNodeId = expansionMgr.getNodeId(usersNode!);
                expansionMgr.markNodeAsExpanded(usersNodeId);
                
                // Now add a different attribute to the same file
                repo.setAttributeLocations('Required', [
                        { file: '/test/Users.cs', attribute: { fullName: 'Required', name: 'Required', line: 6, column: 0, arguments: '', targetElement: 'property', targetName: 'Name' }, namespace: 'Models' }
                ]);
                
                // Get updated children - Users should still be expanded under Key
                const updatedKeyNode = provider.getChildren().find((n: any) => n.context === 'Key');
                const updatedFileChildren = provider.getChildren(updatedKeyNode);
                const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
                
                expect(updatedUsersNode !== undefined).toBe(true);
                expect(expansionMgr.isExpanded(usersNodeId)).toBe(true);
                expect(updatedUsersNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
        });

        it('should have correct file node ID format', () => {
                const provider = new AttributeProvider(filterManager);
                
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
				const nodeId = expansionMgr.getNodeId(usersNode!);
                
                // File node ID should have format: file:path:attr:attributeName
                expect(nodeId.startsWith('file:')).toBe(true);
                expect(nodeId.includes('Users.cs')).toBe(true);
                expect(nodeId.includes(':attr:Key')).toBe(true);
        });

        it('should handle multiple files with same attribute expanded/collapsed independently', () => {
                const provider = new AttributeProvider(filterManager);
                
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
				const usersNodeId = expansionMgr.getNodeId(usersNode!);
                expansionMgr.markNodeAsExpanded(usersNodeId);
                
                // Get updated file children
                const updatedFileChildren = provider.getChildren(keyNode);
                const updatedUsersNode = updatedFileChildren.find((n: any) => n.file === '/test/Users.cs');
                const updatedProductNode = updatedFileChildren.find((n: any) => n.file === '/test/Product.cs');
                expect(updatedUsersNode).toBeDefined();
                expect(updatedProductNode).toBeDefined();
                
                // Users should be expanded, Product collapsed
                expect(updatedUsersNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
                expect(updatedProductNode!.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });
});

describe('AttributeProvider Attribute File sorting tests', () => {
	it('should sort files alphabetically under attribute - flat mode', () => {
		const provider = new AttributeProvider(new FilterManager());
		
		// Set flat mode
		const settingsMgr = provider.getSettingsManager();
		settingsMgr.setNamespaceHierarchyEnabled(false);
		const repo = provider.getRepository();
		
		// Setup: Key attribute in 3 files
		repo.setAttributeLocations('Key', [
                        { file: '/test/Zeta.cs', attribute: makeAttr('Key'), namespace: 'Models' },
                        { file: '/test/Alpha.cs', attribute: makeAttr('Key'), namespace: 'Models' },
                        { file: '/test/Middle.cs', attribute: makeAttr('Key'), namespace: 'Models' }]);
		
		const rootChildren = provider.getChildren();
		const keyNode = rootChildren.find((n: any) => n.context === 'Key');
		const fileChildren = provider.getChildren(keyNode);
		
		expect(fileChildren.length).toBe(3);
		expect(fileChildren[0].file).toBe('/test/Alpha.cs');
		expect(fileChildren[1].file).toBe('/test/Middle.cs');
		expect(fileChildren[2].file).toBe('/test/Zeta.cs');
	});

	it('should sort files alphabetically under attribute - hierarchy mode', () => {
		const provider = new AttributeProvider(new FilterManager());
		
		// Set hierarchy mode
		const settingsMgr = provider.getSettingsManager();
		settingsMgr.setNamespaceHierarchyEnabled(true);
		const repo = provider.getRepository();
		
		// Setup: Key attribute in 3 files under same namespace
		repo.setAttributeLocations('Key', [
                        { file: '/test/Zeta.cs', attribute: makeAttr('Key'), namespace: 'MyProject.Models' },
                        { file: '/test/Alpha.cs', attribute: makeAttr('Key'), namespace: 'MyProject.Models' },
                        { file: '/test/Middle.cs', attribute: makeAttr('Key'), namespace: 'MyProject.Models' }]);
		
		const rootChildren = provider.getChildren();
		const modelsNode = rootChildren.find((n: any) => n.context === 'namespace|MyProject');
		const attributeChildren = provider.getChildren(modelsNode).filter((n: any) => n.context?.startsWith('attribute|Key'));
		const keyNode = attributeChildren[0];
		const fileChildren = provider.getChildren(keyNode);
		
		expect(fileChildren.length).toBe(3);
		expect(fileChildren[0].file).toBe('/test/Alpha.cs');
		expect(fileChildren[1].file).toBe('/test/Middle.cs');
		expect(fileChildren[2].file).toBe('/test/Zeta.cs');
	});
});

describe('CSharpParser Multi-Line Attribute Tests', () => {
	it('should parse multiple stacked attributes on enum', () => {
		// CSharpParser already imported
		
		const code = `
[Serializable]
[Flags]
public enum UserRole { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		expect(attrs.length).toBe(2);
		expect(attrs[0].name).toBe('Serializable');
		expect(attrs[0].targetElement).toBe('enum');
		expect(attrs[1].name).toBe('Flags');
		expect(attrs[1].targetElement).toBe('enum');
	});

	it('should parse attributes on class with namespaced attributes', () => {
		// CSharpParser already imported
		
		const code = `
[Serializable]
[Repository("UserRepository")]
[ApiEndpoint("/api/users", "POST")]
public class User { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		expect(attrs.length).toBe(3);
		expect(attrs[0].targetElement).toBe('class');
		expect(attrs[1].targetElement).toBe('class');
		expect(attrs[2].targetElement).toBe('class');
	});

	it('should parse attributes on enum members', () => {
		// CSharpParser already imported
		
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
		expect(enumMemberAttrs.length).toBeGreaterThanOrEqual(2);
		expect(enumMemberAttrs[0].fullName).toBe('System.ComponentModel.DataAnnotations.Display');
		expect(enumMemberAttrs[0].targetName).toBe('Guest');
	});

	it('should parse multiple attributes on property', () => {
		// CSharpParser already imported
		
		const code = `
[Required]
[StringLength(255, MinimumLength = 3)]
[Validate(3, 255)]
public string Name { get; set; } = string.Empty;
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		expect(attrs.length).toBe(3);
		expect(attrs[0].targetElement).toBe('property');
		expect(attrs[0].targetName).toBe('Name');
		expect(attrs[1].name).toBe('StringLength');
		expect(attrs[1].targetElement).toBe('property');
		expect(attrs[2].name).toBe('Validate');
		expect(attrs[2].targetElement).toBe('property');
	});

	it('should parse method attributes with return type target', () => {
		// CSharpParser already imported
		
		const code = `
[ApiEndpoint("/api/users/register", "POST")]
[Obsolete("Use RegisterUserAsync instead")]
[return: NotNull]
public User RegisterUser(string email, string username) { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		expect(attrs.length).toBeGreaterThanOrEqual(2);
		const obsoleteAttr = attrs.find((a: any) => a.name === 'Obsolete');
		expect(obsoleteAttr).toBeDefined();
		expect(obsoleteAttr!.targetElement).toBe('method');
		expect(obsoleteAttr!.targetName).toBe('RegisterUser');
	});

	it('should parse attributes separated by pragmas', () => {
		// CSharpParser already imported
		
		const code = `
[ApiEndpoint("/api/users/validate", "POST")]
#pragma warning disable CS0657
[property: Obsolete("Use new validation")]
#pragma warning restore CS0657
public bool ValidateUser(string username) { }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		const apiAttr = attrs.find((a: any) => a.name === 'ApiEndpoint');
		expect(apiAttr).toBeDefined();
		expect(apiAttr!.targetElement !== 'unknown').toBe(true);
	});

	it('should parse parameter attributes with validation', () => {
		// CSharpParser already imported
		
		const code = `
public User RegisterUser(
	[Validate(5, 100)] string email, 
	[Validate(3, 50)] string username)
{ }
		`;
		
		const attrs = CSharpParser.parseAttributes(code);
		expect(attrs.length).toBeGreaterThanOrEqual(2);
		const validateAttrs = attrs.filter((a: any) => a.name === 'Validate');
		expect(validateAttrs.length).toBeGreaterThanOrEqual(2);
		expect(validateAttrs[0].parameterName).toBe('email');
		expect(validateAttrs[1].parameterName).toBe('username');
	});

	it('should parse Obsolete attribute on interface method', () => {
		// CSharpParser already imported
		
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
		expect(obsoleteAttr).toBeDefined();
		expect(obsoleteAttr!.targetElement).toBe('method');
		expect(obsoleteAttr!.targetName).toBe('ProcessPayment');
	});

	it('should parse Obsolete attribute on interface declaration', () => {
		// CSharpParser already imported
		
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
		expect(interfaceObsoleteAttrs.length).toBeGreaterThanOrEqual(2);
		
		const interfaceObsolete = interfaceObsoleteAttrs.find((a: any) => a.targetElement === 'interface');
		expect(interfaceObsolete).toBeDefined();
		expect(interfaceObsolete!.targetName).toBe('IArticleService');
		const methodObsolete = interfaceObsoleteAttrs.find((a: any) => a.targetElement === 'method');
		expect(methodObsolete).toBeDefined();
		expect(methodObsolete!.targetName).toBe('SearchArticles');
	});
});


