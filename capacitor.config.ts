import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.say.app',
  appName: 'say-app',
  webDir: 'public',
  server: {
    // URL to your Next.js application
    // If running in an Android Emulator, use http://10.0.2.2:3000
    // In production, use your actual deployed URL, e.g., https://say-app.com
    url: 'http://10.0.2.2:3000', 
    cleartext: true
  }
};

export default config;
