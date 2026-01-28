/**
 * Expo App Config
 *
 * Dynamic configuration that supports environment variables.
 * For EAS builds, set secrets via: eas secret:create --name HELIUS_API_KEY --value xxx
 */

const IS_DEV = process.env.APP_VARIANT === "development"

export default {
  expo: {
    name: IS_DEV ? "SIP Privacy (Dev)" : "SIP Privacy",
    slug: "sip-privacy",
    version: "0.1.4",
    scheme: "sipprotocol",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "org.sip-protocol.privacy",
      infoPlist: {
        UIBackgroundModes: ["fetch"],
      },
    },
    android: {
      versionCode: 5,
      package: "org.sip_protocol.privacy",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0A0A0A",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
      ],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-splash-screen",
      "expo-secure-store",
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "Allow SIP Privacy to use Face ID for secure authentication.",
        },
      ],
      ["expo-apple-authentication"],
      "expo-web-browser",
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            useLegacyPackaging: true,
            buildArchs: ["armeabi-v7a", "arm64-v8a"],
            enableMinifyInReleaseBuilds: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: "0e9edac4-13d5-4067-9b56-4da0f08d1f2a",
      },
      // RPC Configuration - Free tier API keys for default experience
      // These are embedded in the APK for best out-of-box experience
      // Users can override in Settings if they have their own keys
      rpcKeys: {
        helius: process.env.HELIUS_API_KEY || "142fb48a-aa24-4083-99c8-249df5400b30",
        quicknode: process.env.QUICKNODE_API_KEY || null,
        triton: process.env.TRITON_ENDPOINT || null,
      },
    },
    owner: "rector89",
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/0e9edac4-13d5-4067-9b56-4da0f08d1f2a",
    },
  },
}
