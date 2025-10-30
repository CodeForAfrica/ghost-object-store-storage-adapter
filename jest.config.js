module.exports = {
  testEnvironment: 'node',
  verbose: true,
  collectCoverageFrom: [
    'index.js'
  ],
  coverageDirectory: 'coverage',
  testMatch: [
    '**/test/**/*.spec.js'
  ],
  setupFilesAfterEnv: ['jest-extended'],
  coverageReporters: ['text', 'lcov']
};
