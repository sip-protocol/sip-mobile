const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Configure resolver to use browser exports condition for jose
config.resolver.unstable_conditionNames = [
  "browser",
  "require",
  "react-native",
];

// Also configure the resolver to prefer browser field in package.json
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

module.exports = withNativeWind(config, { input: "./global.css" });
