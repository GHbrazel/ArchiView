import { vi } from 'vitest';

// Mock the vscode module
vi.mock('vscode', () => ({
	TreeItemCollapsibleState: {
		None: 0,
		Collapsed: 1,
		Expanded: 2,
	},
	MarkdownString: class {
		value: string;
		isTrusted?: boolean;
		constructor(value: string, isTrusted?: boolean) {
			this.value = value;
			this.isTrusted = isTrusted;
		}
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, scheme: 'file' })),
	},
	Range: class {
		constructor(public start: any, public end: any) {}
	},
	Position: class {
		constructor(public line: number, public character: number) {}
	},
	TreeItem: class {
		label = '';
		collapsibleState = 0;
		constructor(label: string, collapsibleState?: number) {
			this.label = label;
			if (collapsibleState !== undefined) {
				this.collapsibleState = collapsibleState;
			}
		}
	},
	EventEmitter: class {
		_listeners: any[] = [];
		fire(event: any) {
			this._listeners.forEach(listener => listener(event));
		}
		get event() {
			const listeners = this._listeners;
			return (listener: any) => {
				listeners.push(listener);
				return { dispose: () => {} };
			};
		}
		get onDidChange() {
			return {
				fire: () => {},
				dispose: () => {},
			};
		}
	},
	window: {
		showInformationMessage: vi.fn(),
		createTreeView: vi.fn(),
	},
	commands: {
		registerCommand: vi.fn(),
	},
	workspace: {
		onDidChangeTextDocument: vi.fn(() => ({ dispose: () => {} })),
		onDidCreateFiles: vi.fn(() => ({ dispose: () => {} })),
		onDidDeleteFiles: vi.fn(() => ({ dispose: () => {} })),
		onDidChangeConfiguration: vi.fn(() => ({ dispose: () => {} })),
		getConfiguration: vi.fn((section) => ({
			get: vi.fn((key, defaultValue) => defaultValue),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: () => {} })),
			onDidChange: vi.fn(() => ({ dispose: () => {} })),
			onDidDelete: vi.fn(() => ({ dispose: () => {} })),
			dispose: () => {},
		})),
	},
	ExtensionContext: class {},
  }));
