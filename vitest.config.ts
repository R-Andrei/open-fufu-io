import { readFileSync } from "node:fs";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

const manifest = JSON.parse(
  readFileSync(
    new URL("./validation/open-fufu-owned.json", import.meta.url),
    "utf8",
  ),
) as { ownedTests: string[] };

export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        include: manifest.ownedTests,
      },
    }),
  ),
);
