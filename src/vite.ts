import { existsSync } from "node:fs";
import { resolve } from "node:path";
import inertia from "@inertiajs/vite";
import Symfony from "@symfony/reprise/vite";
import type { Plugin, PluginOption } from "vite";

export interface InertiaRepriseSsrOptions {
    /**
     * Entry points for SSR builds. Defaults to `assets/ssr.js` when that file
     * exists, otherwise to the top-level `input`.
     */
    input?: Record<string, string>;
    /** @default "var/ssr" */
    outDir?: string;
    /** @default "ssr.js" */
    entryFileName?: string;
    /**
     * Dependencies to bundle into the SSR output instead of leaving them as
     * runtime imports. Pass `true` for a fully self-contained bundle.
     * Passed to Vite's `ssr.noExternal`; unset by default.
     */
    noExternal?: true | string | RegExp | (string | RegExp)[];
}

export interface InertiaRepriseOptions {
    /** Options passed through to the Symfony Reprise plugin. */
    symfony?: Parameters<typeof Symfony>[0];
    /** Options passed through to the Inertia Vite plugin. */
    inertia?: Parameters<typeof inertia>[0];
    /**
     * Default entry points, used when no input is configured.
     * @default { app: "assets/app.js" }
     */
    input?: Record<string, string>;
    /**
     * SSR build settings, or `false` to leave SSR builds untouched (the Symfony
     * plugin then also runs for them) and to pass `ssr: false` to the Inertia
     * plugin.
     */
    ssr?: false | InertiaRepriseSsrOptions;
}

export default function inertiaReprise(options: InertiaRepriseOptions = {}): PluginOption[] {
    const ssr = options.ssr === false ? undefined : (options.ssr ?? {});

    // The Symfony plugin is skipped for SSR builds, unless SSR is disabled.
    const symfony = ([Symfony(options.symfony)].flat(Infinity) as Plugin[]).map((plugin): Plugin => ({
        ...plugin,
        apply: (_config, env) => !ssr || !env.isSsrBuild,
    }));

    return [
        ...symfony,
        inertia(
            // Disabling SSR here disables it in the Inertia plugin too.
            options.ssr === false ? { ...options.inertia, ssr: false } : options.inertia,
        ),
        {
            name: "evomark:inertia-reprise",
            config(config, env) {
                const isSsr = ssr !== undefined && env.isSsrBuild;
                const build = config.build ?? {};
                const hasInput =
                    (config as { input?: unknown }).input !== undefined ||
                    build.rollupOptions?.input !== undefined ||
                    build.rolldownOptions?.input !== undefined;
                const defaultInput = options.input ?? { app: "assets/app.js" };
                const ssrFallback = existsSync(resolve(config.root ?? process.cwd(), "assets/ssr.js"))
                    ? { ssr: "assets/ssr.js" }
                    : defaultInput;
                const input = hasInput ? undefined : isSsr ? (ssr.input ?? ssrFallback) : defaultInput;

                if (!isSsr) {
                    return input && { build: { rolldownOptions: { input } } };
                }

                return {
                    ssr: ssr.noExternal ? { noExternal: ssr.noExternal } : undefined,
                    build: {
                        outDir: ssr.outDir ?? "var/ssr",
                        // Remove stale chunks from previous builds.
                        emptyOutDir: true,
                        copyPublicDir: false,
                        rolldownOptions: {
                            input,
                            output: {
                                entryFileNames: ssr.entryFileName ?? "ssr.js",
                                chunkFileNames: "chunks/[name]-[hash].js",
                            },
                        },
                    },
                };
            },
        },
    ];
}
