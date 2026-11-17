<p align="center">
    <a href="https://evomark.co.uk" target="_blank" alt="Link to evoMark's website">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://evomark.co.uk/wp-content/uploads/static/evomark-logo--dark.svg">
          <source media="(prefers-color-scheme: light)" srcset="https://evomark.co.uk/wp-content/uploads/static/evomark-logo--light.svg">
          <img alt="evoMark company logo" src="https://evomark.co.uk/wp-content/uploads/static/evomark-logo--light.svg" width="500">
        </picture>
    </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@evomark/inertia-reprise"><img src="https://img.shields.io/npm/dm/@evomark/inertia-reprise.svg" alt="Downloads"></a>
  <a href="https://www.npmjs.com/package/@evomark/inertia-reprise"><img src="https://img.shields.io/npm/v/@evomark/inertia-reprise.svg" alt="Version"></a>
  <a href="https://github.com/evo-mark/inertia-reprise/blob/main/LICENCE"><img src="https://img.shields.io/github/license/evo-mark/inertia-reprise?style=flat" alt="Licence"></a>
</p>

# @evomark/inertia-reprise

A Vite plugin bundling [Symfony Reprise](https://github.com/symfony/reprise) and
the [Inertia Vite plugin](https://inertiajs.com), with sensible defaults for
client and SSR builds.

## Usage

```js
// vite.config.js
import { defineConfig } from "vite";
import inertiaReprise from "@evomark/inertia-reprise/vite";

export default defineConfig({
    plugins: [inertiaReprise()],
});
```

Peer dependencies: `vite` (8), `@symfony/reprise`, `@inertiajs/vite`.

## Options

| Option    | Description                                                     |
| --------- | --------------------------------------------------------------- |
| `symfony` | Options passed to the Symfony Reprise plugin.                   |
| `inertia` | Options passed to the Inertia Vite plugin.                      |
| `input`   | Default entries. Defaults to `{ app: "assets/app.js" }`.        |
| `ssr`     | SSR settings (below), or `false` to leave SSR builds untouched. |

An input configured in your own Vite config always wins over the defaults.

### `ssr`

| Option          | Default                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `input`         | `{ ssr: "assets/ssr.js" }` if that file exists, otherwise `input`         |
| `outDir`        | `var/ssr`                                                                 |
| `entryFileName` | `ssr.js`                                                                  |
| `noExternal`    | unset. Passed to Vite's `ssr.noExternal`; `true` bundles every dependency |

SSR builds skip the Symfony plugin, don't copy the public directory, empty the
output directory first and put shared chunks in `chunks/`.

Passing `ssr: false` leaves SSR builds untouched, runs the Symfony plugin for
them, and passes `ssr: false` to the Inertia plugin as well.

### Running the SSR bundle

Build with `vite build --ssr`, then start it from the project root:

```sh
node var/ssr/ssr.js
```

By default dependencies stay as runtime imports and are resolved from
`node_modules`. Set `ssr: { noExternal: true }` to produce a self-contained
bundle that can run without `node_modules`.

## Development

```sh
pnpm --filter @evomark/inertia-reprise dev   # watch
pnpm --filter @evomark/inertia-reprise test
```

The package builds to `dist/` on `pnpm install` (`prepare`).
