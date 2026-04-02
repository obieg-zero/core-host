import { jsx, jsxs, Fragment } from "react/jsx-runtime";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  const { Zap, Heart, Target, Award, RotateCcw, ArrowLeft } = icons;
  const HOLE_COUNT = 6;
  const ROUND_TIME = 60;
  const START_HP = 5;
  const WIN_THRESHOLD = 3;
  const discoverTerm = (termId) => {
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
  const backToTree = () => {
    var _a;
    const bq = (_a = sdk.shared.getState()) == null ? void 0 : _a.bq;
    if (bq) sdk.shared.setState({ bq: { ...bq, challenge: false } });
    sdk.useHostStore.setState({ activeId: "plugin-brain-quest" });
  };
  const freshGame = () => ({
    phase: "playing",
    score: 0,
    hp: START_HP,
    combo: 0,
    maxCombo: 0,
    timeLeft: ROUND_TIME,
    correct: 0,
    wrong: 0
  });
  const useGame = sdk.create(() => ({
    phase: "menu",
    mode: "whack-term",
    score: 0,
    hp: START_HP,
    combo: 0,
    maxCombo: 0,
    timeLeft: ROUND_TIME,
    correct: 0,
    wrong: 0
  }));
  const colors = {
    hole: "#1e293b",
    holeRim: "#334155",
    pop: "#3b82f6",
    popCorrect: "#22c55e",
    popWrong: "#ef4444",
    hp: "#ef4444",
    muted: "#64748b"
  };
  const useBq = () => sdk.shared((s) => s == null ? void 0 : s.bq);
  function Arena() {
    const bq = useBq();
    const treeId = (bq == null ? void 0 : bq.treeId) || "";
    const postId = (bq == null ? void 0 : bq.postId) || "";
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const lexicon = store.useChildren(treeId, "lexicon");
    const node = store.usePost(postId);
    const { phase } = useGame();
    const gameLexicon = useMemo(() => {
      if (!isChallenge || !node || lexicon.length < 4) return lexicon;
      const nodeTitle = String(node.data.title || "").toLowerCase();
      const nodeBranch = String(node.data.branch || "").toLowerCase();
      const filtered = lexicon.filter((l) => {
        const cat = String(l.data.category || "").toLowerCase();
        return cat && (nodeTitle.includes(cat) || nodeBranch.includes(cat) || cat.includes(nodeTitle) || cat.includes(nodeBranch));
      });
      return filtered.length >= 4 ? filtered : lexicon;
    }, [lexicon, node, isChallenge]);
    if (!treeId) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Otwórz BrainQuest i wybierz drzewo wiedzy" });
    if (gameLexicon.length < 4) return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Placeholder, { text: "Za mało terminów — załaduj drzewo w BrainQuest" }),
      /* @__PURE__ */ jsxs(ui.Button, { outline: true, onClick: backToTree, children: [
        /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }),
        " Wróć do drzewa"
      ] })
    ] }) });
    if (isChallenge && phase === "menu") return /* @__PURE__ */ jsx(ChallengeIntro, { node, lexicon: gameLexicon });
    if (phase === "menu") return /* @__PURE__ */ jsx(MenuScreen, { lexicon: gameLexicon });
    if (phase === "playing") return /* @__PURE__ */ jsx(GameScreen, { lexicon: gameLexicon });
    return /* @__PURE__ */ jsx(SummaryScreen, {});
  }
  function ChallengeIntro({ node, lexicon }) {
    const title = node ? String(node.data.title) : "???";
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "32px 0 16px" }, children: [
        /* @__PURE__ */ jsx(Target, { size: 48 }),
        /* @__PURE__ */ jsx(ui.Heading, { title })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { cursor: "pointer" }, onClick: () => useGame.setState(freshGame()), children: /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "24px 0" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "24px", fontWeight: 700, color: "#3b82f6", marginBottom: "8px" }, children: "DO BOJU!" }),
        /* @__PURE__ */ jsxs(ui.Text, { size: "sm", muted: true, children: [
          "Traf ",
          WIN_THRESHOLD,
          "x by odblokować"
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(ui.Row, { justify: "center", children: /* @__PURE__ */ jsxs(ui.Text, { size: "xs", muted: true, children: [
        lexicon.length,
        " terminów · ",
        START_HP,
        " żyć · ",
        ROUND_TIME,
        "s"
      ] }) }),
      /* @__PURE__ */ jsx(ui.Row, { justify: "center", children: /* @__PURE__ */ jsxs(ui.Button, { size: "xs", outline: true, onClick: backToTree, children: [
        /* @__PURE__ */ jsx(ArrowLeft, { size: 14 }),
        " Wróć"
      ] }) })
    ] }) });
  }
  function MenuScreen({ lexicon }) {
    const { mode } = useGame();
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "24px 0" }, children: [
        /* @__PURE__ */ jsx(Target, { size: 48 }),
        /* @__PURE__ */ jsx(ui.Heading, { title: "Whack-a-Term!", subtitle: "Trening wolny" })
      ] }),
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsx(ui.Text, { bold: true, children: "Tryb gry" }),
        /* @__PURE__ */ jsx(ui.Tabs, { tabs: [
          { id: "whack-term", label: "Definicja -> Termin" },
          { id: "whack-def", label: "Termin -> Definicja" }
        ], active: mode, onChange: (id) => useGame.setState({ mode: id }) })
      ] }) }),
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { label: "Terminy", value: lexicon.length }),
        /* @__PURE__ */ jsx(ui.Stat, { label: "Czas", value: `${ROUND_TIME}s` }),
        /* @__PURE__ */ jsx(ui.Stat, { label: "Życia", value: START_HP })
      ] }),
      /* @__PURE__ */ jsx(ui.Button, { color: "primary", onClick: () => useGame.setState(freshGame()), children: "Start!" })
    ] }) });
  }
  function GameScreen({ lexicon }) {
    const { score, hp, combo, timeLeft, mode } = useGame();
    const bq = useBq();
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const [holes, setHoles] = useState(() => Array(HOLE_COUNT).fill(null));
    const [question, setQuestion] = useState(null);
    const [shakeHole, setShakeHole] = useState(null);
    const gameActive = useRef(true);
    const timerRef = useRef(null);
    const usedRecently = useRef(/* @__PURE__ */ new Set());
    const pickRandom = useCallback(() => {
      const pool = lexicon.filter((l) => !usedRecently.current.has(l.id));
      const source = pool.length >= 4 ? pool : lexicon;
      return source[Math.floor(Math.random() * source.length)];
    }, [lexicon]);
    const endGame = useCallback((reason) => {
      gameActive.current = false;
      clearInterval(timerRef.current);
      const state = useGame.getState();
      if (isChallenge && state.correct >= WIN_THRESHOLD && (bq == null ? void 0 : bq.postId)) {
        unlockNode(bq.postId);
        sdk.log(`Węzeł odblokowany! (${state.correct} trafień)`, "ok");
      }
      useGame.setState({ phase: "summary", ...reason === "time" ? { timeLeft: 0 } : { hp: 0 } });
    }, [isChallenge, bq]);
    const nextQuestion = useCallback(() => {
      if (!gameActive.current) return;
      const correct = pickRandom();
      usedRecently.current.add(correct.id);
      if (usedRecently.current.size > Math.floor(lexicon.length * 0.6)) usedRecently.current.clear();
      const distractors = [...lexicon.filter((l) => l.id !== correct.id)].sort(() => Math.random() - 0.5).slice(0, HOLE_COUNT - 1);
      const allTerms = [correct, ...distractors].sort(() => Math.random() - 0.5);
      setQuestion({
        termId: correct.id,
        text: mode === "whack-term" ? String(correct.data.definition) : String(correct.data.term)
      });
      setHoles(Array(HOLE_COUNT).fill(null));
      const indices = Array.from({ length: HOLE_COUNT }, (_, i) => i).sort(() => Math.random() - 0.5);
      allTerms.forEach((t, i) => {
        if (i >= HOLE_COUNT) return;
        setTimeout(() => {
          if (!gameActive.current) return;
          setHoles((prev) => {
            const next = [...prev];
            next[indices[i]] = {
              termId: t.id,
              term: mode === "whack-term" ? String(t.data.term) : String(t.data.definition).slice(0, 50),
              visible: true,
              hit: false,
              wrong: false
            };
            return next;
          });
        }, 200 + Math.random() * 800);
      });
    }, [lexicon, mode, pickRandom]);
    const whack = useCallback((idx) => {
      const hole = holes[idx];
      if (!hole || !hole.visible || hole.hit || hole.wrong || !question) return;
      if (hole.termId === question.termId) {
        setHoles((prev) => {
          const n = [...prev];
          n[idx] = { ...hole, hit: true };
          return n;
        });
        const newCombo = useGame.getState().combo + 1;
        useGame.setState((s) => ({
          score: s.score + 10 * (1 + Math.floor(newCombo / 3)),
          combo: newCombo,
          maxCombo: Math.max(s.maxCombo, newCombo),
          correct: s.correct + 1
        }));
        discoverTerm(hole.termId);
        setTimeout(() => {
          if (gameActive.current) nextQuestion();
        }, 600);
      } else {
        setHoles((prev) => {
          const n = [...prev];
          n[idx] = { ...hole, wrong: true };
          return n;
        });
        setShakeHole(idx);
        setTimeout(() => setShakeHole(null), 400);
        const newHp = useGame.getState().hp - 1;
        if (newHp <= 0) {
          useGame.setState({ hp: 0, combo: 0, wrong: useGame.getState().wrong + 1 });
          endGame("dead");
        } else {
          useGame.setState((s) => ({ hp: newHp, combo: 0, wrong: s.wrong + 1 }));
        }
      }
    }, [holes, question, nextQuestion, endGame]);
    useEffect(() => {
      gameActive.current = true;
      nextQuestion();
      timerRef.current = setInterval(() => {
        const t = useGame.getState().timeLeft;
        if (t <= 1) {
          endGame("time");
          return;
        }
        useGame.setState({ timeLeft: t - 1 });
      }, 1e3);
      return () => {
        gameActive.current = false;
        clearInterval(timerRef.current);
      };
    }, []);
    const progress = isChallenge ? Math.min(useGame.getState().correct / WIN_THRESHOLD, 1) : null;
    const holeStyle = (hole, i) => ({
      width: "140px",
      height: "100px",
      background: !(hole == null ? void 0 : hole.visible) ? colors.hole : hole.hit ? colors.popCorrect : hole.wrong ? colors.popWrong : colors.pop,
      borderRadius: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: (hole == null ? void 0 : hole.visible) && !hole.hit && !hole.wrong ? "pointer" : "default",
      border: `3px solid ${!(hole == null ? void 0 : hole.visible) ? colors.holeRim : hole.hit ? "#16a34a" : hole.wrong ? "#dc2626" : "#2563eb"}`,
      transition: "all 0.15s ease",
      transform: shakeHole === i ? "translateX(4px)" : (hole == null ? void 0 : hole.visible) ? "scale(1.05)" : "scale(0.95)",
      opacity: (hole == null ? void 0 : hole.visible) ? 1 : 0.4,
      padding: "8px",
      textAlign: "center",
      userSelect: "none"
    });
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        /* @__PURE__ */ jsxs(ui.Row, { gap: "sm", children: [
          /* @__PURE__ */ jsxs(ui.Badge, { color: "warning", children: [
            score,
            " pkt"
          ] }),
          combo > 1 && /* @__PURE__ */ jsxs(ui.Badge, { color: "accent", children: [
            "x",
            combo,
            " combo!"
          ] })
        ] }),
        /* @__PURE__ */ jsxs(ui.Badge, { color: timeLeft <= 10 ? "error" : "info", children: [
          timeLeft,
          "s"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center" }, children: Array.from({ length: START_HP }, (_, i) => /* @__PURE__ */ jsx("span", { style: { color: i < hp ? colors.hp : colors.muted, margin: "0 1px" }, children: /* @__PURE__ */ jsx(Heart, { size: 18 }) }, i)) })
      ] }),
      progress !== null && /* @__PURE__ */ jsx("div", { style: { background: "#1e293b", borderRadius: "8px", height: "8px", overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { width: `${progress * 100}%`, height: "100%", background: progress >= 1 ? "#22c55e" : "#f59e0b", transition: "width 0.3s ease" } }) }),
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "8px" }, children: [
        /* @__PURE__ */ jsx(ui.Text, { size: "xs", muted: true, children: mode === "whack-term" ? "Znajdź termin:" : "Znajdź definicję:" }),
        /* @__PURE__ */ jsx(ui.Text, { bold: true, children: (question == null ? void 0 : question.text) || "..." })
      ] }) }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", padding: "16px 0" }, children: [0, 1].map((row) => /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "16px", justifyContent: "center" }, children: [0, 1, 2].map((col) => {
        const idx = row * 3 + col, hole = holes[idx];
        return /* @__PURE__ */ jsx("div", { style: holeStyle(hole, idx), onClick: () => whack(idx), children: (hole == null ? void 0 : hole.visible) ? /* @__PURE__ */ jsx("span", { style: { color: "#fff", fontSize: "13px", fontWeight: 600, lineHeight: 1.2 }, children: hole.term }) : /* @__PURE__ */ jsx("span", { style: { color: colors.muted, fontSize: "24px" }, children: "?" }) }, idx);
      }) }, row)) })
    ] }) });
  }
  function SummaryScreen() {
    const { score, correct, wrong, maxCombo, hp } = useGame();
    const bq = useBq();
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const won = correct >= WIN_THRESHOLD;
    const node = store.usePost((bq == null ? void 0 : bq.postId) || "");
    const nodeTitle = node ? String(node.data.title) : "";
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs("div", { style: { textAlign: "center", padding: "24px 0" }, children: [
        /* @__PURE__ */ jsx(Award, { size: 48 }),
        /* @__PURE__ */ jsx(
          ui.Heading,
          {
            title: isChallenge ? won ? "Odblokowano!" : "Spróbuj ponownie" : hp <= 0 ? "Koniec żyć!" : "Czas minął!",
            subtitle: isChallenge ? won ? `„${nodeTitle}" odblokowany!` : `Potrzeba ${WIN_THRESHOLD} trafień` : "Podsumowanie"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { label: "Wynik", value: score }),
        /* @__PURE__ */ jsx(ui.Stat, { label: "Trafione", value: correct, color: "success" }),
        /* @__PURE__ */ jsx(ui.Stat, { label: "Pudła", value: wrong, color: "error" }),
        /* @__PURE__ */ jsx(ui.Stat, { label: "Max combo", value: maxCombo })
      ] }),
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
          /* @__PURE__ */ jsx(ui.Text, { children: "Celność" }),
          /* @__PURE__ */ jsxs(ui.Text, { bold: true, children: [
            correct + wrong > 0 ? Math.round(correct / (correct + wrong) * 100) : 0,
            "%"
          ] })
        ] }),
        isChallenge && /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
          /* @__PURE__ */ jsx(ui.Text, { children: "Próg" }),
          /* @__PURE__ */ jsxs(ui.Badge, { color: won ? "success" : "error", children: [
            correct,
            "/",
            WIN_THRESHOLD
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(ui.Row, { gap: "sm", children: isChallenge ? /* @__PURE__ */ jsxs(Fragment, { children: [
        !won && /* @__PURE__ */ jsxs(ui.Button, { color: "primary", onClick: () => useGame.setState(freshGame()), children: [
          /* @__PURE__ */ jsx(RotateCcw, { size: 16 }),
          " Ponów"
        ] }),
        /* @__PURE__ */ jsxs(ui.Button, { color: won ? "primary" : void 0, outline: !won, onClick: () => {
          useGame.setState({ phase: "menu" });
          backToTree();
        }, children: [
          /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }),
          " Drzewo"
        ] })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs(ui.Button, { color: "primary", onClick: () => useGame.setState(freshGame()), children: [
          /* @__PURE__ */ jsx(RotateCcw, { size: 16 }),
          " Jeszcze raz!"
        ] }),
        /* @__PURE__ */ jsx(ui.Button, { outline: true, onClick: () => useGame.setState({ phase: "menu" }), children: "Menu" })
      ] }) })
    ] }) });
  }
  function Scoreboard() {
    const { phase, score, combo, correct } = useGame();
    const bq = useBq();
    const treeId = (bq == null ? void 0 : bq.treeId) || "";
    const isChallenge = !!(bq == null ? void 0 : bq.challenge);
    const node = store.usePost((bq == null ? void 0 : bq.postId) || "");
    const discoveries = store.usePosts("discovery");
    const lexicon = store.useChildren(treeId, "lexicon");
    const discoveredCount = useMemo(() => {
      const dset = new Set(discoveries.map((d) => String(d.data.termId)));
      return lexicon.filter((l) => dset.has(l.id)).length;
    }, [lexicon, discoveries]);
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: "Arena" }),
      isChallenge && node && /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsx(ui.Text, { size: "xs", muted: true, children: "Cel" }),
        /* @__PURE__ */ jsx(ui.Text, { bold: true, children: String(node.data.title) }),
        phase === "playing" && /* @__PURE__ */ jsxs(ui.Badge, { color: correct >= WIN_THRESHOLD ? "success" : "warning", children: [
          correct,
          "/",
          WIN_THRESHOLD
        ] })
      ] }) }),
      phase === "playing" && /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
          /* @__PURE__ */ jsx(ui.Text, { size: "sm", children: "Wynik" }),
          /* @__PURE__ */ jsx(ui.Text, { bold: true, children: score })
        ] }),
        /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
          /* @__PURE__ */ jsx(ui.Text, { size: "sm", children: "Combo" }),
          /* @__PURE__ */ jsxs(ui.Badge, { color: combo > 2 ? "accent" : "neutral", children: [
            "x",
            combo
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      /* @__PURE__ */ jsx(ui.Stats, { children: /* @__PURE__ */ jsx(ui.Stat, { label: "Odkryte terminy", value: `${discoveredCount}/${lexicon.length}` }) })
    ] }) });
  }
  sdk.registerView("bqa.center", { slot: "center", component: Arena });
  sdk.registerView("bqa.right", { slot: "right", component: Scoreboard });
  return { id: "plugin-brain-quest-arena", label: "BQ Arena", icon: Zap, version: "0.4.0" };
};
export {
  plugin as default
};
