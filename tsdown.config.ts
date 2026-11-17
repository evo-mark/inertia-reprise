import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/vite.ts"],
    format: "esm",
    dts: true,
    clean: true,
    deps: { neverBundle: ["vite", "postcss", "rolldown", /^@symfony\/reprise/] },
});
