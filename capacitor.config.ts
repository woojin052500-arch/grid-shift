import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wjedulab.gridshift.v2',
  appName: 'Grid Shift',
  webDir: '.next',
  server: {
    url: 'https://grid-shift-iota.vercel.app/',
    cleartext: true
  }
};

export default config;
