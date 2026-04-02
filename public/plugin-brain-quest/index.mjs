import { jsx, jsxs } from "react/jsx-runtime";
const GH_API = "https://api.github.com";
const GH_RAW = "https://raw.githubusercontent.com";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useState, useMemo, useCallback, useRef, useEffect } = React;
  const { Award, Star, Check } = icons;
  store.registerType("tree", [
    { key: "title", label: "Tytuł", required: true },
    { key: "branches", label: "Gałęzie" },
    { key: "edges", label: "Krawędzie" },
    { key: "source", label: "Źródło" },
    { key: "files", label: "Pliki" }
  ], "Drzewa wiedzy");
  store.registerType("node", [
    { key: "nodeId", label: "ID", required: true },
    { key: "title", label: "Tytuł", required: true },
    { key: "branch", label: "Gałąź" },
    { key: "tier", label: "Poziom" },
    { key: "hits", label: "Odkrycia" }
  ], "Węzły");
  store.registerType("content", [
    { key: "contentType", label: "Typ", required: true },
    { key: "text", label: "Tekst", required: true },
    { key: "answer", label: "Odpowiedź" }
  ], "Treści");
  store.registerType("lexicon", [
    { key: "term", label: "Termin", required: true },
    { key: "forms", label: "Formy" },
    { key: "definition", label: "Definicja", required: true },
    { key: "example", label: "Przykład" },
    { key: "category", label: "Kategoria" }
  ], "Leksykon");
  store.registerType("context", [
    { key: "ctxType", label: "Typ", required: true },
    { key: "title", label: "Tytuł", required: true },
    { key: "lexiconIds", label: "Terminy" },
    { key: "contextData", label: "Dane" }
  ], "Konteksty");
  store.registerType("discovery", [
    { key: "termId", label: "Termin", required: true },
    { key: "hits", label: "Odkrycia" },
    { key: "firstSeen", label: "Pierwsze" },
    { key: "lastSeen", label: "Ostatnie" }
  ], "Odkrycia");
  const useNav = sdk.create(() => ({
    treeId: null,
    sel: null
  }));
  const str = (n) => Math.min((Number(n.data.hits) || 0) / 5, 1);
  const jparse = (s, fb) => {
    try {
      return JSON.parse(s);
    } catch {
      return fb;
    }
  };
  const importPack = (text, source) => {
    const d = JSON.parse(text);
    if (d.nodes && d.edges) {
      const count = store.importJSON([{
        type: "tree",
        data: {
          title: d.title || d.id,
          branches: JSON.stringify(d.branches || {}),
          edges: JSON.stringify(d.edges),
          source: source || "",
          files: JSON.stringify(d.files || {})
        },
        children: d.nodes.map((n) => ({ type: "node", data: { nodeId: n.id, title: n.title, branch: n.branch || "", tier: n.tier ?? 0, hits: 0 } }))
      }]);
      sdk.log(`Drzewo "${d.title}" — ${count} rekordów`, "ok");
    }
    if (d.content) {
      const all = store.getPosts("node");
      let c = 0;
      for (const [nid, items] of Object.entries(d.content)) {
        const node = all.find((n) => n.data.nodeId === nid);
        if (!node) continue;
        for (const it of items) {
          store.add("content", { contentType: it.type, text: it.text, answer: it.answer || "" }, { parentId: node.id });
          c++;
        }
      }
      sdk.log(`Kontent "${d.title}" — ${c} elementów`, "ok");
    }
  };
  const fetchedFiles = /* @__PURE__ */ new Set();
  const fetchContentForNode = async (nodeId, treeId) => {
    const tree = store.get(treeId);
    if (!tree) return;
    const source = String(tree.data.source || "");
    if (!source) return;
    const filesMap = jparse(String(tree.data.files || "{}"), {});
    for (const [file, nodeIds] of Object.entries(filesMap)) {
      if (!nodeIds.includes(nodeId)) continue;
      const key = `${source}/${file}`;
      if (fetchedFiles.has(key)) continue;
      fetchedFiles.add(key);
      try {
        const r = await fetch(`${GH_RAW}/${source}/main/${file}`);
        if (!r.ok) throw new Error(`${r.status}`);
        importPack(await r.text());
        sdk.log(`Pobrano: ${file}`, "ok");
      } catch (e) {
        sdk.log(`Błąd pobierania ${file}: ${e}`, "error");
      }
    }
  };
  function SkillTree() {
    const { treeId, sel } = useNav();
    const tree = store.usePost(treeId || "");
    const nodes = store.useChildren(treeId || "", "node");
    const edges = useMemo(() => tree ? jparse(String(tree.data.edges || "[]"), []) : [], [tree]);
    const branches = useMemo(() => tree ? jparse(String(tree.data.branches || "{}"), {}) : {}, [tree]);
    const adj = useMemo(() => {
      const a = /* @__PURE__ */ new Map();
      for (const e of edges) {
        if (!a.has(e.from)) a.set(e.from, /* @__PURE__ */ new Set());
        if (!a.has(e.to)) a.set(e.to, /* @__PURE__ */ new Set());
        a.get(e.from).add(e.to);
        a.get(e.to).add(e.from);
      }
      return a;
    }, [edges]);
    const { visible, frontier, discovered } = useMemo(() => {
      const disc = /* @__PURE__ */ new Set();
      for (const n of nodes) if (Number(n.data.hits) > 0) disc.add(String(n.data.nodeId));
      if (!disc.size) {
        const root = [...nodes].sort((a, b) => Number(a.data.tier) - Number(b.data.tier))[0];
        if (root) return { visible: /* @__PURE__ */ new Set([String(root.data.nodeId)]), frontier: /* @__PURE__ */ new Set([String(root.data.nodeId)]), discovered: disc };
        return { visible: /* @__PURE__ */ new Set(), frontier: /* @__PURE__ */ new Set(), discovered: disc };
      }
      const vis = new Set(disc);
      const front = /* @__PURE__ */ new Set();
      for (const nid of disc) for (const nb of adj.get(nid) || []) if (!disc.has(nb)) {
        vis.add(nb);
        front.add(nb);
      }
      return { visible: vis, frontier: front, discovered: disc };
    }, [nodes, adj]);
    const rootNid = useMemo(() => {
      const sorted = [...nodes].sort((a, b) => Number(a.data.tier) - Number(b.data.tier));
      return sorted[0] ? String(sorted[0].data.nodeId) : null;
    }, [nodes]);
    const layout = useMemo(() => {
      const pos = /* @__PURE__ */ new Map();
      if (!rootNid) return pos;
      const cx = 0, cy = 0;
      pos.set(rootNid, { x: cx, y: cy });
      const dist = /* @__PURE__ */ new Map();
      dist.set(rootNid, 0);
      const par = /* @__PURE__ */ new Map();
      const queue = [rootNid];
      while (queue.length) {
        const cur = queue.shift();
        for (const nb of adj.get(cur) || [])
          if (!dist.has(nb)) {
            dist.set(nb, dist.get(cur) + 1);
            par.set(nb, cur);
            queue.push(nb);
          }
      }
      const layer1 = [...dist.entries()].filter(([, d]) => d === 1).map(([n]) => n);
      const r1 = 150;
      layer1.forEach((nid, i) => {
        const a = i / layer1.length * Math.PI * 2 - Math.PI / 2;
        pos.set(nid, { x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1 });
      });
      for (let layer = 2; layer <= 10; layer++) {
        const nids = [...dist.entries()].filter(([, d]) => d === layer).map(([n]) => n);
        for (const nid of nids) {
          const p = par.get(nid);
          const pp = p ? pos.get(p) : null;
          if (!pp) continue;
          const dx = pp.x - cx, dy = pp.y - cy, angle = Math.atan2(dy, dx);
          const sibs = nids.filter((s) => par.get(s) === p);
          const si = sibs.indexOf(nid);
          const spread = sibs.length > 1 ? (si - (sibs.length - 1) / 2) * 0.35 : 0;
          const r = Math.sqrt(dx * dx + dy * dy) + r1 * 0.8;
          pos.set(nid, { x: cx + Math.cos(angle + spread) * r, y: cy + Math.sin(angle + spread) * r });
        }
      }
      return pos;
    }, [rootNid, adj]);
    const focusNid = sel ? (() => {
      const n = store.get(sel);
      return n ? String(n.data.nodeId) : rootNid;
    })() : rootNid;
    const snapTo = layout.get(focusNid || "") || { x: 0, y: 0 };
    const svgRef = useRef(null);
    const camRef = useRef({ x: snapTo.x, y: snapTo.y });
    const dragRef = useRef(null);
    const viewR = 300;
    const prevSel = useRef(sel);
    if (sel !== prevSel.current) {
      prevSel.current = sel;
      camRef.current = { x: snapTo.x, y: snapTo.y };
    }
    const setVB = () => {
      var _a;
      const c = camRef.current;
      (_a = svgRef.current) == null ? void 0 : _a.setAttribute("viewBox", `${c.x - viewR} ${c.y - viewR} ${viewR * 2} ${viewR * 2}`);
    };
    useEffect(setVB, [sel]);
    const vb = `${camRef.current.x - viewR} ${camRef.current.y - viewR} ${viewR * 2} ${viewR * 2}`;
    const onDown = useCallback((e) => {
      const svg = e.currentTarget, rect = svg.getBoundingClientRect();
      const scale = viewR * 2 / rect.width;
      dragRef.current = { sx: e.clientX, sy: e.clientY, cx: camRef.current.x, cy: camRef.current.y };
      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d) return;
        camRef.current = { x: d.cx - (ev.clientX - d.sx) * scale, y: d.cy - (ev.clientY - d.sy) * scale };
        setVB();
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }, []);
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz drzewo z listy" });
    if (!nodes.length) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Zaimportuj paczkę bazową" });
    const visNodes = nodes.filter((n) => visible.has(String(n.data.nodeId)));
    const visEdges = edges.filter((e) => visible.has(e.from) && visible.has(e.to));
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(
        "svg",
        {
          ref: svgRef,
          viewBox: vb,
          style: { width: "100%", maxHeight: "75vh", cursor: "grab", userSelect: "none" },
          onMouseDown: onDown,
          children: [
            visEdges.map((e, i) => {
              const f = layout.get(e.from), t = layout.get(e.to);
              return f && t ? /* @__PURE__ */ jsx("line", { x1: f.x, y1: f.y, x2: t.x, y2: t.y, stroke: "#475569", strokeWidth: 1.5, opacity: 0.3 }, i) : null;
            }),
            visNodes.map((n) => {
              var _a;
              const nid = String(n.data.nodeId), p = layout.get(nid);
              if (!p) return null;
              const s = str(n), disc = discovered.has(nid), front = frontier.has(nid), mast = s >= 1;
              const r = mast ? 26 : disc ? 22 : 16;
              const bc = ((_a = branches[String(n.data.branch)]) == null ? void 0 : _a.color) || "#64748b";
              const fill = mast ? bc : disc ? bc + "80" : "#1e293b";
              return /* @__PURE__ */ jsxs("g", { onClick: () => {
                useNav.setState({ sel: n.id });
                sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: n.id } });
                if (!disc) {
                  fetchContentForNode(nid, treeId);
                  sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: n.id, challenge: true } });
                  sdk.useHostStore.setState({ activeId: "plugin-brain-quest-arena" });
                }
              }, style: { cursor: "pointer" }, children: [
                focusNid === nid && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: r + 8, fill: "none", stroke: "#fff", strokeWidth: 1, opacity: 0.3 }),
                sel === n.id && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: r + 5, fill: "none", stroke: "#fff", strokeWidth: 2 }),
                /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r, fill, stroke: mast ? "#fff" : front ? bc + "40" : bc, strokeWidth: 1.5 }),
                front && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: r + 3, fill: "none", stroke: bc, strokeWidth: 1, strokeDasharray: "4 3", opacity: 0.5 }),
                /* @__PURE__ */ jsx("text", { x: p.x, y: p.y + 5, textAnchor: "middle", fill: disc ? "#fff" : "#64748b", fontSize: mast ? 14 : 10, children: mast ? "★" : disc ? Number(n.data.hits) : "?" }),
                /* @__PURE__ */ jsx("text", { x: p.x, y: p.y + r + 14, textAnchor: "middle", fill: disc ? "#e2e8f0" : "#475569", fontSize: 10, children: disc ? String(n.data.title).slice(0, 16) : "???" })
              ] }, n.id);
            })
          ]
        }
      ),
      sel && /* @__PURE__ */ jsx(NodeDetail, { id: sel })
    ] });
  }
  function NodeDetail({ id }) {
    const node = store.usePost(id);
    const contents = store.useChildren(id, "content");
    if (!node) return null;
    const s = str(node);
    return /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        /* @__PURE__ */ jsx(ui.Text, { bold: true, children: String(node.data.title) }),
        /* @__PURE__ */ jsx(ui.Badge, { children: s >= 1 ? "★ Opanowane" : s > 0 ? "Odkryte" : "Nieznane" })
      ] }),
      contents.map((c) => /* @__PURE__ */ jsx(ui.Text, { size: "sm", muted: true, children: String(c.data.text) }, c.id)),
      !contents.length && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "Brak treści" }),
      /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
        /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => {
          sdk.shared.setState({ bq: { treeId: useNav.getState().treeId, nodeId: String(node.data.nodeId), postId: id, challenge: true } });
          sdk.useHostStore.setState({ activeId: "plugin-brain-quest-arena" });
        }, children: "Trenuj w Arenie" }),
        /* @__PURE__ */ jsx(ui.Button, { size: "xs", outline: true, onClick: () => sdk.useHostStore.setState({ activeId: "plugin-brain-quest-reader" }), children: "Czytaj" })
      ] })
    ] }) });
  }
  const DEFAULT_ORG = "BrainEduPlay";
  const fetchLexicon = async (source, treeId) => {
    for (const file of ["lexicon.json", "knowledge.json"]) {
      try {
        const r = await fetch(`${GH_RAW}/${source}/main/${file}`);
        if (!r.ok) continue;
        const packs = JSON.parse(await r.text());
        let totalLex = 0;
        for (const pack of Array.isArray(packs) ? packs : [packs]) {
          const categories = /* @__PURE__ */ new Map();
          for (const lex of pack.lexicon || []) {
            const rec = store.add("lexicon", {
              term: lex.term,
              forms: JSON.stringify(lex.forms || []),
              definition: lex.definition,
              example: lex.example || "",
              category: lex.category || ""
            }, { parentId: treeId });
            const cat = lex.category || "inne";
            if (!categories.has(cat)) categories.set(cat, []);
            categories.get(cat).push(rec.id);
            totalLex++;
          }
          for (const [cat, ids] of categories) {
            store.add("context", {
              ctxType: cat,
              title: cat.charAt(0).toUpperCase() + cat.slice(1),
              lexiconIds: JSON.stringify(ids),
              contextData: "{}"
            }, { parentId: treeId });
          }
        }
        if (totalLex) sdk.log(`Leksykon: ${totalLex} terminów`, "ok");
        return;
      } catch {
      }
    }
  };
  const loadTree = async (org, repo) => {
    try {
      const r = await fetch(`${GH_RAW}/${org}/${repo}/main/index.json`);
      if (!r.ok) throw new Error(`GitHub: ${r.status}`);
      importPack(await r.text(), `${org}/${repo}`);
      const trees = store.getPosts("tree");
      const tree = trees.find((t) => t.data.source === `${org}/${repo}`);
      if (tree) fetchLexicon(`${org}/${repo}`, tree.id);
    } catch (e) {
      sdk.log(String(e), "error");
    }
  };
  function RepoPicker() {
    const org = store.useOption("bq:githubOrg") || DEFAULT_ORG;
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      fetch(`${GH_API}/search/repositories?q=org:${org}+topic:brainquest&per_page=100`).then((r) => r.ok ? r.json() : Promise.reject(r.status)).then((d) => setRepos(d.items.sort((a, b) => a.name.localeCompare(b.name)))).catch((e) => sdk.log(`GitHub: ${e}`, "error")).finally(() => setLoading(false));
    }, [org]);
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: "Wybierz przedmiot", subtitle: "Kliknij aby rozpocząć naukę" }),
      loading && /* @__PURE__ */ jsx(ui.Spinner, {}),
      repos.map((r) => /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Text, { bold: true, children: r.description || r.name }),
          /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: r.name })
        ] }),
        /* @__PURE__ */ jsx(ui.Button, { color: "primary", onClick: () => loadTree(org, r.name), children: "Rozpocznij" })
      ] }) }, r.name)),
      !loading && !repos.length && /* @__PURE__ */ jsx(ui.Text, { muted: true, children: "Brak dostępnych przedmiotów" })
    ] }) });
  }
  function TreeItem({ tree, active }) {
    const nodes = store.useChildren(tree.id, "node");
    const d = nodes.filter((n) => Number(n.data.hits) > 0).length;
    return /* @__PURE__ */ jsx(
      ui.ListItem,
      {
        active,
        label: String(tree.data.title),
        detail: `${d}/${nodes.length} odkryte`,
        onClick: () => useNav.setState({ treeId: tree.id, sel: null }),
        action: /* @__PURE__ */ jsx(ui.RemoveButton, { onClick: () => {
          store.remove(tree.id);
          if (active) useNav.setState({ treeId: null, sel: null });
        } })
      }
    );
  }
  function TreeList() {
    const { treeId } = useNav();
    const trees = store.usePosts("tree");
    if (!trees.length) return null;
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: "Drzewa wiedzy" }),
      trees.map((t) => /* @__PURE__ */ jsx(TreeItem, { tree: t, active: treeId === t.id }, t.id))
    ] }) });
  }
  function Progress() {
    const { treeId } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz drzewo" });
    const d = nodes.filter((n) => Number(n.data.hits) > 0);
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { label: "Odkryte", value: `${d.length}/${nodes.length}` }),
        /* @__PURE__ */ jsx(ui.Stat, { label: "Opanowane", value: nodes.filter((n) => str(n) >= 1).length })
      ] }),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      d.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).map((n) => /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
        str(n) >= 1 ? /* @__PURE__ */ jsx(Star, { size: 12 }) : /* @__PURE__ */ jsx(Check, { size: 12 }),
        /* @__PURE__ */ jsx(ui.Text, { size: "sm", children: String(n.data.title) })
      ] }, n.id))
    ] }) });
  }
  function Center() {
    const { treeId } = useNav();
    const trees = store.usePosts("tree");
    if (!treeId && !trees.length) return /* @__PURE__ */ jsx(RepoPicker, {});
    if (!treeId && trees.length) {
      useNav.setState({ treeId: trees[0].id });
      return null;
    }
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(ui.Stack, { children: /* @__PURE__ */ jsx(SkillTree, {}) }) });
  }
  sdk.registerView("bq.left", { slot: "left", component: TreeList });
  sdk.registerView("bq.center", { slot: "center", component: Center });
  sdk.registerView("bq.right", { slot: "right", component: Progress });
  return { id: "plugin-brain-quest", label: "BrainQuest", icon: Award, version: "0.3.0" };
};
export {
  plugin as default
};
