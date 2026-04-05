import { jsx, jsxs, Fragment } from "react/jsx-runtime";
const GH_API = "https://api.github.com";
const GH_RAW = "https://raw.githubusercontent.com";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useState, useMemo, useCallback, useRef, useEffect } = React;
  const { Award, X, Zap } = icons;
  store.registerType("tree", [
    { key: "title", label: "Tytuł", required: true },
    { key: "branches", label: "Gałęzie" },
    { key: "edges", label: "Krawędzie" },
    { key: "repo", label: "Repo" }
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
    { key: "nodes", label: "Węzły", required: true },
    { key: "definition", label: "Definicja", required: true },
    { key: "quiz", label: "Quiz" },
    { key: "forms", label: "Formy" },
    { key: "category", label: "Kategoria" }
  ], "Leksykon");
  store.registerType("discovery", [
    { key: "termId", label: "Termin", required: true },
    { key: "hits", label: "Odkrycia" },
    { key: "firstSeen", label: "Pierwsze" },
    { key: "lastSeen", label: "Ostatnie" }
  ], "Odkrycia");
  const edgeStr = (disc) => {
    const hits = Number(disc.data.hits) || 0;
    const lastSeen = Number(disc.data.lastSeen) || Date.now();
    const days = (Date.now() - lastSeen) / 864e5;
    return Math.min(hits / 5, 1) * Math.exp(-0.1 * days);
  };
  const discover = (termId) => {
    const all = store.getPosts("discovery");
    const existing = all.find((d) => d.data.termId === termId);
    const now = Date.now();
    if (existing) {
      store.update(existing.id, { hits: (Number(existing.data.hits) || 0) + 1, lastSeen: now });
    } else {
      store.add("discovery", { termId, hits: 1, firstSeen: now, lastSeen: now });
    }
  };
  const unlockNode = (postId) => {
    const n = store.get(postId);
    if (n) store.update(postId, { hits: (Number(n.data.hits) || 0) + 1 });
  };
  const useNav = sdk.create(() => ({
    treeId: null,
    sel: null,
    phase: "map"
  }));
  const str = (n) => Math.min((Number(n.data.hits) || 0) / 5, 1);
  const jparse = (s, fb) => {
    try {
      return JSON.parse(s);
    } catch {
      return fb;
    }
  };
  function SkillTree() {
    const { treeId, sel, phase } = useNav();
    const tree = store.usePost(treeId || "");
    const nodes = store.useChildren(treeId || "", "node");
    const [revealed, setRevealed] = useState(() => /* @__PURE__ */ new Set());
    const flash = sdk.shared((s) => s == null ? void 0 : s.bqFlash);
    const [discoveredPairs, setDiscoveredPairs] = useState([]);
    useEffect(() => {
      if (!flash) return;
      const fromNode = nodes.find((n) => String(n.data.title) === flash.from);
      const toNode = nodes.find((n) => String(n.data.title) === flash.to);
      if (fromNode && toNode) {
        const fromNid = String(fromNode.data.nodeId);
        const toNid = String(toNode.data.nodeId);
        setDiscoveredPairs((prev) => {
          if (prev.some((p) => p.fromNid === fromNid && p.toNid === toNid || p.fromNid === toNid && p.toNid === fromNid))
            return prev.map((p) => p.fromNid === fromNid && p.toNid === toNid || p.fromNid === toNid && p.toNid === fromNid ? { ...p, fresh: true } : p);
          return [...prev.map((p) => ({ ...p, fresh: false })), { fromNid, toNid, fresh: true }];
        });
        sdk.shared.setState({ bqFlash: null });
      }
    }, [flash]);
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
    const discoveries = store.usePosts("discovery");
    const terms = store.useChildren(treeId || "", "lexicon");
    const contextEdges = useMemo(() => {
      const discoveredTermIds = new Set(discoveries.map((d) => String(d.data.termId)));
      if (!discoveredTermIds.size) return [];
      const pairs = [];
      const seen = /* @__PURE__ */ new Set();
      for (const term of terms) {
        if (!discoveredTermIds.has(term.id)) continue;
        const termNodes = jparse(String(term.data.nodes || "[]"), []);
        if (termNodes.length < 2) continue;
        for (let i = 0; i < termNodes.length; i++)
          for (let j = i + 1; j < termNodes.length; j++) {
            if (!visible.has(termNodes[i]) || !visible.has(termNodes[j])) continue;
            const key = [termNodes[i], termNodes[j]].sort().join(":");
            if (seen.has(key)) continue;
            seen.add(key);
            pairs.push({ from: termNodes[i], to: termNodes[j], strength: 0.6 });
          }
      }
      return pairs;
    }, [discoveries, terms, visible]);
    const C = {
      bg: "var(--color-base-200)",
      edge: "var(--color-base-content)",
      warn: "var(--color-warning)",
      text: "var(--color-base-content)",
      ring: "var(--color-base-content)",
      muted: "var(--color-base-300)"
    };
    const focusNid = sel ? (() => {
      const n = store.get(sel);
      return n ? String(n.data.nodeId) : rootNid;
    })() : rootNid;
    const snapTo = layout.get(focusNid || "") || { x: 0, y: 0 };
    const svgRef = useRef(null);
    const camRef = useRef({ x: snapTo.x, y: snapTo.y });
    const dragRef = useRef(null);
    const viewR = 300;
    const setVB = () => {
      var _a;
      const c = camRef.current;
      (_a = svgRef.current) == null ? void 0 : _a.setAttribute("viewBox", `${c.x - viewR} ${c.y - viewR} ${viewR * 2} ${viewR * 2}`);
    };
    const animRef = useRef(0);
    const prevSel = useRef(sel);
    if (sel !== prevSel.current) {
      prevSel.current = sel;
      const from = { ...camRef.current }, to = snapTo;
      cancelAnimationFrame(animRef.current);
      let t = 0;
      const step = () => {
        t = Math.min(t + 0.06, 1);
        const e = t * (2 - t);
        camRef.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        setVB();
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    }
    useEffect(setVB, [sel]);
    const vb = `${camRef.current.x - viewR} ${camRef.current.y - viewR} ${viewR * 2} ${viewR * 2}`;
    const startDrag = useCallback((clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = viewR * 2 / rect.width;
      dragRef.current = { sx: clientX, sy: clientY, cx: camRef.current.x, cy: camRef.current.y };
      const move = (cx, cy) => {
        const d = dragRef.current;
        if (!d) return;
        camRef.current = { x: d.cx - (cx - d.sx) * scale, y: d.cy - (cy - d.sy) * scale };
        setVB();
      };
      const onMM = (ev) => move(ev.clientX, ev.clientY);
      const onTM = (ev) => {
        ev.preventDefault();
        move(ev.touches[0].clientX, ev.touches[0].clientY);
      };
      const up = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMM);
        window.removeEventListener("mouseup", up);
        window.removeEventListener("touchmove", onTM);
        window.removeEventListener("touchend", up);
      };
      window.addEventListener("mousemove", onMM);
      window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", onTM, { passive: false });
      window.addEventListener("touchend", up);
    }, [viewR]);
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz drzewo z listy" });
    if (!nodes.length) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Zaimportuj paczkę bazową" });
    const visNodes = nodes.filter((n) => visible.has(String(n.data.nodeId)));
    const visEdges = edges.filter((e) => visible.has(e.from) && visible.has(e.to));
    const isEmpty = !discovered.size;
    return /* @__PURE__ */ jsxs(
      "svg",
      {
        ref: svgRef,
        viewBox: vb,
        style: { width: "100%", height: "100%", cursor: "grab", userSelect: "none", display: "block", touchAction: "none" },
        onMouseDown: (e) => startDrag(e.clientX, e.clientY),
        onTouchStart: (e) => startDrag(e.touches[0].clientX, e.touches[0].clientY),
        children: [
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("filter", { id: "glow", children: [
            /* @__PURE__ */ jsx("feGaussianBlur", { stdDeviation: "3", result: "blur" }),
            /* @__PURE__ */ jsxs("feMerge", { children: [
              /* @__PURE__ */ jsx("feMergeNode", { in: "blur" }),
              /* @__PURE__ */ jsx("feMergeNode", { in: "SourceGraphic" })
            ] })
          ] }) }),
          isEmpty && /* @__PURE__ */ jsx("text", { x: camRef.current.x, y: camRef.current.y + 50, textAnchor: "middle", style: { fill: C.text, opacity: 0.3 }, fontSize: 12, children: "Kliknij węzeł aby rozpocząć" }),
          discoveredPairs.map((pair, i) => {
            const f = layout.get(pair.fromNid), t = layout.get(pair.toNid);
            if (!f || !t) return null;
            return /* @__PURE__ */ jsxs("g", { children: [
              /* @__PURE__ */ jsx(
                "line",
                {
                  x1: f.x,
                  y1: f.y,
                  x2: t.x,
                  y2: t.y,
                  style: { stroke: C.warn },
                  strokeWidth: pair.fresh ? 4 : 3,
                  opacity: pair.fresh ? 0.8 : 0.5,
                  filter: "url(#glow)",
                  children: pair.fresh && /* @__PURE__ */ jsx("animate", { attributeName: "opacity", values: "1;0.4;1;0.8", dur: "1s", repeatCount: "3", fill: "freeze" })
                }
              ),
              pair.fresh && /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsxs("circle", { cx: f.x, cy: f.y, r: 28, fill: "none", style: { stroke: C.warn }, strokeWidth: 2, children: [
                  /* @__PURE__ */ jsx("animate", { attributeName: "r", values: "25;35;28", dur: "1s", repeatCount: "3", fill: "freeze" }),
                  /* @__PURE__ */ jsx("animate", { attributeName: "opacity", values: "0.8;0.3;0.4", dur: "1s", repeatCount: "3", fill: "freeze" })
                ] }),
                /* @__PURE__ */ jsxs("circle", { cx: t.x, cy: t.y, r: 28, fill: "none", style: { stroke: C.warn }, strokeWidth: 2, children: [
                  /* @__PURE__ */ jsx("animate", { attributeName: "r", values: "25;35;28", dur: "1s", repeatCount: "3", fill: "freeze" }),
                  /* @__PURE__ */ jsx("animate", { attributeName: "opacity", values: "0.8;0.3;0.4", dur: "1s", repeatCount: "3", fill: "freeze" })
                ] })
              ] })
            ] }, `dp-${i}`);
          }),
          contextEdges.map((ce, i) => {
            const f = layout.get(ce.from), t = layout.get(ce.to);
            return f && t ? /* @__PURE__ */ jsx(
              "line",
              {
                x1: f.x,
                y1: f.y,
                x2: t.x,
                y2: t.y,
                style: { stroke: C.warn },
                strokeWidth: 2,
                opacity: ce.strength * 0.6,
                filter: "url(#glow)"
              },
              `ctx-${i}`
            ) : null;
          }),
          visEdges.map((e, i) => {
            const f = layout.get(e.from), t = layout.get(e.to);
            return f && t ? /* @__PURE__ */ jsx("line", { x1: f.x, y1: f.y, x2: t.x, y2: t.y, style: { stroke: C.edge }, strokeWidth: 1.5, opacity: 0.15 }, i) : null;
          }),
          visNodes.map((n) => {
            var _a;
            const nid = String(n.data.nodeId), p = layout.get(nid);
            if (!p) return null;
            const s = str(n), disc = discovered.has(nid), front = frontier.has(nid), mast = s >= 1;
            const r = mast ? 32 : disc ? 28 : 22;
            const bc = ((_a = branches[String(n.data.branch)]) == null ? void 0 : _a.color) || C.muted;
            const nodeFill = mast ? bc : disc ? bc : C.bg;
            return /* @__PURE__ */ jsxs("g", { onClick: () => {
              useNav.setState({ sel: n.id, phase: "detail" });
              sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: n.id } });
              setRevealed((prev) => new Set(prev).add(nid));
            }, style: { cursor: "pointer" }, children: [
              focusNid === nid && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: r + 8, fill: "none", style: { stroke: C.ring }, strokeWidth: 1, opacity: 0.3 }),
              sel === n.id && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: r + 5, fill: "none", style: { stroke: C.ring }, strokeWidth: 2 }),
              /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r, style: { fill: nodeFill, stroke: mast ? C.ring : front ? bc + "40" : bc }, strokeWidth: 1.5, children: disc && !mast && /* @__PURE__ */ jsx("animate", { attributeName: "r", values: `${r};${r + 2};${r}`, dur: "2s", repeatCount: "1" }) }),
              front && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: r + 3, fill: "none", style: { stroke: bc }, strokeWidth: 1, strokeDasharray: "4 3", opacity: 0.5 }),
              /* @__PURE__ */ jsx("text", { x: p.x, y: p.y + 5, textAnchor: "middle", style: { fill: disc ? C.ring : C.edge }, fontSize: mast ? 14 : 10, opacity: disc ? 1 : 0.4, children: mast ? "★" : disc ? Number(n.data.hits) : "?" }),
              /* @__PURE__ */ jsx("text", { x: p.x, y: p.y + r + 14, textAnchor: "middle", style: { fill: C.text }, fontSize: 10, opacity: disc ? 0.8 : revealed.has(nid) ? 0.5 : 0.3, children: disc || revealed.has(nid) ? String(n.data.title).slice(0, 16) : "???" })
            ] }, n.id);
          })
        ]
      }
    );
  }
  function NodeDetail({ id }) {
    const node = store.usePost(id);
    if (!node) return null;
    const s = str(node);
    const contents = store.useChildren(id, "content");
    const hasContent = contents.some((c) => String(c.data.contentType) !== "quiz");
    const slideCount = contents.filter((c) => String(c.data.contentType) !== "quiz").length;
    return /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        /* @__PURE__ */ jsx(ui.Heading, { title: String(node.data.title) }),
        /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
          /* @__PURE__ */ jsx(ui.Badge, { children: s >= 1 ? "★ Opanowane" : s > 0 ? "Odkryte" : "Nieznane" }),
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: () => useNav.setState({ phase: "map", sel: null }), children: /* @__PURE__ */ jsx(X, { size: 14 }) })
        ] })
      ] }),
      hasContent && /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "sm", children: [
        slideCount,
        " slajdów do przeczytania"
      ] }),
      /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsx(ui.Button, { size: "lg", color: "primary", block: true, onClick: () => {
          const treeId = useNav.getState().treeId;
          sdk.shared.setState({ bq: { treeId, nodeId: String(node.data.nodeId), postId: id } });
          sdk.useHostStore.setState({ activeId: "plugin-brain-quest-reader" });
        }, children: "Czytaj i odkrywaj" }),
        /* @__PURE__ */ jsxs(ui.Button, { size: "lg", color: "primary", outline: true, block: true, onClick: () => {
          const treeId = useNav.getState().treeId;
          sdk.shared.setState({ bq: { treeId, nodeId: String(node.data.nodeId), postId: id, challenge: true } });
          sdk.useHostStore.setState({ activeId: "plugin-brain-quest-arena" });
        }, children: [
          /* @__PURE__ */ jsx(Zap, { size: 14 }),
          " Arena"
        ] })
      ] })
    ] }) });
  }
  const DEFAULT_ORG = "BrainEduPlay";
  const loadLexicon = async (base, tree) => {
    const nodes = store.getPosts("node").filter((n) => n.parentId === tree.id);
    const fetches = nodes.map(async (n) => {
      try {
        const r = await fetch(`${base}/lexicon/${n.data.nodeId}.json`);
        if (!r.ok) return 0;
        const entries = JSON.parse(await r.text());
        let count = 0;
        const existing = store.getPosts("lexicon").filter((x) => x.parentId === tree.id);
        for (const l of entries) {
          if (existing.some((x) => String(x.data.term) === String(l.data.term))) continue;
          store.add(l.type, l.data, { parentId: tree.id });
          count++;
        }
        return count;
      } catch {
        return 0;
      }
    });
    const counts = await Promise.all(fetches);
    return counts.reduce((a, b) => a + b, 0);
  };
  const loadTree = async (org, repo) => {
    var _a, _b;
    try {
      const base = `${GH_RAW}/${org}/${repo}/main`;
      const treeRes = await fetch(`${base}/tree.json`);
      if (!treeRes.ok) throw new Error(`tree.json: ${treeRes.status}`);
      const treeSeeds = JSON.parse(await treeRes.text());
      const treeTitleFromSeed = ((_b = (_a = treeSeeds[0]) == null ? void 0 : _a.data) == null ? void 0 : _b.title) || "";
      const treeCount = store.importJSON(treeSeeds);
      const trees = store.getPosts("tree");
      const tree = trees.find((t) => String(t.data.title) === treeTitleFromSeed);
      if (tree) {
        const lexCount = await loadLexicon(base, tree);
        sdk.log(`${repo} — ${treeCount + lexCount} rekordów`, "ok");
        store.update(tree.id, { repo: `${org}/${repo}` });
      }
    } catch (e) {
      sdk.log(String(e), "error");
    }
  };
  const loadLexiconFromRepo = async (treeId, org, repo) => {
    const tree = store.get(treeId);
    if (!tree) return;
    const base = `${GH_RAW}/${org}/${repo}/main`;
    const count = await loadLexicon(base, tree);
    sdk.log(`${repo} — ${count} nowych terminów`, "ok");
  };
  const loadNodeContent = async (treeId, nodeId) => {
    const tree = store.get(treeId);
    if (!tree) return;
    const repo = String(tree.data.repo || "");
    if (!repo) return;
    const nodes = store.getPosts("node").filter((n) => n.parentId === treeId);
    const node = nodes.find((n) => String(n.data.nodeId) === nodeId);
    if (!node) return;
    const existing = store.getPosts("content").filter((c) => c.parentId === node.id);
    if (existing.length > 0) return;
    try {
      const r = await fetch(`${GH_RAW}/${repo}/main/content/${nodeId}.json`);
      if (!r.ok) return;
      const entries = JSON.parse(await r.text());
      for (const e of entries) {
        store.add(e.type, e.data, { parentId: node.id });
      }
    } catch (e) {
      sdk.log(`Content ${nodeId}: ${e}`, "error");
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
        onClick: () => useNav.setState({ treeId: tree.id, sel: null, phase: "map" }),
        action: /* @__PURE__ */ jsx(ui.RemoveButton, { onClick: () => {
          store.remove(tree.id);
          if (active) useNav.setState({ treeId: null, sel: null, phase: "map" });
        } })
      }
    );
  }
  function TreeList() {
    const { treeId } = useNav();
    const trees = store.usePosts("tree");
    if (!trees.length) return null;
    return /* @__PURE__ */ jsx(ui.Box, { header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Drzewa wiedzy" }), body: /* @__PURE__ */ jsx(ui.Stack, { children: trees.map((t) => /* @__PURE__ */ jsx(TreeItem, { tree: t, active: treeId === t.id }, t.id)) }), grow: true });
  }
  function Progress() {
    var _a;
    const navTreeId = useNav().treeId;
    const sharedTreeId = (_a = sdk.shared((s) => s == null ? void 0 : s.bq)) == null ? void 0 : _a.treeId;
    const treeId = navTreeId || sharedTreeId || "";
    const nodes = store.useChildren(treeId, "node");
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz drzewo" });
    const d = nodes.filter((n) => Number(n.data.hits) > 0);
    return /* @__PURE__ */ jsx(ui.Box, { header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Postęp" }), body: d.length === 0 ? /* @__PURE__ */ jsx(ui.Placeholder, { text: "Odkrywaj węzły na mapie", children: /* @__PURE__ */ jsx(Award, { size: 32 }) }) : /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { title: "Odkryte", value: `${d.length}/${nodes.length}` }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Opanowane", value: `${nodes.filter((n) => str(n) >= 1).length}` })
      ] }),
      d.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).map((n) => /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
        str(n) >= 1 ? /* @__PURE__ */ jsx(Award, { size: 12 }) : /* @__PURE__ */ jsx(Zap, { size: 12 }),
        /* @__PURE__ */ jsx(ui.Text, { size: "sm", children: String(n.data.title) })
      ] }, n.id))
    ] }), grow: true });
  }
  sdk.shared.setState({ bqHelpers: { discover, unlockNode, edgeStr, loadNodeContent, loadLexiconFromRepo, jparse, str, Progress } });
  function Center() {
    const { treeId, phase, sel } = useNav();
    const trees = store.usePosts("tree");
    useEffect(() => {
      if (!treeId && trees.length) useNav.setState({ treeId: trees[0].id });
    }, [treeId, trees.length]);
    if (!treeId && !trees.length) return /* @__PURE__ */ jsx(RepoPicker, {});
    if (!treeId) return null;
    return /* @__PURE__ */ jsxs("div", { style: { position: "relative", height: "100%", overflow: "hidden" }, children: [
      /* @__PURE__ */ jsx(SkillTree, {}),
      phase === "detail" && sel && /* @__PURE__ */ jsx("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0 }, children: /* @__PURE__ */ jsx(NodeDetail, { id: sel }) })
    ] });
  }
  sdk.registerView("bq.left", { slot: "left", component: TreeList });
  sdk.registerView("bq.center", { slot: "center", component: Center });
  sdk.registerView("bq.right", { slot: "right", component: Progress });
  return { id: "plugin-brain-quest", label: "BrainQuest", icon: Award, version: "0.4.0" };
};
export {
  plugin as default
};
