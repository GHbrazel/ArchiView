// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AttributeProvider } from './attributeProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ArchiView" is now active!');

	// Create and register the tree data provider for C# attributes
	const attributeProvider = new AttributeProvider();
	vscode.window.registerTreeDataProvider('archi-view-sidebar', attributeProvider);

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('ArchiView.refresh', () => {
		console.log('Refreshing attributes...');
		attributeProvider.refresh();
	});

	// Register toggle namespace hierarchy command
	const toggleCommand = vscode.commands.registerCommand('ArchiView.toggleNamespaceHierarchy', async () => {
		const config = vscode.workspace.getConfiguration('ArchiView');
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

	// Register main command
	const disposable = vscode.commands.registerCommand('ArchiView', () => {
		// The code you place here will be executed every time your command is executed
		vscode.commands.executeCommand('archi-view-sidebar.focus');
	});

	context.subscriptions.push(disposable, refreshCommand, toggleCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Your extension "ArchiView" is now inactive. Goodbye!');
}
