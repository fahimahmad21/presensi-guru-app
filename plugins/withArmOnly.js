const { withAppBuildGradle } = require('@expo/config-plugins');

// Filter ABI ke arm64-v8a saja via ndk.abiFilters di defaultConfig.
// Pendekatan ini lebih aman dari packagingOptions karena tidak konflik
// dengan packaging options Firebase atau library lain.
module.exports = function withArmOnly(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('withArmOnly')) return config;

    config.modResults.contents = config.modResults.contents.replace(
      /defaultConfig\s*\{/,
      `defaultConfig {
        ndk {
            abiFilters "arm64-v8a"
        }
        // withArmOnly`
    );

    return config;
  });
};
