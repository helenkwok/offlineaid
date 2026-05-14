/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
  moduleNameMapper: {
    '^@/global\\.css$': '<rootDir>/jest.css-mock.js',
    '\\.(css)$': '<rootDir>/jest.css-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },
};
