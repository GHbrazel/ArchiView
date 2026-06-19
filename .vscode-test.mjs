import { defineConfig } from '@vscode/test-cli';

// Tests are run with Vitest, not vscode-test
// This configuration is kept for compatibility but doesn't run any tests
export default defineConfig({
	files: [],
});
