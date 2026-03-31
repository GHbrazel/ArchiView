// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AttributeProvider } from './attributeProvider';
import { FilterManager } from './filterManager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "MetaLens" is now active!');

	// Create filter manager
	const filterManager = new FilterManager();

	// Create and register the tree data provider for C# attributes
	const attributeProvider = new AttributeProvider(filterManager);
	vscode.window.registerTreeDataProvider('meta-lens-sidebar', attributeProvider);

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('MetaLens.refresh', () => {
		console.log('Refreshing attributes...');
		attributeProvider.refresh();
	});

	// Register toggle namespace hierarchy command
	const toggleCommand = vscode.commands.registerCommand('MetaLens.toggleNamespaceHierarchy', async () => {
		const config = vscode.workspace.getConfiguration('MetaLens');
		const currentState = config.get('showNamespaceHierarchy', true);
		
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

	// Register filter command to show filter UI
	const filterCommand = vscode.commands.registerCommand('MetaLens.showFilter', async () => {
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

	context.subscriptions.push(refreshCommand, toggleCommand, filterCommand);
	
	// Listen for filter changes and refresh tree
	context.subscriptions.push(
		filterManager.onFilterChanged(() => {
			attributeProvider.refresh();
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Your extension "MetaLens" is now inactive. Goodbye!');
}
