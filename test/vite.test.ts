import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin, UserConfig } from "vite";
import { describe, expect, it, vi } from "vitest";
import inertiaReprise, { type InertiaRepriseOptions } from "../src/vite";

function plugins(options?: InertiaRepriseOptions) {
    return (inertiaReprise(options) as Plugin[]).flat(Infinity) as Plugin[];
}

function own(options?: InertiaRepriseOptions) {
    return plugins(options).find((p) => p.name === "evomark:inertia-reprise")!;
}

function config(
    options: InertiaRepriseOptions | undefined,
    isSsrBuild: boolean,
    userConfig: UserConfig = {},
): UserConfig {
    const hook = own(options).config as (
        c: UserConfig,
        env: { command: string; mode: string; isSsrBuild: boolean },
    ) => UserConfig | undefined | null;
    return hook(userConfig, { command: "build", mode: "production", isSsrBuild }) ?? {};
}

describe("client builds", () => {
    it("defaults the input to assets/app.js", () => {
        expect(config(undefined, false).build?.rolldownOptions?.input).toEqual({
            app: "assets/app.js",
        });
    });

    it("uses the input option", () => {
        const input = { main: "assets/main.js" };
        expect(config({ input }, false).build?.rolldownOptions?.input).toEqual(input);
    });

    it("respects a configured input", () => {
        expect(
            config(undefined, false, {
                build: { rolldownOptions: { input: "x.js" } },
            }),
        ).toEqual({});
        expect(config(undefined, false, { input: { a: "a.js" } } as UserConfig)).toEqual({});
    });

    it("does not change the output", () => {
        expect(config(undefined, false).build?.outDir).toBeUndefined();
    });
});

describe("ssr builds", () => {
    it("writes var/ssr/ssr.js by default", () => {
        const build = config(undefined, true, {
            root: mkdtempSync(join(tmpdir(), "ir-")),
        }).build;
        expect(build?.outDir).toBe("var/ssr");
        expect(build?.copyPublicDir).toBe(false);
        expect(build?.emptyOutDir).toBe(true);
        expect(build?.rolldownOptions?.output).toMatchObject({
            entryFileNames: "ssr.js",
            chunkFileNames: "chunks/[name]-[hash].js",
        });
        expect(build?.rolldownOptions?.input).toEqual({ app: "assets/app.js" });
    });

    it("prefers assets/ssr.js when it exists", () => {
        const root = mkdtempSync(join(tmpdir(), "ir-"));
        mkdirSync(join(root, "assets"));
        writeFileSync(join(root, "assets/ssr.js"), "");
        expect(config(undefined, true, { root }).build?.rolldownOptions?.input).toEqual({
            ssr: "assets/ssr.js",
        });
    });

    it("supports custom ssr options", () => {
        const build = config(
            {
                ssr: {
                    input: { s: "s.js" },
                    outDir: "out",
                    entryFileName: "s.js",
                },
            },
            true,
        ).build;
        expect(build?.outDir).toBe("out");
        expect(build?.rolldownOptions?.input).toEqual({ s: "s.js" });
        expect(build?.rolldownOptions?.output).toMatchObject({
            entryFileNames: "s.js",
        });
    });

    it("passes noExternal to Vite's ssr config", () => {
        expect(config(undefined, true).ssr).toBeUndefined();
        expect(config({ ssr: { noExternal: true } }, true).ssr).toEqual({
            noExternal: true,
        });
    });

    it("is untouched with ssr: false", () => {
        const build = config({ ssr: false }, true).build;
        expect(build?.outDir).toBeUndefined();
        expect(build?.copyPublicDir).toBeUndefined();
        expect(build?.emptyOutDir).toBeUndefined();
        expect(build?.rolldownOptions?.output).toBeUndefined();
        expect(build?.rolldownOptions?.input).toEqual({ app: "assets/app.js" });
    });
});

describe("symfony plugin", () => {
    const symfony = (o?: InertiaRepriseOptions) => plugins(o).filter((p) => typeof p.apply === "function");
    const applies = (p: Plugin, isSsrBuild: boolean) =>
        (p.apply as Function)({}, { command: "build", mode: "", isSsrBuild });

    it("is skipped for ssr builds", () => {
        const found = symfony();
        expect(found.length).toBeGreaterThan(0);
        for (const p of found) {
            expect(applies(p, false)).toBe(true);
            expect(applies(p, true)).toBe(false);
        }
    });

    it("runs for ssr builds when ssr is false", () => {
        for (const p of symfony({ ssr: false })) {
            expect(applies(p, true)).toBe(true);
        }
    });
});

describe("inertia plugin", () => {
    it("receives ssr: false when ssr is false", async () => {
        const calls: unknown[] = [];
        vi.resetModules();
        vi.doMock("@inertiajs/vite", () => ({
            default: (o: unknown) => (calls.push(o), { name: "inertia" }),
        }));
        const { default: fresh } = await import("../src/vite");
        fresh({ ssr: false, inertia: { pages: "x" } as never });
        fresh({ inertia: { pages: "y" } as never });
        vi.doUnmock("@inertiajs/vite");
        expect(calls).toEqual([
            { pages: "x", ssr: false },
            { pages: "y", ssr: "assets/app.js" },
        ]);
    });

    describe("ssr entry", () => {
        async function inertiaOptions(options?: InertiaRepriseOptions, root?: string) {
            const calls: { ssr?: unknown }[] = [];
            vi.resetModules();
            vi.doMock("@inertiajs/vite", () => ({
                default: (o: { ssr?: unknown }) => (calls.push(o), { name: "inertia" }),
            }));
            const cwd = root ? vi.spyOn(process, "cwd").mockReturnValue(root) : undefined;
            const { default: fresh } = await import("../src/vite");
            fresh(options);
            cwd?.mockRestore();
            vi.doUnmock("@inertiajs/vite");
            return calls[0];
        }

        it("defaults to the first client input, so the dev SSR endpoint is registered", async () => {
            expect((await inertiaOptions())?.ssr).toBe("assets/app.js");
            expect((await inertiaOptions({ ssr: true }))?.ssr).toBe("assets/app.js");
            expect((await inertiaOptions({ input: { main: "assets/main.js" } }))?.ssr).toBe("assets/main.js");
        });

        it("prefers assets/ssr.js when it exists", async () => {
            const root = mkdtempSync(join(tmpdir(), "ir-"));
            mkdirSync(join(root, "assets"));
            writeFileSync(join(root, "assets/ssr.js"), "");
            expect((await inertiaOptions({}, root))?.ssr).toBe("assets/ssr.js");
        });

        it("uses the first ssr input", async () => {
            expect((await inertiaOptions({ ssr: { input: { ssr: "assets/server.js" } } }))?.ssr).toBe(
                "assets/server.js",
            );
        });

        it("keeps an ssr option given to the Inertia plugin", async () => {
            expect((await inertiaOptions({ inertia: { ssr: "custom/entry.js" } }))?.ssr).toBe("custom/entry.js");
            expect((await inertiaOptions({ inertia: { ssr: false } }))?.ssr).toBe(false);
        });
    });
});
