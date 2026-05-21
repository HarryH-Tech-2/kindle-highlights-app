// Dynamic Expo config. Replaces app.json so we can resolve the path to
// google-services.json from an EAS file env var (the JSON file is gitignored
// and therefore not visible to EAS Build unless uploaded as a secret).
//
// Local builds fall back to ./google-services.json at the project root.
// On EAS, set:
//   eas env:create --scope project --name GOOGLE_SERVICES_JSON \
//     --type file --visibility secret --value ./google-services.json
// EAS writes the file into the build workspace and sets the env var to its
// absolute path.

module.exports = {
  expo: {
    name: 'Highlight Capture for Books',
    slug: 'kindle-highlights',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/app-icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.harry.highlightcapture',
      infoPlist: {
        NSCameraUsageDescription:
          'Used to capture photos of book highlights for text extraction.',
      },
    },
    android: {
      package: 'com.harry.highlightcapture',
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      permissions: [
        'android.permission.CAMERA',
        'com.android.vending.BILLING',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/images/app-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-camera',
      'react-native-iap',
      '@react-native-firebase/app',
      '@react-native-google-signin/google-signin',
      [
        'expo-media-library',
        {
          photosPermission:
            'Allow Highlight Capture to save beautified quote cards to your photo library.',
          savePhotosPermission:
            'Allow Highlight Capture to save beautified quote cards to your photo library.',
          isAccessMediaLocationEnabled: false,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 23,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: '35.0.0',
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '4bccc619-b2f2-4d35-8ad0-97ad97dd4634',
      },
    },
  },
};
