/**
 * Expo App Config
 *
 * Dynamic configuration that supports environment variables.
 * For EAS builds, set secrets via: eas secret:create --name EXPO_PUBLIC_SIP_MOBILE_HELIUS_API_KEY --value xxx
 */

const IS_DEV = process.env.APP_VARIANT === "development"

export default {
  expo: {
    name: IS_DEV ? "SIP Privacy (Dev)" : "SIP Privacy",
    slug: "sip-privacy",
    version: "0.2.3",
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
        UIBackgroundModes: ["fetch", "remote-notification"],
        NSCameraUsageDescription: "SIP Privacy uses the camera to scan QR codes for receiving payments.",
        NSFaceIDUsageDescription: "Allow SIP Privacy to use Face ID for secure authentication.",
      },
    },
    android: {
      versionCode: 14,
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
        "android.permission.CAMERA",
        "android.permission.VIBRATE",
      ],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "./plugins/withKotlinJvmTarget",
      "./plugins/withBlockedPermissions",
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
        "expo-camera",
        {
          cameraPermission: "SIP Privacy uses the camera to scan QR codes for receiving payments.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#8b5cf6",
          sounds: [],
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            useLegacyPackaging: true,
            buildArchs: ["armeabi-v7a", "arm64-v8a"],
            enableMinifyInReleaseBuilds: true,
            // Solana Mobile SDK Maven repository for Seed Vault
            extraMavenRepos: ["https://maven.solanamobile.com/releases"],
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
      // RPC Configuration - API keys from environment variables
      // For local dev: set in .env.local
      // For EAS builds: eas secret:create --name EXPO_PUBLIC_SIP_MOBILE_HELIUS_API_KEY --value xxx
      // Users can override in Settings if they have their own keys
      rpcKeys: {
        helius: process.env.EXPO_PUBLIC_SIP_MOBILE_HELIUS_API_KEY || null,
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
