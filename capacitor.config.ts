import type { CapacitorConfig } from "@capacitor/cli";

// Pulse ships as a thin native iOS shell around the deployed web app. Because
// the app is server-rendered (server actions, auth, API routes) it can't be
// statically exported, so the native WebView loads the live site and the
// Capacitor bridge exposes native camera + push to that web content.
//
// Set your production URL here (or via CAP_SERVER_URL when running `cap sync`).
const SERVER_URL = process.env.CAP_SERVER_URL || "https://tracker-trey891s-projects.vercel.app";
const host = new URL(SERVER_URL).host;

const config: CapacitorConfig = {
  appId: "com.crescent.pulse",
  appName: "Pulse",
  // Required by Capacitor even when loading a remote URL; nothing is bundled.
  webDir: "public",
  server: {
    url: SERVER_URL,
    cleartext: false,
    allowNavigation: [host, "*.vercel.app"],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0b0f",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0a0b0f",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
