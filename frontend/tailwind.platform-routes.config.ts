import baseConfig from "./tailwind.config";

const productionContentExclusions = process.env.NODE_ENV === "production"
  ? [
      "!./src/**/*.{test,spec}.{ts,tsx}",
      "!./src/components/platform/PlatformSmsTestPanel.tsx",
    ]
  : [];

export default {
  ...baseConfig,
  content: [
    "./src/pages/platform/**/*.{ts,tsx}",
    "./src/components/platform/**/*.{ts,tsx}",
    ...productionContentExclusions,
  ],
};
