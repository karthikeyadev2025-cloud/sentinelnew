// jest.config.js – basic configuration for a Next.js TypeScript project
module.exports = {
  // Use ts-jest to compile TypeScript files
  preset: "ts-jest",
  testEnvironment: "jsdom",
  // Look for test files with .test.ts/.test.tsx or .spec.ts/.spec.tsx extensions
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
  // Transform JSX/TSX using ts-jest
  transform: {
    "^.+\\.[tj]sx?$": "ts-jest",
  },
  // Module name mapper to handle CSS imports in Next.js
  moduleNameMapper: {
    "\\.(css|scss|sass)$": "identity-obj-proxy",
  },
  // Setup files for React Testing Library (optional but helpful)
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Collect coverage (optional)
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
