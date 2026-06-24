const { withAppBuildGradle } = require('@expo/config-plugins');

// Aktifkan shrinkResources pada release build untuk menghapus resource
// yang tidak dipakai dari APK (gambar/layout/string dari library pihak ketiga).
// Hemat estimasi 3-8MB. Tidak mempengaruhi fungsi atau tampilan app.
module.exports = function withShrinkResources(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('shrinkResources true')) return config;

    config.modResults.contents = config.modResults.contents.replace(
      /minifyEnabled\s+enableProguardInReleaseBuilds/,
      'minifyEnabled enableProguardInReleaseBuilds\n            shrinkResources true'
    );

    return config;
  });
};
