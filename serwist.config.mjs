export default {
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globDirectory: "public",
  injectionPoint: "self.__SW_MANIFEST",
  // We will move the runtimeCaching logic into the sw.ts file instead
};
