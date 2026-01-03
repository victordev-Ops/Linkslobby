// serwist.config.mjs
export default {
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globDirectory: "public",
  // Only precache files that actually exist in public (like icons/manifest)
  // This prevents the "no files matched" error
  globPatterns: ["**/*.{png,json,ico,svg}"],
  injectionPoint: "self.__SW_MANIFEST",
};
