module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'miniprogram/utils/**/*.js',
    'cloudfunctions/_shared/**/*.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  moduleNameMapper: {
    '^jsonwebtoken$': require.resolve('jsonwebtoken')
  }
}
