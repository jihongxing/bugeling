module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    '<rootDir>/miniprogram/utils/**/*.js',
    '<rootDir>/miniprogram/components/credit-badge/credit-badge.js',
    '<rootDir>/miniprogram/pages/activity/create/helpers.js',
    '<rootDir>/miniprogram/pages/activity/create/validate.js',
    '<rootDir>/miniprogram/pages/activity/detail/helpers.js',
    '<rootDir>/miniprogram/pages/activity/manage/helpers.js',
    '<rootDir>/miniprogram/pages/verify/scan/scan.js',
    '<rootDir>/scripts/cloudfunction-shared-template/**/*.js'
  ],
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  moduleNameMapper: {
    '^\\./_shared/(?!activityLifecycle$)(.*)$': '<rootDir>/scripts/cloudfunction-shared-template/$1',
    '^jsonwebtoken$': require.resolve('jsonwebtoken')
  }
}
