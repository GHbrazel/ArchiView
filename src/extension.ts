import * as vscode from 'vscode';
import { AttributeProvider } from './attributeProvider';
import { FilterManager } from './filterManager';

export function activate(context: vscode.ExtensionContext) {
	const filterManager = new FilterManager();

	const attributeProvider = new AttributeProvider(filterManager);
	const treeView = vscode.window.createTreeView('meta-lens-sidebar', {
		treeDataProvider: attributeProvider,
		showCollapseAll: true
	});

	attributeProvider.setTreeView(treeView);

	const refreshCommand = registerRefresh(attributeProvider);

	const toggleCommand = registerToggleNamespaceHierarchy();

	const filterCommand = registerShowFilter(attributeProvider, filterManager);

	context.subscriptions.push(refreshCommand, toggleCommand, filterCommand);
	
	// Listen for filter changes and refresh tree
	context.subscriptions.push(
		filterManager.onFilterChanged(() => {
			attributeProvider.refresh();
		})
	);
}

function registerShowFilter(attributeProvider: AttributeProvider, filterManager: FilterManager) {
	return vscode.commands.registerCommand('MetaLens.showFilter', async () => {
		const allAttributes = attributeProvider.getAllAttributeNames();
		const currentFilters = filterManager.getSelectedAttributes();

		// Show quick pick with checkboxes for attribute filtering
		const options = Array.from(allAttributes).map(attr => ({
			label: attr,
			picked: currentFilters.has(attr),
			attribute: attr
		}));

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select attributes to show (none = show all)',
			canPickMany: true,
			matchOnDescription: true,
			matchOnDetail: true
		});

		if (selected !== undefined) {
			const selectedAttrs = selected.map(s => s.attribute);
			// setSelectedAttributes() will fire onFilterChanged event which triggers refresh
			// Do NOT call refresh() here or it will cause double-parsing
			filterManager.setSelectedAttributes(selectedAttrs);
		}
	});
}

function registerToggleNamespaceHierarchy() {
	return vscode.commands.registerCommand('MetaLens.toggleNamespaceHierarchy', async () => {
		const config = vscode.workspace.getConfiguration('MetaLens');
		const currentState = config.get('showNamespaceHierarchy', false);

		const options = [
			{
				label: currentState ? '✓ Show Namespace Hierarchy' : 'Show Namespace Hierarchy',
				value: true
			},
			{
				label: !currentState ? '✓ Flat File List' : 'Flat File List',
				value: false
			}
		];

		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'View Mode Options'
		});

		if (selected !== undefined && selected.value !== currentState) {
			await config.update('showNamespaceHierarchy', selected.value, vscode.ConfigurationTarget.Global);
			console.log(`View mode switched to ${selected.value ? 'hierarchical' : 'flat'}`);
		}
	});
}

function registerRefresh(attributeProvider: AttributeProvider) {
	return vscode.commands.registerCommand('MetaLens.refresh', () => {
		console.log('Refreshing attributes...');
		attributeProvider.refresh();
	});
}

export function deactivate() {
	console.log('Your extension "MetaLens" is now inactive. Goodbye!');
}
