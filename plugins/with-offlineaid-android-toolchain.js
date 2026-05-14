const {
  withProjectBuildGradle,
} = require("@expo/config-plugins");

const AGP_LINE = "classpath('com.android.tools.build:gradle:8.13.2')";
const KOTLIN_LINE = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0')";

function replaceOnce(contents, pattern, replacement) {
  if (!pattern.test(contents)) {
    throw new Error(`Could not find pattern: ${pattern}`);
  }
  return contents.replace(pattern, replacement);
}

module.exports = function withOfflineAidAndroidToolchain(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    contents = replaceOnce(
      contents,
      /classpath\('com\.android\.tools\.build:gradle[^']*'\)/,
      AGP_LINE
    );

    contents = replaceOnce(
      contents,
      /classpath\('org\.jetbrains\.kotlin:kotlin-gradle-plugin[^']*'\)/,
      KOTLIN_LINE
    );

    config.modResults.contents = contents;
    return config;
  });
};
