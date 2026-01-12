module.exports = {
	testEnvironment: 'node',
	testMatch: ['**/__tests__/**/*.test.js'],
	collectCoverageFrom: ['lib/**/*.js', 'index.js'],
	coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
	verbose: true,
	// E2E tests need more time for network requests
	testTimeout: 60000,

	// Separate test runs - unit tests are fast, e2e are slow
	projects: [
		{
			displayName: 'unit',
			testMatch: ['**/__tests__/utils.test.js'],
			testEnvironment: 'node',
		},
		{
			displayName: 'e2e',
			testMatch: ['**/__tests__/e2e.test.js'],
			testEnvironment: 'node',
		},
	],
};

