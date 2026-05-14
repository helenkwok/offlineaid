const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo's default Metro config currently includes `watcher.unstable_workerThreads`,
// but the Metro validator in this toolchain warns that it is unknown.
delete config.watcher.unstable_workerThreads;

// expo-sqlite's web worker imports wa-sqlite.wasm, so Metro needs to treat
// `.wasm` as an asset when bundling for web.
config.resolver.assetExts.push('wasm');

module.exports = config;
