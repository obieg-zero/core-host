# Zasady

- Zawsze używaj polskich znaków diakrytycznych (ą, ę, ó, ś, ć, ż, ź, ł, ń) w UI i tekstach
- Nigdy nie uruchamiaj dev servera (npm run dev, vite) bez pytania — użytkownik uruchamia własny

# Pluginy

Kod źródłowy: `../plugins/plugin-*/src/index.tsx` — każdy plugin to osobne repo git na `obieg-zero/`.

**NIGDY nie usuwaj, nie klonuj, nie przenoś pluginów w `../plugins/` bez wyraźnej zgody użytkownika.**

## Cykl pracy z pluginem — WYMÓG BEZWZGLĘDNY

**To nie jest sugestia. To jest obowiązkowa procedura. Złamanie jej powoduje blokadę TOFU i sabotuje pracę użytkownika.**

ZANIM dotkniesz JAKIEGOKOLWIEK pliku w `../plugins/plugin-*/src/`:

1. **START**: w `public/config.json` zamień `"obieg-zero/plugin-NAZWA@main"` → `"./plugin-NAZWA"`, potem `cd /home/dadmor/code/obirg-zero/plugins && npm run build`
2. **PRACA**: edytuj src, builduj `cd /home/dadmor/code/obirg-zero/plugins && npm run build` — użytkownik widzi zmiany natychmiast na localhost
3. **KONIEC** (tylko gdy użytkownik potwierdzi że działa): `git add . && git commit && git push` + przywróć config na `"obieg-zero/plugin-NAZWA@main"`

**ZAKAZANE:**
- Push do remote ZANIM użytkownik zobaczy zmiany lokalnie
- Pomijanie przełączenia configu (nawet "dla małej zmiany")
- Kazanie użytkownikowi czyścić TOFU/cache/IndexedDB

## Contribution Points — rejestracja widoków

Pluginy rejestrują UI przez `sdk.registerView()`, nie przez `layout`:

```tsx
sdk.registerView('myPlugin.center', { slot: 'center', component: CenterView })
sdk.registerView('myPlugin.left', { slot: 'left', component: LeftPanel })
sdk.registerView('myPlugin.footer', { slot: 'footer', component: Footer })
```

Sloty: `left` | `center` | `right` | `footer`. Shell renderuje widoki z rejestru `getViews()`.

Inne contribution points:
```tsx
sdk.registerParser('myPlugin.csv', { accept: '.csv', targetType: 'record', parse: fn })
sdk.registerAction('myPlugin.export', { node: <ui.Button>Export</ui.Button> })
```

## Layout w pluginach — ZAKAZ className

**Pluginy NIE MOGĄ używać `className` z klasami Tailwind.** Pluginy ładowane z GitHub nie są skanowane przez Tailwind hosta — klasy nie istnieją w CSS i nie zadziałają.

**Zasady:**
- Cały layout i stylowanie TYLKO przez propsy komponentów UI (`size`, `color`, `muted`, etc.)
- Jeśli brakuje propsa — dodaj go do komponentu w `src/ui.tsx`, nie obchodź className
- Zero `<span>`, `<div>`, `<p>` z klasami — używaj `ui.Text`, `ui.Row`, `ui.Stack`, etc.
- Jeśli potrzebujesz nowego zachowania layoutu — rozszerz UI, nie hackuj pluginu

## UI — restrykcyjne warianty

Komponenty mają ograniczone propsy (jak shadcn/ui). Pluginy NIE dostają `md`, `lg`, `xl` — tylko to co jest potrzebne:

- `Button`: size = `xs` | `sm` (domyślnie `sm`). Brak `md`/`lg`.
- `Badge`: brak prop `size` — zawsze `sm`.
- `Select`, `Spinner`: brak prop `size` — hardkodowane.
- `Value`, `Stat`: color = `SemanticColor` (`primary | accent | error | warning | info | success | muted`), nie dowolny string.
- `Text`: size = `xs` | `2xs`.

Jeśli plugin potrzebuje wariantu którego nie ma — dodaj go do `src/ui.tsx`, nie obchodź przez className.

# State management — Zustand

Host używa Zustand. Pluginy dostają `sdk.create` i `sdk.useHostStore`.

## Host store (`src/plugin.ts`)

`useHostStore` — plugins, logs, activeId (persist), leftOpen, progress. Shell czyta z niego bezpośrednio.

## Pluginy — sdk.create

Pluginy tworzą własne zustand store'y przez `sdk.create()`:

```tsx
const useMyStore = sdk.create(() => ({ selected: null as string | null }))
// czytanie:
const selected = useMyStore(s => s.selected)
// zapis:
useMyStore.setState({ selected: 'abc' })
```

**NIE używaj ręcznych sygnałów** (let + Set<()=>void> + useState + useEffect subscribe). Zawsze `sdk.create()`.

## Shared state między kolumnami

Zustand store jest dostępny z każdego komponentu pluginu (Left, Center, Right, Footer). Nie trzeba akcji ani efektów do komunikacji między kolumnami.

# Kontrakt pluginu — SANDBOX

Plugin to sandbox. Dostaje TYLKO: `React`, `store`, `sdk`, `ui`, `icons`. Nic więcej.

**ZAKAZANE w pluginach:**
- `fetch()`, `XMLHttpRequest`, jakikolwiek I/O sieciowy
- `window.open()`, `document.cookie`, `localStorage` (bezpośrednio)
- `import()` dynamiczny (poza `react/jsx-runtime`)
- Bezpośredni dostęp do DOM poza `style={}` na własnych elementach

**Dane zewnętrzne** (JSON, API, pliki) ładuje HOST — przez `importData` w `public/config.json` lub przez store. Plugin CZYTA ze `store` i PISZE do `store`. Koniec.

**Dlaczego:** System pluginów istnieje jako guardrails — ograniczone API zapobiega halucynacjom kodu. Jeśli plugin może zrobić `fetch()`, to AI wpisze tam dowolny URL i obejdzie całą architekturę.

# Niezależność pluginów

Każdy plugin MUSI działać samodzielnie — brak innego pluginu to valid state, nie błąd.

# Config — public/config.json

```json
[
  {
    "pluginUri": "obieg-zero/plugin-nazwa@main",
    "importData": ["plik.json"],
    "defaultOptions": { "klucz": "wartość" }
  }
]
```

- `pluginUri`: `"obieg-zero/repo@branch"` (produkcja) lub `"./plugin-nazwa"` (dev lokalny)
- `importData`: pliki JSON z `public/` importowane do store (jednorazowo)
- `defaultOptions`: opcje zapisywane do store przy pierwszym uruchomieniu
