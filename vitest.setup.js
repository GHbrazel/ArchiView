"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock the vscode module
vitest_1.vi.mock('vscode', () => ({
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2,
    },
    TreeItem: class {
        label = '';
        collapsibleState = 0;
        constructor(label, collapsibleState) {
            this.label = label;
            if (collapsibleState !== undefined) {
                this.collapsibleState = collapsibleState;
            }
        }
    },
    EventEmitter: class {
        _listeners = [];
        get onDidChange() {
            return {
                fire: () => { },
                dispose: () => { },
            };
        }
    },
    window: {
        showInformationMessage: vitest_1.vi.fn(),
        createTreeView: vitest_1.vi.fn(),
    },
    commands: {
        registerCommand: vitest_1.vi.fn(),
    },
    workspace: {
        onDidChangeTextDocument: vitest_1.vi.fn(() => ({ dispose: () => { } })),
        onDidCreateFiles: vitest_1.vi.fn(() => ({ dispose: () => { } })),
        onDidDeleteFiles: vitest_1.vi.fn(() => ({ dispose: () => { } })),
    },
    ExtensionContext: class {
    },
}), { virtual: true });
//# sourceMappingURL=vitest.setup.js.map