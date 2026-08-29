// Used only by jest. Webpack consumes src/ as ES modules directly and does not
// read this file, so transpiling to CommonJS here does not affect the bundle.
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
    ],
};
