// Apps built with the iOS 27 SDK must adopt the UIScene life cycle or UIKit aborts at launch.
// expo >= 57.0.31 ships ExpoAppSceneDelegate (creates the window and starts React Native from the
// scene), but the prebuild template doesn't use it yet. This plugin registers it and lets the
// AppDelegate hand the window over to the scene.
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const SCENE_DELEGATE_CLASS = "EXExpoAppSceneDelegate";

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return config;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      throw new Error("withSceneLifecycle: only Swift AppDelegates are supported");
    }
    let contents = config.modResults.contents;

    // ExpoAppSceneDelegate reads the factory and window through this protocol.
    if (!contents.includes("ExpoReactNativeFactoryProvider")) {
      const classDecl = /class AppDelegate: ExpoAppDelegate \{/;
      if (!classDecl.test(contents)) {
        throw new Error("withSceneLifecycle: AppDelegate class declaration not found");
      }
      contents = contents.replace(
        classDecl,
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"
      );
    }

    // The scene delegate creates the window and starts React Native instead.
    const startBlock =
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
    contents = contents.replace(startBlock, "");

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
