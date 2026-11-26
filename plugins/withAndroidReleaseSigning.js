// Release signing for Google Play uploads. The android/ folder is generated (and gitignored),
// so the signing block lives here instead of being hand-edited into app/build.gradle.
// Credentials come from ~/.gradle/gradle.properties:
//   STONKS_UPLOAD_STORE_FILE, STONKS_UPLOAD_STORE_PASSWORD, STONKS_UPLOAD_KEY_ALIAS, STONKS_UPLOAD_KEY_PASSWORD
// STONKS_UPLOAD_STORE_FILE is resolved relative to android/app/; use an absolute path outside
// android/ (e.g. ~/keys/stonks/my-upload-key.keystore), since prebuild regenerates that folder.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// @stonks/release-signing";

const RELEASE_SIGNING = `
        release {
            ${MARKER}
            if (project.hasProperty('STONKS_UPLOAD_STORE_FILE')) {
                storeFile file(STONKS_UPLOAD_STORE_FILE)
                storePassword STONKS_UPLOAD_STORE_PASSWORD
                keyAlias STONKS_UPLOAD_KEY_ALIAS
                keyPassword STONKS_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    // 1. Add a release signing config next to the template's debug one.
    const debugSigning = /signingConfigs\s*\{\s*debug\s*\{[^}]*\}/;
    if (!debugSigning.test(contents)) {
      throw new Error("withAndroidReleaseSigning: signingConfigs.debug block not found in app/build.gradle");
    }
    contents = contents.replace(debugSigning, (match) => match + RELEASE_SIGNING);

    // 2. Point the release build type at it (the template signs release builds with the debug key).
    const releaseBuildType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseBuildType.test(contents)) {
      throw new Error("withAndroidReleaseSigning: release build type signingConfig not found in app/build.gradle");
    }
    contents = contents.replace(releaseBuildType, "$1signingConfig signingConfigs.release");

    config.modResults.contents = contents;
    return config;
  });
};
