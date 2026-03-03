const { withGradleProperties } = require('expo/config-plugins')

/**
 * Config plugin to fix JVM target inconsistency between Java (17) and Kotlin (21).
 * Kotlin 2.1+ defaults jvmTarget to 21, but some RN libraries set Java to 17.
 * Setting validation mode to 'warning' prevents build failure on JVM target mismatch.
 */
function withKotlinJvmTarget(config) {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'kotlin.jvm.target.validation.mode',
      value: 'warning',
    })
    return config
  })
}

module.exports = withKotlinJvmTarget
