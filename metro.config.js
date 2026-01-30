const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Configure resolver to use browser exports condition for jose
config.resolver.unstable_conditionNames = [
  "browser",
  "require",
  "react-native",
];

// Enable package exports to fix @noble/hashes resolution warnings
config.resolver.unstable_enablePackageExports = true;

// Also configure the resolver to prefer browser field in package.json
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// Performance optimizations
config.transformer.minifierConfig = {
  keep_classnames: false,
  keep_fnames: false,
  mangle: {
    keep_classnames: false,
    keep_fnames: false,
  },
  output: {
    ascii_only: true,
    quote_style: 3,
    wrap_iife: true,
  },
  sourceMap: {
    includeSources: false,
  },
  toplevel: false,
  compress: {
    reduce_funcs: false,
  },
};

// Enable inline requires for faster startup
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = withNativeWind(config, { input: "./global.css" });
