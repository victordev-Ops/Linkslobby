// serwist.config.mjs
export default {
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globDirectory: "public",
  // Precaching only what you actually have
  globPatterns: ["**/*.{svg,ico,png,jpg,jpeg,webp,gif}"],
  injectionPoint: "self.__SW_MANIFEST",
  // Add this to prevent crashing if a pattern matches nothing
  globFollow: true,
};
