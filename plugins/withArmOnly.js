const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withArmOnly(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('withArmOnly')) return config;

    config.modResults.contents = config.modResults.contents.replace(
      /packagingOptions\s*\{/,
      `packagingOptions {
        jniLibs {
            excludes += ["**/x86/*.so", "**/x86_64/*.so", "**/armeabi-v7a/*.so"]
        }
        // withArmOnly`
    );

    return config;
  });
};
