const { withAndroidManifest } = require('expo/config-plugins')

/**
 * Config plugin to block unnecessary Android permissions.
 *
 * Uses tools:node="remove" so the Android manifest merger strips these
 * even when dependencies (expo-camera, expo-notifications, RN) re-add them.
 */
const BLOCKED_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
]

function withBlockedPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest

    // Ensure xmlns:tools is declared
    if (!manifest.$) manifest.$ = {}
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'

    // Remove any existing entries for blocked permissions
    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (perm) => !BLOCKED_PERMISSIONS.includes(perm.$?.['android:name'])
      )
    } else {
      manifest['uses-permission'] = []
    }

    // Add them back with tools:node="remove" so merger strips them
    for (const perm of BLOCKED_PERMISSIONS) {
      manifest['uses-permission'].push({
        $: {
          'android:name': perm,
          'tools:node': 'remove',
        },
      })
    }

    return config
  })
}

module.exports = withBlockedPermissions
