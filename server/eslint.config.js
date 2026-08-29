// eslint 9 flat config. Same small, high-signal rule set as client/ -- see the
// note there on why this is not `recommended`.

const nodeGlobals = {
    require: 'readonly',
    module: 'writable',
    exports: 'writable',
    process: 'readonly',
    console: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    Buffer: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    setImmediate: 'readonly',
    URL: 'readonly',
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
};

const rules = {
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
};

module.exports = [
    {
        ignores: ['node_modules/**', 'coverage/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: nodeGlobals,
        },
        rules,
    },
    {
        files: ['__tests__/**/*.js'],
        languageOptions: {
            globals: { ...nodeGlobals, ...jestGlobals },
        },
    },
];
