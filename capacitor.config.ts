import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amazon.caxias.wms',
  appName: 'Amazon Caxias SGO9',
  webDir: 'dist',

  server: {
    // Production: loads the deployed Vercel app inside the WebView
    url: 'https://amazon-caxias-sgo-9-wms-k7xi.vercel.app',
    cleartext: true, // Allow HTTP fallback in restricted networks
  },

  android: {
    // Keep WebView overlay behind system bars (immersive already in MainActivity)
    backgroundColor: '#0f172a',
    allowMixedContent: true, // Allow Supabase Realtime WSS + HTTPS
    webContentsDebuggingEnabled: false, // Disable for production
  },

  plugins: {
    Keyboard: {
      // Barcode scanners inject keystrokes — keep accessory bar visible
      resize: 'body',
      style: 'dark',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
