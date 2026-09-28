const { withAndroidManifest } = require("expo/config-plugins")

/**
 * Disables Android app backups.
 *
 * Two reasons, both hard requirements for a privacy wallet:
 *
 * 1. Security: app data (AsyncStorage settings, caches, database files) must
 *    never leak into device/cloud backups. The expo-secure-store backup-rule
 *    XML files only cover SecureStore keys — every other stored byte is
 *    backed up while allowBackup="true".
 *
 * 2. Determinism: on Google-APIs emulators/devices the GMS backup transport
 *    auto-restores data on reinstall, so `adb uninstall` does NOT produce a
 *    clean slate — persisted settings (e.g. hasCompletedOnboarding) survive
 *    and the app skips the onboarding carousel. This broke fresh-install E2E
 *    assumptions (welcome test landed on wallet-setup, 2026-09-28, #124).
 *
 * With allowBackup="false" the backup attributes referenced in the manifest
 * (fullBackupContent / dataExtractionRules) are simply ignored.
 */
const withNoAppBackup = (config) => {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0]
    application.$["android:allowBackup"] = "false"
    return config
  })
}

module.exports = withNoAppBackup
