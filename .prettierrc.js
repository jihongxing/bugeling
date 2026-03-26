module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.wxml',
      options: {
        parser: 'html'
      }
    },
    {
      files: '*.wxss',
      options: {
        parser: 'css'
      }
    }
  ]
}
