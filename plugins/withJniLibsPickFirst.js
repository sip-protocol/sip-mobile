const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// expo-updates 57 bundles the RN runtime libs libc++_shared.so + libfbjni.so,
// which collide with the react-android prefab copies in every expo module's
// androidTest APK (`2 files found with path 'lib/arm64-v8a/libc++_shared.so'`
// at :expo:mergeDebugAndroidTestNativeLibs). Neither expo-build-properties nor
// the :expo module template exposes pickFirst, so inject an afterEvaluate hook
// into the generated root build.gradle that teaches every library subproject
// to keep the first copy of each colliding runtime lib.
const AFTER_EVALUATE_BLOCK = `  afterEvaluate { subproject ->
    if (subproject.hasProperty('android')) {
      // expo-updates 57 bundles RN runtime libs that collide with the
      // react-android prefab copies in every expo module's androidTest APK.
      subproject.android.packagingOptions.jniLibs.pickFirsts += ['**/libc++_shared.so', '**/libfbjni.so']
    }
  }
`

function withJniLibsPickFirst(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const buildGradlePath = path.join(
        config.modRequest.projectRoot,
        'android',
        'build.gradle'
      )
      let contents = fs.readFileSync(buildGradlePath, 'utf8')

      // Idempotent: prebuild --clean regenerates the file, but never inject twice.
      if (contents.includes('jniLibs.pickFirsts')) {
        return config
      }

      const allprojectsStart = contents.indexOf('allprojects {')
      if (allprojectsStart === -1) {
        throw new Error(
          'withJniLibsPickFirst: could not find `allprojects {` in android/build.gradle'
        )
      }

      // Find the closing brace of the allprojects block (brace counting from
      // its opening brace) and insert the hook just before it.
      const openBrace = contents.indexOf('{', allprojectsStart)
      let depth = 1
      let closeBrace = -1
      for (let i = openBrace + 1; i < contents.length; i++) {
        if (contents[i] === '{') {
          depth++
        } else if (contents[i] === '}') {
          depth--
          if (depth === 0) {
            closeBrace = i
            break
          }
        }
      }
      if (closeBrace === -1) {
        throw new Error(
          'withJniLibsPickFirst: could not find the end of the `allprojects` block'
        )
      }

      contents =
        contents.slice(0, closeBrace) +
        AFTER_EVALUATE_BLOCK +
        contents.slice(closeBrace)
      fs.writeFileSync(buildGradlePath, contents)
      return config
    },
  ])
}

module.exports = withJniLibsPickFirst
