// eslint 9 flat config. Deliberately a small, high-signal rule set rather than
// `recommended`: this is a codebase that has never been linted, and a wall of
// stylistic warnings would just get ignored. The rules here are the ones that
// catch real bugs -- undefined identifiers, unreachable code, accidental
// globals. Tighten over time.

const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    console: 'readonly',
    fetch: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    requestAnimationFrame: 'readonly',
    localStorage: 'readonly',
    AbortSignal: 'readonly',
    Image: 'readonly',
    HTMLElement: 'readonly',
    screen: 'readonly',
    location: 'readonly',
    performance: 'readonly',
};

const jestGlobals = {
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    jest: 'readonly',
    global: 'readonly',
    setImmediate: 'readonly',
};

module.exports = [
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: browserGlobals,
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-duplicate-case': 'error',
            'no-self-assign': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            eqeqeq: ['warn', 'smart'],
        },
    },
    {
        files: ['test/**/*.js', 'jest.config.js', 'babel.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...browserGlobals, ...jestGlobals, module: 'writable', require: 'readonly' },
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none' }],
        },
    },
];
