# Obieg Zero — core-host

Platforma pluginowa w przeglądarce. Zustand + IndexedDB + OPFS, zero backendu.

## Zanim cokolwiek zrobisz

1. Wywołaj `ToolSearch` na `mcp__obieg-deploy` — przeczytaj WSZYSTKIE narzędzia i ich parametry. Nie zgaduj.
2. `check_sync` — pełny obraz stanu pluginów, paczek, aplikacji.
3. Przeczytaj MEMORY.md — kontekst z poprzednich rozmów.

## Zasady

- Polskie znaki diakrytyczne w UI
- **NIGDY** ręcznie `git add/commit/push` ani `npm publish` — TYLKO MCP `obieg-deploy`
- Repozytoria GitHub przez `gh` CLI
- Nie uruchamiaj dev servera bez pytania
- Config prod jest hardcoded w `app_deploy_prod` — nigdy nie sugeruj zmiany
- Nie duplikuj logiki między pluginami — deleguj przez `sdk.shared` i `activeId`
- Sprawdź `store.registerType()` dla WSZYSTKICH typów z seed data

## Monorepo

```
obirg-zero/
├── CORE-HOST/              ← TU JESTEŚ (Vite + React 19)
├── plugins/                ← plugin-*/src/index.tsx → plugin-*/index.mjs
└── packages/               ← @obieg-zero/* (sdk, mcp-deploy, workflow-engine, doc-*, text-pl)
```

## MCP `obieg-deploy`

GitHub org: **obieg-zero**. Branchy: `dev` = staging, `main` = prod + tagi semver.

Cykl pluginu: `plugin_config_local` → edycja → `plugin_build` → user OK → `plugin_deploy_dev` → user OK → `plugin_deploy_prod`

## Store API — synchroniczny CRUD

```ts
store.add(type, data, opts?)     // → PostRecord, opts: { id?, parentId? }
store.get(id)                    // sync
store.update(id, data)           // sync merge
store.remove(id)                 // sync, cascade children
store.usePosts(type)             // hook → PostRecord[]
store.usePost(id)                // hook
store.useChildren(parentId, type?)
store.registerType(type, schema, label, { strict? })
store.importJSON(nodes)          // bulk: [{ type, data, children? }]
store.setOption(key, value) / store.useOption(key)
store.writeFile(postId, name, data) / store.readFile / store.listFiles
```

Relacje: `parentId` (cascade delete), `data.XId` (foreign key). Wartości w `data` to stringi — parsuj JSON ręcznie.

## SDK API

```ts
sdk.registerView(id, { slot: 'left'|'center'|'right'|'footer', component })
sdk.shared(selector) / sdk.shared.setState(partial) / sdk.shared.getState()
sdk.create(() => initialState)   // lokalny Zustand store
sdk.useForm(defaults, { isComplete? })  // → { form, bind, set, submit, toggle, reset }
sdk.useHostStore                 // pluginy, logi, activeId, leftOpen
sdk.log(text, level?)
sdk.uploadFile(parentId) / sdk.downloadFile(postId, filename)
sdk.installPlugin(spec, label?) / sdk.uninstallPlugin(spec)
```

**UI:** `Page, Stack, Row, Box, Button, Input, Select, Field, Tabs, Cell, Table, Card, Badge, Heading, Text, Value, ListItem, CheckItem, Spinner, Divider, RemoveButton`

**Ikony:** react-feather, np. `icons.Map`, `icons.BookOpen`, `icons.Zap`

**ZAKAZANE w pluginach:** `fetch`, `className`, `import()`, `localStorage`, `await` na store

## Plugin — wzorzec

```tsx
import type { PluginFactory } from '@obieg-zero/sdk'
const plugin: PluginFactory = ({ React, store, sdk, ui, icons }) => {
  store.registerType('task', [{ key: 'title', label: 'Tytuł', required: true }], 'Zadania')
  sdk.registerView('tasks.center', { slot: 'center', component: MyComponent })
  return { id: 'tasks', label: 'Zadania', icon: icons.CheckSquare }
}
export default plugin
```

Komunikacja: `sdk.shared.setState({ bqHelpers: {...} })` + `sdk.shared(s => s?.bqHelpers)`
Przełączanie pluginu: `sdk.useHostStore.setState({ activeId: 'other-id' })`

## Architektura src/

```
main.tsx         → bootstrap: config → store → SDK → Shell → load plugins
store.ts         → Zustand + IndexedDB, CRUD, pliki OPFS
plugin.ts        → useHostStore, loader, registries, SDK factory
opfs.ts          → cache pluginów, meta.json (specs, labels, licenseKey)
Shell.tsx        → hooki → filtruje widoki → props do ShellLayout
themes/default/  → czyste JSX komponenty (zero hooków, dane z props)
```

## Build

```bash
npm run dev       # CORE-HOST: Vite :5173, middleware serwuje ../plugins/
npm run build     # CORE-HOST: produkcja → dist/
# plugins/
npm run build     # Vite: plugin-*/src/index.tsx → plugin-*/index.mjs
```

Czytaj README paczek (`../packages/*/README.md`) przed ich użyciem.
