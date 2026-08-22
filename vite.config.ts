// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        // pdf-lib ships a CommonJS entry that destructures tslib@1's default export.
        // In the worker bundle that interop yields undefined ("Cannot destructure
        // property '__extends'"). Pin both to their ESM builds everywhere so local
        // dev and the deployed worker load identical, bundler-safe code.
        { find: /^pdf-lib$/, replacement: "pdf-lib/es/index.js" },
      ],
    },
  },
});
