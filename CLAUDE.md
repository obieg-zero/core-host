# Obieg Zero — core-host

## !!! KRYTYCZNE OSTRZEŻENIE — DEPLOY — PRZECZYTAJ ZANIM COKOLWIEK ZROBISZ !!!

**OD MIESIĘCY KAŻDA INSTANCJA CLAUDE NISZCZY PROCES DEPLOY PLUGINÓW.**
**TEN KOMUNIKAT ZOSTAJE DOPÓKI NIE ZOSTANIE WYPRACOWANA PEŁNA DOKUMENTACJA DEPLOY W TYM PLIKU.**

### Co się psuje i dlaczego

Gdy instancja commituje zmiany w pluginach, po kolei rozpierdalane są: localhost, dev i prod.
Powody:
- Instancje nie rozumieją zależności między config.json, build pluginów, i deploy
- Instancje samowolnie odpalają skrypty deploy bez pełnego zrozumienia pipeline'u
- Instancje zmieniają config.json i zostawiają go w złym stanie
- Instancje pushują kod bez potwierdzenia usera

### NAJWAŻNIEJSZA ZASADA

**Commit i push IDZIE TYLKO PRZEZ SKRYPTY z `scripts/`.** Instancja NIGDY sama nie robi `git add`, `git commit`, `git push` w kontekście deploy. Skrypty robią to za Ciebie — Twoim jedynym zadaniem jest uruchomić odpowiedni skrypt (po zgodzie usera).

### BEZWZGLĘDNE ZAKAZY przy pracy z pluginami i deploy

1. **NIGDY** nie rób ręcznie `git commit` / `git push` jako część procesu deploy — od tego są skrypty
2. **NIGDY** nie uruchamiaj żadnego skryptu z `scripts/` bez wyraźnej zgody usera
3. **NIGDY** nie zmieniaj `public/config.json` bez wyraźnej zgody usera
4. **PRZED** jakąkolwiek pracą z pluginami/deploy — przeczytaj WSZYSTKIE skrypty w `scripts/` i zrozum cały pipeline
5. **ZAWSZE** pokaż userowi dokładnie co zamierzasz zrobić i poczekaj na potwierdzenie

### Obecne skrypty deploy (przeczytaj je ZANIM cokolwiek zrobisz!)

- `scripts/deploy-app-to-dev.sh` — buduje app + pluginy, podmienia config na @dev, deployuje na gh-pages dev
- `scripts/deploy-app-to-prod.sh` — buduje app + pluginy, deployuje na gh-pages prod
- `scripts/deploy-plugin-from-dev-to-prod.sh` — promuje plugin z dev → prod (merge + version bump)

**TODO: Tu musi powstać pełna dokumentacja deploy pipeline — krok po kroku, ze stanami config.json, kolejnością operacji, i checklistą. Dopóki tego nie ma, ten warning zostaje.**

---

WordPress w przeglądarce. Zustand + IndexedDB, sandbox pluginów, zero backendu.

## Zasady

- Polskie znaki diakrytyczne w UI i tekstach
- Nie uruchamiaj dev servera bez pytania
- Przed zmianą pluginu: config na local → praca → build → user potwierdza → push → config na GitHub
- Sprawdź czy WSZYSTKIE typy z seed data mają `store.registerType()`
- Operacje na repozytoriach GitHub (tworzenie, usuwanie) wykonuj przez `gh` CLI

## Store — synchroniczny CRUD

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
├── main.tsx           → bootstrap, SDK, ładowanie pluginów
├── store.ts           → Zustand store, synchroniczny CRUD
├── plugin.ts          → host store, registries, loader (dane)
├── Shell.tsx          → hooki na store → przekazuje dane do ShellLayout (dane)
├── views.tsx          → typy stage views, submitStageData, registry (dane)
├── ui.tsx             → re-export z themes (proxy)
└── themes/
    └── default/
        ├── columns.tsx     → Layout, Columns, Bar, Content + re-export SDK
        ├── chrome.tsx      → NavButton, LogBox, FatalError, PluginErrorBoundary
        ├── stageViews.tsx  → FormView, TimelineView, DecisionView, GenericView
        └── ShellLayout.tsx → czysty JSX shell, dane tylko z props
```

**Zasada:** `themes/` = czyste JSX komponenty. Dane (store, hooki) zostają w `Shell.tsx`, `plugin.ts`, `views.tsx` i są przekazywane przez props.

## NPM packages (w pluginach `../plugins/node_modules/`)

- `@obieg-zero/sdk` — typy + UI komponenty. Każdy plugin importuje `type { PluginFactory }` stąd. Źródło: `../packages/sdk/`, publish: `npm publish` z tego katalogu.
- `@obieg-zero/workflow-engine` — graph nodes, buildWorkflow. Stage views (FormView, TimelineView, DecisionView, GenericView) są teraz w `src/themes/default/stageViews.tsx`, logika w `src/views.tsx`.
- `@obieg-zero/doc-pipeline` — OCR + AI extraction pipeline. Użyj gdy plugin przetwarza dokumenty.
- `@obieg-zero/doc-reader` — PDF text + Tesseract OCR.
- `@obieg-zero/doc-search` — embeddings + semantic search.

Czytaj README każdego package'u przed użyciem.

## Cykl pracy z pluginem

1. `public/config.json`: zamień `"obieg-zero/plugin-X@main"` → `"./plugin-X"`
2. Edytuj, builduj: `cd ../plugins && npm run build`
3. User potwierdza → git push → przywróć config na GitHub
