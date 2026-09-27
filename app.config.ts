import type { ExpoConfig } from 'expo/config';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

const config: ExpoConfig = {
  name: 'RangerNet',
  slug: 'RangerNet',
  scheme: 'rangernet',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.rangernet.app',
  },
  android: {
    package: 'com.rangernet.app',
    adaptiveIcon: {
      backgroundColor: '#0A3D28',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-sqlite',
    'expo-sharing',
    'expo-font',
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'RangerNet uses your location to tag incidents, conflict reports and to track patrols.',
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'RangerNet uses the camera to capture incident and conflict evidence photos.',
        photosPermission: 'RangerNet lets you attach existing photos to conflict reports.',
        microphonePermission: false,
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: GOOGLE_MAPS_API_KEY,
        iosGoogleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
};

export default config;
