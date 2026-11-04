// Xcode 27 rejects targets with an iOS deployment target below 15.0, and several pods
// (RNSVG, RevenueCat, async-storage, view-shot resource bundles) still declare 9.0–13.4.
// Raise every pod target to at least MIN_IOS in the Podfile's post_install.
const { withPodfile } = require("expo/config-plugins");

const MIN_IOS = "15.1";
const MARKER = "# @stonks/pods-deployment-target";

module.exports = function withPodsDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    // Insert right after the react_native_post_install(...) call so it wins over anything set before.
    const callStart = contents.indexOf("react_native_post_install(");
    const callEnd = callStart === -1 ? -1 : contents.indexOf("\n    )\n", callStart);
    if (callEnd === -1) {
      throw new Error("withPodsDeploymentTarget: react_native_post_install call not found in Podfile");
    }
    const insertAt = callEnd + "\n    )\n".length;
    const snippet = [
      `    ${MARKER}`,
      "    installer.pods_project.targets.each do |target|",
      "      target.build_configurations.each do |build_config|",
      "        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
      `        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MIN_IOS}')`,
      `          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'`,
      "        end",
      "      end",
      "    end",
      "",
    ].join("\n");

    config.modResults.contents = contents.slice(0, insertAt) + snippet + contents.slice(insertAt);
    return config;
  });
};
