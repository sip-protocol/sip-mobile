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
  // Notification badge permissions (injected by expo-notifications via ShortcutBadger)
  'com.sec.android.provider.badge.permission.READ',
  'com.sec.android.provider.badge.permission.WRITE',
  'com.htc.launcher.permission.READ_SETTINGS',
  'com.htc.launcher.permission.UPDATE_SHORTCUT',
  'com.sonyericsson.home.permission.BROADCAST_BADGE',
  'com.sonymobile.home.permission.PROVIDER_INSERT_BADGE',
  'com.anddoes.launcher.permission.UPDATE_COUNT',
  'com.majeur.launcher.permission.UPDATE_BADGE',
  'com.huawei.android.launcher.permission.CHANGE_BADGE',
  'com.huawei.android.launcher.permission.READ_SETTINGS',
  'com.huawei.android.launcher.permission.WRITE_SETTINGS',
  'android.permission.READ_APP_BADGE',
  'com.oppo.launcher.permission.READ_SETTINGS',
  'com.oppo.launcher.permission.WRITE_SETTINGS',
  'me.everything.badger.permission.BADGE_COUNT_READ',
  'me.everything.badger.permission.BADGE_COUNT_WRITE',
  // Push notification permissions (not needed — we use local-only notifications)
  'com.google.android.c2dm.permission.RECEIVE',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
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
