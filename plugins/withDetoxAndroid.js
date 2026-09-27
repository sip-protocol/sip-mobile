const { withAppBuildGradle, withSettingsGradle, withDangerousMod, withAndroidManifest, withGradleProperties } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// Detox's Android instrumentation lives inside the npm package as a Gradle
// subproject (node_modules/detox/android/detox). `expo prebuild --clean`
// regenerates android/ and wipes every trace of it, which left the CI E2E
// with an EMPTY androidTest APK (7 KB stub, no DetoxRunner): `am instrument`
// had nothing to run, the Detox agent never connected, and all 30 Android
// tests died in the 120 s setup hook with "can't seem to connect to the test
// app(s)" (runs 36212228295, 36287910458, 36312431004).
//
// This plugin re-wires Detox into the generated android project after every
// prebuild:
//   1. settings.gradle — include the :detox subproject from node_modules
//   2. app/build.gradle — testBuildType + testInstrumentationRunner +
//      missingDimensionStrategy + androidTestImplementation(project(':detox'))
//      (detox's gradle exposes androidx.test espresso/rules/ext-junit as
//      `api`, so the app needs no extra test deps) + the dedicated `e2e`
//      build type (release-like, embedded JS bundle, no dev-launcher, no R8)
//   3. android/app/src/androidTest/.../DetoxTest.java — the single native
//      test entrypoint Detox's runner discovers (per Detox 20.x project-setup
//      docs; package + MainActivity are app-config-driven)
//   4. android/app/src/e2e/AndroidManifest.xml — cleartext allowed, so the
//      Detox agent can reach ws://localhost:<port> on the host
//   5. main manifest — DEV_CLIENT_DEFAULT_LAUNCHER_URL metadata (inert in
//      release) so a plain launch opens the Metro project instead of the
//      dev-client picker
//   6. gradle.properties — daemon heap sized for androidTest dex merging

const detoxTestJava = (pkg) => `package ${pkg};

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
    @Rule
    public ActivityTestRule<MainActivity> mActivityRule = new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
        detoxConfig.rnContextLoadTimeoutSec = (BuildConfig.DEBUG ? 180 : 60);

        Detox.runTests(mActivityRule, detoxConfig);
    }
}
`

const E2E_ANDROID_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <application android:usesCleartextTraffic="true" tools:targetApi="28" tools:replace="android:usesCleartextTraffic" />
</manifest>
`

const withDetoxSettingsGradle = (config) => {
  return withSettingsGradle(config, (mod) => {
    let contents = mod.modResults.contents
    if (!/include\s+'(:detox)'/.test(contents)) {
      contents += "\n// Detox android instrumentation (see plugins/withDetoxAndroid.js)\ninclude ':detox'\nproject(':detox').projectDir = new File(rootProject.projectDir, '../node_modules/detox/android/detox')\n"
      mod.modResults.contents = contents
    }
    return mod
  })
}

const withDetoxAppBuildGradle = (config) => {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents
    let changed = false
    if (!/testInstrumentationRunner/.test(contents)) {
      const injected = [
        "        testBuildType System.getProperty('testBuildType', 'debug')",
        "        testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
        "        missingDimensionStrategy 'detox', 'full'",
      ].join('\n')
      contents = contents.replace(/defaultConfig\s*\{/, `defaultConfig {\n${injected}`)
      changed = true
    }
    if (!/project\(':detox'\)/.test(contents)) {
      contents = contents.replace(
        /dependencies\s*\{/,
        "dependencies {\n    androidTestImplementation(project(':detox'))"
      )
      changed = true
    }
    if (!/buildTypes\s*\{[\s\S]*?\be2e\s*\{/.test(contents)) {
      // Dedicated E2E build type: release-like runtime (embedded JS bundle,
      // no dev launcher) but WITHOUT R8 minification — expo-task-manager's
      // AAR ships a BuildConfig.class whose jar path casing contradicts its
      // content (`taskManager` vs `taskmanager`), which aborts R8
      // (com.android.tools.r8.internal.Yf) in minified androidTest builds.
      const e2eBlock = [
        '        e2e {',
        '            initWith(release)',
        "            matchingFallbacks = ['release']",
        '            minifyEnabled false',
        '            signingConfig signingConfigs.debug',
        '        }',
      ].join('\n')
      contents = contents.replace(/buildTypes\s*\{/, `buildTypes {\n${e2eBlock}`)
      changed = true
    }
    if (changed) {
      mod.modResults.contents = contents
    }
    return mod
  })
}

const withDetoxTestFile = (config) => {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const pkg = config.android?.package
      if (!pkg) {
        throw new Error('withDetoxAndroid: expo.android.package is required')
      }
      const projectRoot = mod.modRequest.projectRoot

      const testDir = path.join(
        projectRoot, 'android', 'app', 'src', 'androidTest', 'java', ...pkg.split('.')
      )
      fs.mkdirSync(testDir, { recursive: true })
      fs.writeFileSync(path.join(testDir, 'DetoxTest.java'), detoxTestJava(pkg))

      // The e2e build type inherits release's cleartext policy (blocked on
      // targetSdk 28+), so the Detox agent's ws://localhost:<port> connect to
      // the host server fails instantly ("Retrying..." forever). The debug
      // variant gets its cleartext override from src/debug/AndroidManifest.xml;
      // mirror it for e2e.
      const e2eManifestDir = path.join(projectRoot, 'android', 'app', 'src', 'e2e')
      fs.mkdirSync(e2eManifestDir, { recursive: true })
      fs.writeFileSync(path.join(e2eManifestDir, 'AndroidManifest.xml'), E2E_ANDROID_MANIFEST)

      return mod
    }
  ])
}

// expo-dev-client's DevLauncherActivity intercepts app launches on debug
// builds and shows its picker (fresh installs have no "last opened" app), so
// Detox's launch never reaches the JS app. This metadata makes the launcher
// auto-open the Metro project instead. Inert in release (the launcher is
// debug-only).
const DEFAULT_LAUNCH_URL_KEY = 'DEV_CLIENT_DEFAULT_LAUNCHER_URL'

const withDetoxDefaultLaunchUrl = (config) => {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]
    if (!application) {
      return mod
    }
    application['meta-data'] = application['meta-data'] || []
    const existing = application['meta-data'].find(
      (m) => m.$['android:name'] === DEFAULT_LAUNCH_URL_KEY
    )
    if (existing) {
      existing.$['android:value'] = 'exp://localhost:8081'
    } else {
      application['meta-data'].push({
        $: {
          'android:name': DEFAULT_LAUNCH_URL_KEY,
          'android:value': 'exp://localhost:8081',
        }
      })
    }
    return mod
  })
}

// The Expo template daemon heap (2 GB) OOMs D8 while dex-merging the
// androidTest classpath of a full module graph (OutOfMemoryError: Java heap
// space in mergeExtDexDebugAndroidTest / packageDebugAndroidTest). Same fix
// as the CI workflow's "Raise Gradle daemon heap" step.
const withDetoxGradleProperties = (config) => {
  return withGradleProperties(config, (mod) => {
    const KEY = 'org.gradle.jvmargs'
    const VALUE = '-Xmx8g -XX:MaxMetaspaceSize=2g'
    const existing = mod.modResults.find((item) => item.type === 'property' && item.key === KEY)
    if (existing) {
      existing.value = VALUE
    } else {
      mod.modResults.push({ type: 'property', key: KEY, value: VALUE })
    }
    return mod
  })
}

module.exports = (config) => {
  config = withDetoxSettingsGradle(config)
  config = withDetoxAppBuildGradle(config)
  config = withDetoxTestFile(config)
  config = withDetoxDefaultLaunchUrl(config)
  config = withDetoxGradleProperties(config)
  return config
}
