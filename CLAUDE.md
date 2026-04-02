# Obieg Zero — core-host

Platforma pluginowa w przeglądarce. Zustand + IndexedDB (dane), OPFS (pluginy), sandbox, zero backendu.

## Zasady

- Polskie znaki diakrytyczne w UI i tekstach
- Nie uruchamiaj dev servera bez pytania
- Przed zmianą pluginu: config na local → praca → build → user potwierdza → push → config na GitHub
- Sprawdź czy WSZYSTKIE typy z seed data mają `store.registerType()`
- Operacje na repozytoriach GitHub (tworzenie, usuwanie) wykonuj przez `gh` CLI
- **NIGDY** ręcznie `git add/commit/push` ani `npm publish` — TYLKO przez MCP `obieg-deploy`

## Store — synchroniczny CRUD (IndexedDB)

```ts
store.add(type, data, opts?)     // zwraca PostRecord, NIE Promise
store.get(id)                    // sync
store.update(id, data)           // sync, merge
store.remove(id)                 // sync, cascade children
store.usePosts(type)             // React hook
store.usePost(id)                // React hook
store.useChildren(parentId)      // React hook
store.registerType(type, schema, label, { strict? })
```

Relacje: `parentId` dla parent-child, `data.opponentId` jako foreign key.

## OPFS — stan pluginów (przeżywa czyszczenie IndexedDB)

Plik `plugin-cache/meta.json` — single source of truth:
```json
{ "specs": ["store://prod_abc"], "labels": {"store://prod_abc": "Nazwa"}, "licenseKey": "ch_xyz" }
```

API w `src/opfs.ts`: `loadMeta()`, `saveMeta()`, `meta()`, `readCode()`, `writeCode()`.

SDK metody dla pluginów: `sdk.installPlugin(spec, label?)`, `sdk.uninstallPlugin(spec)`, `sdk.getInstalledPlugins()`.

## Integralność pluginów

- **SRI** (Subresource Integrity): pole `integrity` w `config.json` — deployer pinuje hash, loader weryfikuje.
- Tagowane wersje `@vX.Y.Z` — immutable na GitHubie, cachowane w OPFS.
- `store://` — serwowane przez kontrolowany worker z prywatnych repo.

## Plugin — sandbox

```tsx
import type { PluginFactory } from '@obieg-zero/sdk'

const plugin: PluginFactory = ({ store, sdk, ui, icons }) => {
  store.registerType('task', [{ key: 'title', label: 'Tytuł', required: true }], 'Zadania')
  sdk.registerView('tasks.center', { slot: 'center', component: () =>
    <ui.Page><ui.Button onClick={() => store.add('task', { title: 'X' })}>+</ui.Button></ui.Page>
  })
  return { id: 'tasks', label: 'Zadania', icon: icons.CheckSquare }
}
export default plugin
```

**ZAKAZANE:** `fetch`, `className`, `import()`, `localStorage`, `await` na store.

Pełne API: `@obieg-zero/sdk` README (`node_modules/@obieg-zero/sdk/README.md`).

## Architektura src/

```
src/
├── main.tsx           → bootstrap, SDK, ładowanie pluginów, SDK methods (OPFS)
├── store.ts           → Zustand store, synchroniczny CRUD (IndexedDB)
├── opfs.ts            → OPFS cache + meta.json (stan pluginów)
├── plugin.ts          → host store, registries, loader, SRI
├── Shell.tsx          → hooki na store → przekazuje dane do ShellLayout
├── types.ts           → typy stage views, StageViewProps
├── stageRegistry.ts   → rejestr stage views
└── themes/
    └── default/
        ├── columns.tsx     → Layout, Columns, Bar, Content
        ├── chrome.tsx      → NavButton, LogBox, FatalError, PluginErrorBoundary
        ├── stageViews.tsx  → FormView, TimelineView, DecisionView, GenericView
        └── ShellLayout.tsx → czysty JSX shell, dane tylko z props
```

**Zasada:** `themes/` = czyste JSX komponenty. Dane (store, hooki) zostają w `Shell.tsx`, `plugin.ts`, `main.tsx` i są przekazywane przez props.

## NPM packages (w pluginach `../plugins/node_modules/`)

- `@obieg-zero/sdk` — typy + UI komponenty. Każdy plugin importuje `type { PluginFactory }` stąd. Źródło: `../packages/sdk/`, publish: MCP `package_publish`.
- `@obieg-zero/workflow-engine` — graph nodes, buildWorkflow. Stage views w `src/themes/default/stageViews.tsx`.
- `@obieg-zero/doc-pipeline` — OCR + AI extraction pipeline.
- `@obieg-zero/doc-reader` — PDF text + Tesseract OCR.
- `@obieg-zero/doc-search` — embeddings + semantic search.

Czytaj README każdego package'u przed użyciem.

## Deploy — TYLKO przez MCP `obieg-deploy`

MCP server: `../packages/mcp-deploy/` — 14 narzędzi:

```
plugin_status          — porównanie local vs GitHub
plugin_config_local    — config → ./plugin-X (tryb lokalny)
plugin_config_github   — config → @main lub @dev
plugin_build           — build wszystkich pluginów
plugin_deploy_dev      — build + push na @dev + config → @dev
plugin_deploy_prod     — promote dev → main + tag + config → @main
package_status         — wersje paczek NPM
package_publish        — publish paczki na npm
app_deploy_dev         — build + deploy app na dev
app_deploy_prod        — build + deploy app na prod
app_status             — wersje app (local/dev/prod)
check_sync             — pełny audyt
push_core_host         — commit + push CORE-HOST
setup_creem            — sync pluginów z Creem
```

## Cykl pracy z pluginem

1. `plugin_config_local` → config na `./plugin-X`
2. Edytuj źródła, `plugin_build` po każdej zmianie
3. User potwierdza → `plugin_deploy_dev` (push + config → @dev)
4. User potwierdza → `plugin_deploy_prod` (dev → main + tag + config → @main)
