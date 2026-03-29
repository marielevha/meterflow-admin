import type { ExpoConfig } from 'expo/config';

import appJson from './app.json';

const staticConfig = appJson.expo as ExpoConfig;

const config: ExpoConfig = {
  ...staticConfig,
  android: {
    ...staticConfig.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON || staticConfig.android?.googleServicesFile,
  },
};

export default config;
