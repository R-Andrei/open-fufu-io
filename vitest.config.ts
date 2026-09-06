import {
  configDefaults,
  defineConfig,
  mergeConfig,
} from "vitest/config";
import viteConfig from "./vite.config";

const legacyServerTestsEnabled = process.env.LEGACY_SERVER_TESTS === "1";

export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        exclude: legacyServerTestsEnabled
          ? configDefaults.exclude
          : [...configDefaults.exclude, "tests/server/**"],
      },
    }),
  ),
);
