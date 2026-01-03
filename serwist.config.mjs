import { defaultCache } from "@serwist/next/worker";
import type { SerwistConfig } from "serwist";

export default {
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globDirectory: "public",
  injectionPoint: "self.__SW_MANIFEST",
  runtimeCaching: defaultCache,
} satisfies SerwistConfig;
