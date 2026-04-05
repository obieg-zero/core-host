import { jsx, jsxs, Fragment } from "react/jsx-runtime";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useState, useEffect, useMemo } = React;
  const { Database, Link, GitMerge, File: FileIcon, Paperclip } = icons;
  const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v);
  const resolveLabel = (id) => {
    var _a, _b;
    const ref = store.get(id);
    if (!ref) return null;
    const td = store.getType(ref.type);
    if (td) {
      const labelKey = ((_a = td.schema.find((f) => f.required)) == null ? void 0 : _a.key) || ((_b = td.schema[0]) == null ? void 0 : _b.key);
      if (labelKey && ref.data[labelKey]) return String(ref.data[labelKey]);
    }
    return ref.id.slice(0, 8);
  };
  const formatValue = (f, val) => {
    var _a;
    if (val == null || val === "") return { node: "", isRef: false };
    if (((_a = f.inputType) == null ? void 0 : _a.startsWith("select:")) || typeof val === "string" && isUuid(val)) {
      const label = resolveLabel(String(val));
      if (label) return { node: label, isRef: true };
    }
    if (Array.isArray(val)) return { node: `[${val.length}]`, isRef: false };
    if (typeof val === "object") return { node: JSON.stringify(val), isRef: false };
    return { node: String(val), isRef: false };
  };
  function RecordForm({ schema, initial, onSubmit, onCancel }) {
    const defaults = {};
    schema.forEach((f) => {
      defaults[f.key] = (initial == null ? void 0 : initial[f.key]) ?? "";
    });
    const [form, setForm] = useState(defaults);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const complete = schema.filter((f) => f.required).every((f) => !!form[f.key]);
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      schema.map((f) => {
        var _a;
        if ((_a = f.inputType) == null ? void 0 : _a.startsWith("select:")) {
          const refType = f.inputType.split(":")[1];
          const options = store.usePosts(refType).map((r) => {
            const label = resolveLabel(r.id);
            return { value: r.id, label: label || r.id };
          });
          return /* @__PURE__ */ jsx(ui.Field, { label: f.label, required: f.required, children: options.length > 0 ? /* @__PURE__ */ jsx(ui.Select, { value: form[f.key], options: [{ value: "", label: "— wybierz —" }, ...options], onChange: (e) => set(f.key, e.target.value) }) : /* @__PURE__ */ jsx(ui.Input, { value: form[f.key], onChange: (e) => set(f.key, e.target.value), placeholder: "Wpisz ręcznie" }) }, f.key);
        }
        return /* @__PURE__ */ jsx(ui.Field, { label: f.label, required: f.required, children: /* @__PURE__ */ jsx(ui.Input, { value: form[f.key], type: f.inputType, onChange: (e) => set(f.key, e.target.value) }) }, f.key);
      }),
      /* @__PURE__ */ jsxs(ui.Row, { justify: "end", children: [
        onCancel && /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: onCancel, children: "Anuluj" }),
        /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => onSubmit(form), disabled: !complete, children: initial ? "Zapisz" : "Dodaj" })
      ] })
    ] });
  }
  function CrudList({ type, schema, selectedId, onSelect, onAdd }) {
    const records = store.usePosts(type);
    const canParse = sdk.getParsers(type).length > 0;
    const recordIds = useMemo(() => records.map((r) => r.id).join(), [records]);
    const [filesMap, setFilesMap] = useState({});
    useEffect(() => {
      const ids = records.map((r) => r.id);
      Promise.all(ids.map((id) => store.listFiles(id).then((f) => [id, f.length > 0]))).then((pairs) => setFilesMap(Object.fromEntries(pairs)));
    }, [recordIds]);
    const hasFiles = Object.values(filesMap).some(Boolean);
    const hasParent = records.some((r) => r.parentId);
    const tableSchema = schema.slice(0, 3);
    const columns = useMemo(() => [
      ...hasParent ? [{ key: "_parent", header: "Rodzic" }] : [],
      ...tableSchema.map((f) => ({ key: f.key, header: f.label })),
      ...hasFiles ? [{ key: "_files", header: "" }] : []
    ], [hasParent, hasFiles, tableSchema]);
    const rows = useMemo(() => records.map((r) => {
      const row = {};
      if (hasParent) {
        row._parent = r.parentId ? /* @__PURE__ */ jsxs(ui.Row, { gap: "xs", children: [
          /* @__PURE__ */ jsx(GitMerge, { size: 12 }),
          /* @__PURE__ */ jsx("span", { children: resolveLabel(r.parentId) || "—" })
        ] }) : "";
      }
      for (const f of tableSchema) {
        const { node, isRef } = formatValue(f, r.data[f.key]);
        row[f.key] = isRef ? /* @__PURE__ */ jsxs(ui.Row, { gap: "xs", children: [
          /* @__PURE__ */ jsx(Link, { size: 12 }),
          /* @__PURE__ */ jsx("span", { children: node })
        ] }) : node;
      }
      if (hasFiles) row._files = filesMap[r.id] ? /* @__PURE__ */ jsx(Paperclip, { size: 12 }) : "";
      return { ...row, _id: r.id };
    }), [records, hasParent, hasFiles, filesMap]);
    const activeRow = records.findIndex((r) => r.id === selectedId);
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "xs", children: [
          records.length,
          " rekordów"
        ] }),
        /* @__PURE__ */ jsxs(ui.Row, { children: [
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: onAdd, children: "+ Dodaj" }),
          canParse && /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: () => importTyped(type), children: "Import" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        ui.Table,
        {
          columns,
          rows,
          pageSize: 20,
          empty: "Brak danych",
          activeRow: activeRow >= 0 ? activeRow : void 0,
          onRowClick: (i) => {
            var _a;
            return onSelect(((_a = records[i]) == null ? void 0 : _a.id) ?? null);
          }
        }
      )
    ] });
  }
  const useData = sdk.create(() => ({
    activeTab: null,
    selectedId: null,
    mode: "list"
  }));
  function CrudView() {
    var _a;
    const { activeTab, selectedId, mode } = useData();
    const types = store.getTypes();
    const tabs = types.map((t) => ({ type: t.type, label: t.label || t.type }));
    const tab = activeTab || ((_a = tabs[0]) == null ? void 0 : _a.type) || null;
    const typeDef = tab ? store.getType(tab) : null;
    const selectTab = (type) => useData.setState({ activeTab: type, selectedId: null, mode: "list" });
    const allTabs = [...tabs.map((t) => ({ id: t.type, label: t.label })), { id: "_options", label: "Opcje" }];
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      allTabs.length > 0 && /* @__PURE__ */ jsx(ui.Tabs, { variant: "lift", tabs: allTabs, active: tab || "", onChange: (t) => t === "_options" ? useData.setState({ activeTab: "_options", selectedId: null, mode: "list" }) : selectTab(t) }),
      tab === "_options" && /* @__PURE__ */ jsx(OptionsPanel, {}),
      tab && tab !== "_options" && typeDef && /* @__PURE__ */ jsx(
        CrudList,
        {
          type: tab,
          schema: typeDef.schema,
          selectedId,
          onSelect: (id) => useData.setState({ selectedId: id, mode: "list" }),
          onAdd: () => useData.setState({ mode: "add", selectedId: null })
        }
      ),
      tab && tab !== "_options" && typeDef && mode === "add" && /* @__PURE__ */ jsx(
        RecordForm,
        {
          schema: typeDef.schema,
          onSubmit: (data) => {
            store.add(tab, data);
            useData.setState({ mode: "list" });
            sdk.log("Dodano rekord", "ok");
          },
          onCancel: () => useData.setState({ mode: "list" })
        }
      )
    ] }) });
  }
  function FileList({ postId }) {
    const [files, setFiles] = useState([]);
    useEffect(() => {
      store.listFiles(postId).then(setFiles);
    }, [postId]);
    if (!files.length) return null;
    return /* @__PURE__ */ jsxs(ui.Stack, { gap: "sm", children: [
      /* @__PURE__ */ jsxs(ui.Row, { gap: "xs", children: [
        /* @__PURE__ */ jsx(Paperclip, { size: 10 }),
        /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
          "Pliki (",
          files.length,
          ")"
        ] })
      ] }),
      files.map((name) => /* @__PURE__ */ jsxs(ui.Row, { gap: "xs", children: [
        /* @__PURE__ */ jsx(FileIcon, { size: 12 }),
        /* @__PURE__ */ jsx(ui.Text, { size: "xs", children: name })
      ] }, name)),
      /* @__PURE__ */ jsx(ui.Divider, {})
    ] });
  }
  function DetailPanel() {
    var _a, _b, _c;
    const { selectedId, mode, activeTab } = useData();
    const types = store.getTypes();
    const tabs = types.map((t) => ({ type: t.type, label: t.label || t.type }));
    const tab = activeTab || ((_a = tabs[0]) == null ? void 0 : _a.type) || null;
    const typeDef = tab ? store.getType(tab) : null;
    const records = store.usePosts(tab || "");
    const record = records.find((r) => r.id === selectedId);
    if (!record || !typeDef) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz rekord z tabeli" });
    if (mode === "edit") {
      return /* @__PURE__ */ jsx(ui.Box, { header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Edycja" }), body: /* @__PURE__ */ jsx(
        RecordForm,
        {
          schema: typeDef.schema,
          initial: record.data,
          onSubmit: (data) => {
            store.update(record.id, data);
            useData.setState({ mode: "list" });
            sdk.log("Zapisano", "ok");
          },
          onCancel: () => useData.setState({ mode: "list" })
        }
      ) });
    }
    const nameKey = ((_b = typeDef.schema.find((f) => f.required)) == null ? void 0 : _b.key) || ((_c = typeDef.schema[0]) == null ? void 0 : _c.key);
    const title = nameKey ? String(record.data[nameKey] ?? "") : record.id.slice(0, 8);
    const detailFields = typeDef.schema.filter((f) => f.key !== nameKey);
    const parentInfo = record.parentId ? (() => {
      const parent = store.get(record.parentId);
      if (!parent) return null;
      const pt = store.getType(parent.type);
      const label = resolveLabel(parent.id);
      return { typeLabel: (pt == null ? void 0 : pt.label) || parent.type, label: label || parent.id.slice(0, 8) };
    })() : null;
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(
      ui.StageLayout,
      {
        top: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: new Date(record.createdAt).toLocaleDateString() }),
          /* @__PURE__ */ jsx(ui.Heading, { title, subtitle: typeDef.label }),
          parentInfo && /* @__PURE__ */ jsxs(ui.Row, { gap: "xs", children: [
            /* @__PURE__ */ jsx(GitMerge, { size: 10 }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              parentInfo.typeLabel,
              ": ",
              parentInfo.label
            ] })
          ] }),
          /* @__PURE__ */ jsx(ui.Divider, {}),
          detailFields.map((f) => {
            const val = record.data[f.key];
            if (!val && val !== 0) return null;
            const { node, isRef } = formatValue(f, val);
            return /* @__PURE__ */ jsxs(ui.Stack, { gap: "sm", children: [
              /* @__PURE__ */ jsxs(ui.Row, { gap: "xs", children: [
                isRef && /* @__PURE__ */ jsx(Link, { size: 10 }),
                /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: f.label })
              ] }),
              /* @__PURE__ */ jsx(ui.Text, { size: "xs", children: node }),
              /* @__PURE__ */ jsx(ui.Divider, {})
            ] }, f.key);
          }),
          /* @__PURE__ */ jsx(FileList, { postId: record.id })
        ] }),
        bottom: /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "error", outline: true, onClick: async () => {
            store.remove(record.id);
            useData.setState({ selectedId: null });
            sdk.log("Usunięto rekord", "ok");
          }, children: "Usuń" }),
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => useData.setState({ mode: "edit" }), children: "Edytuj" })
        ] })
      }
    ) });
  }
  async function importTyped(type) {
    const parserDefs = sdk.getParsers(type);
    const parser = parserDefs[0];
    const file = await sdk.openFileDialog((parser == null ? void 0 : parser.accept) || ".json");
    if (!file) return;
    if (parser) {
      const data = parser.parse(await file.text());
      if (!data.length) {
        sdk.log("Brak danych w pliku", "error");
        return;
      }
      const count = store.importJSON(data.map((d) => ({ type, data: d })));
      sdk.log(`Zaimportowano ${count} rekordów`, "ok");
    } else {
      try {
        const nodes = JSON.parse(await file.text());
        if (!Array.isArray(nodes)) {
          sdk.log("Oczekiwana tablica JSON", "error");
          return;
        }
        const count = store.importJSON(nodes);
        sdk.log(`Zaimportowano ${count} rekordów`, "ok");
      } catch (e) {
        sdk.log(`Błąd: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    }
  }
  function OptionsPanel() {
    const metas = store.usePosts("meta");
    const optKeys = metas.filter((m) => m.data.opt).map((m) => String(m.data.opt));
    const values = {};
    for (const k of optKeys) values[k] = store.useOption(k) ?? "";
    const isSecret = (k) => /key|secret|token|password/i.test(k);
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "xs", children: [
        "Opcje (",
        optKeys.length,
        ")"
      ] }),
      optKeys.map((k) => /* @__PURE__ */ jsx(ui.Field, { label: k, children: /* @__PURE__ */ jsx(
        ui.Input,
        {
          type: isSecret(k) ? "password" : "text",
          value: values[k],
          onChange: (e) => store.setOption(k, e.target.value)
        }
      ) }, k)),
      optKeys.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "Brak zarejestrowanych opcji. Opcje deklarują pluginy przez defaultOptions w config.json." })
    ] });
  }
  sdk.registerView("data.center", { slot: "center", component: CrudView });
  sdk.registerView("data.right", { slot: "right", component: DetailPanel });
  return { id: "plugin-data", label: "Dane", icon: Database, version: "0.3.0" };
};
export {
  plugin as default
};
