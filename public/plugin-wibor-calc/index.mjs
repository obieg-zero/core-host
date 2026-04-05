import { jsx, jsxs, Fragment } from "react/jsx-runtime";
const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 864e5);
const resolveWibor = (d, data) => {
  var _a;
  const s = toDateStr(d);
  let b = ((_a = data[0]) == null ? void 0 : _a.rate) ?? 0;
  for (const e of data) {
    if (e.date <= s) b = e.rate;
    else break;
  }
  return b;
};
const payDate = (start, off, day) => {
  const m = start.getMonth() + off;
  const ty = start.getFullYear() + Math.floor(m / 12);
  const tm = (m % 12 + 12) % 12;
  return new Date(ty, tm, Math.min(day, new Date(ty, tm + 1, 0).getDate()));
};
const ann = (b, r, m) => {
  if (r <= 0 || m <= 0) return m > 0 ? b / m : b;
  const rm = r / 100 / 12;
  const f = Math.pow(1 + rm, m);
  return b * (rm * f) / (f - 1);
};
const int = (b, p, d, base = 360) => b * (p / 100) * d / base;
const TENOR_RESET = { "1M": 1, "3M": 3, "6M": 6 };
function calculateLoan(input) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const wd = input.wiborData || [];
  const base = input.interestBase || 360;
  if (!wd.length) return null;
  const resetMonths = TENOR_RESET[input.wiborTenor] || 3;
  const isDecreasing = input.repaymentType === "decreasing";
  const schedule = [];
  let bal = input.loanAmount, balNW = input.loanAmount, balNR = input.loanAmount, prev = new Date(input.startDate);
  let wibor = resolveWibor(input.startDate, wd), inst = 0, instNW = 0, reset = 0;
  const a = { pastTotal: 0, pastPr: 0, pastInt: 0, pastIntW: 0, pastIntM: 0, pastIntB: 0, pastN: 0, futTotal: 0, futInt: 0, futIntW: 0, futIntM: 0, futN: 0, pastNoWibor: 0, pastIntNW: 0, pastPrNW: 0, futNoWibor: 0, futIntNW: 0, curInst: 0, curNW: 0, pastNoRate: 0, futNoRate: 0, curNR: 0 };
  for (let i = 1; i <= input.loanPeriodMonths; i++) {
    const pd = payDate(input.startDate, i, input.paymentDay);
    const days = daysBetween(prev, pd);
    const rem = input.loanPeriodMonths - i + 1;
    const last = i === input.loanPeriodMonths;
    const bridge = input.bridgeEndDate && pd <= input.bridgeEndDate ? input.bridgeMargin : 0;
    reset++;
    if (reset >= resetMonths || i === 1) {
      if (i > 1) wibor = resolveWibor(pd, wd);
      reset = 0;
      inst = ann(bal, wibor + input.margin + bridge, rem);
      instNW = ann(balNW, input.margin + bridge, rem);
    }
    const iW = int(bal, wibor, days, base);
    const iM = int(bal, input.margin, days, base);
    const iB = int(bal, bridge, days, base);
    const iT = iW + iM + iB;
    let pr = isDecreasing ? bal / rem : Math.max(inst - iT, 0);
    if (last || pr > bal) pr = bal;
    const isPast = pd <= today;
    schedule.push({ number: i, date: pd, days, wiborRate: wibor, installment: pr + iT, principal: pr, interestTotal: iT, interestWibor: iW, interestMargin: iM, interestBridge: iB, remainingBalance: bal - pr, isPast });
    bal = Math.max(bal - pr, 0);
    const iNW = int(balNW, input.margin + bridge, days, base);
    let pNW = isDecreasing ? balNW / rem : Math.max(instNW - iNW, 0);
    if (last || pNW > balNW) pNW = balNW;
    const nwInst = pNW + iNW;
    const nrInst = rem > 0 ? balNR / rem : balNR;
    const pNR = Math.min(nrInst, balNR);
    if (isPast) {
      a.pastTotal += pr + iT;
      a.pastPr += pr;
      a.pastInt += iT;
      a.pastIntW += iW;
      a.pastIntM += iM;
      a.pastIntB += iB;
      a.pastN++;
      a.pastNoWibor += nwInst;
      a.pastIntNW += iNW;
      a.pastPrNW += pNW;
      a.pastNoRate += nrInst;
    } else {
      if (a.futN === 0) {
        a.curInst = pr + iT;
        a.curNW = nwInst;
        a.curNR = nrInst;
      }
      a.futTotal += pr + iT;
      a.futInt += iT;
      a.futIntW += iW;
      a.futIntM += iM;
      a.futN++;
      a.futNoWibor += nwInst;
      a.futIntNW += iNW;
      a.futNoRate += nrInst;
    }
    balNW = Math.max(balNW - pNW, 0);
    balNR = Math.max(balNR - pNR, 0);
    prev = pd;
  }
  return {
    schedule,
    repaymentType: isDecreasing ? "decreasing" : "annuity",
    pastTotalPaid: a.pastTotal,
    pastPrincipalPaid: a.pastPr,
    pastInterestTotal: a.pastInt,
    pastInterestWibor: a.pastIntW,
    pastInterestMargin: a.pastIntM,
    pastInterestBridge: a.pastIntB,
    pastInstallmentsCount: a.pastN,
    futureTotalToPay: a.futTotal,
    futureInterestTotal: a.futInt,
    futureInterestWibor: a.futIntW,
    futureInterestMargin: a.futIntM,
    futureInstallmentsCount: a.futN,
    pastTotalPaidNoWibor: a.pastNoWibor,
    pastInterestNoWibor: a.pastIntNW,
    pastPrincipalNoWibor: a.pastPrNW,
    futureTotalNoWibor: a.futNoWibor,
    futureInterestNoWibor: a.futIntNW,
    overpaidInterest: a.pastInt - a.pastIntNW,
    futureSavings: a.futTotal - a.futNoWibor,
    currentInstallment: a.curInst,
    installmentNoWibor: a.curNW,
    pastTotalPaidNoRate: a.pastNoRate,
    futureTotalNoRate: a.futNoRate,
    installmentNoRate: a.curNR,
    overpaidWithMargin: a.pastTotal - a.pastNoRate,
    futureSavingsWithMargin: a.futTotal - a.futNoRate
  };
}
function parseStooqCSV(text) {
  return text.trim().split("\n").reduce((acc, line) => {
    const p = line.split(",");
    if (p.length < 5) return acc;
    let d = p[0].trim();
    if (/^\d{8}$/.test(d)) d = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return acc;
    const r = parseFloat(p[4]);
    if (!isNaN(r)) acc.push({ date: d, rate: r });
    return acc;
  }, []).sort((a, b) => a.date.localeCompare(b.date));
}
const WIBOR_TENORS = [
  { value: "3M", label: "WIBOR 3M" },
  { value: "6M", label: "WIBOR 6M" },
  { value: "1M", label: "WIBOR 1M" }
];
const REPAYMENT_TYPES = [
  { value: "annuity", label: "Raty równe" },
  { value: "decreasing", label: "Raty malejące" }
];
const scheduleColumns = [
  { key: "number", header: "#" },
  { key: "date", header: "Data" },
  { key: "installment", header: "Rata", align: "right" },
  { key: "principal", header: "Kapitał", align: "right" },
  { key: "interest", header: "Odsetki", align: "right" },
  { key: "wibor", header: "WIBOR%", align: "right" },
  { key: "balance", header: "Saldo", align: "right" }
];
const resultTabs = [
  { id: "summary", label: "Podsumowanie" },
  { id: "schedule", label: "Harmonogram" },
  { id: "compare", label: "Porównanie" },
  { id: "benefit", label: "Korzyść klienta" },
  { id: "calc", label: "Obliczenia" },
  { id: "report", label: "Raport" }
];
const WIBOR_BASE = "https://raw.githubusercontent.com/obieg-zero/wibor/main";
const WIBOR_FILES = {
  "1M": "wibor-1m.json",
  "3M": "wibor-3m.json",
  "6M": "wibor-6m.json"
};
const plnFmt = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plnFmt0 = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatPLN = (v, decimals = 2) => (decimals === 0 ? plnFmt0 : plnFmt).format(v);
const formatPct = (v, d = 2) => `${v.toFixed(d)}%`;
const formatDate = (d) => dateFmt.format(d);
function createWiborService({ React, store, ui, sdk }) {
  const { useState } = React;
  function getAutoFetch() {
    const configs = store.getPosts("wibor-config");
    return configs.length > 0 && !!configs[0].data.autoFetch;
  }
  function setAutoFetch(val) {
    const configs = store.getPosts("wibor-config");
    if (configs.length > 0) {
      store.update(configs[0].id, { autoFetch: val });
    } else {
      store.add("wibor-config", { autoFetch: val });
    }
  }
  function useAutoFetch() {
    const configs = store.usePosts("wibor-config");
    return configs.length > 0 && !!configs[0].data.autoFetch;
  }
  function useRatesForTenor(tenor) {
    var _a, _b;
    const sets = store.usePosts("wibor-rate-set");
    const tenorId = `wibor-${tenor.toLowerCase()}`;
    return ((_b = (_a = sets.find((s) => s.data.tenorId === tenorId)) == null ? void 0 : _a.data) == null ? void 0 : _b.entries) || [];
  }
  function useRateStatus(tenor) {
    var _a;
    const sets = store.usePosts("wibor-rate-set");
    const tenorId = `wibor-${tenor.toLowerCase()}`;
    const rateSet = sets.find((s) => s.data.tenorId === tenorId);
    const entries = ((_a = rateSet == null ? void 0 : rateSet.data) == null ? void 0 : _a.entries) || [];
    if (!entries.length) return { count: 0, lastDate: null, fresh: false, lastRate: 0 };
    const lastDate = entries[entries.length - 1].date;
    const fresh = daysBetween(new Date(lastDate), /* @__PURE__ */ new Date()) < 14;
    return { count: entries.length, lastDate, fresh, lastRate: entries[entries.length - 1].rate };
  }
  function saveTenorData(tenor, entries) {
    var _a;
    const tenorId = `wibor-${tenor.toLowerCase()}`;
    const sets = store.getPosts("wibor-rate-set");
    for (const s of sets) {
      if (((_a = s.data) == null ? void 0 : _a.tenorId) === tenorId) store.remove(s.id);
    }
    store.add("wibor-rate-set", { tenorId, entries });
    sdk.log(`WIBOR ${tenor}: wczytano ${entries.length} stawek`, "ok");
  }
  async function fetchTenor(tenor) {
    sdk.log(`Pobieram WIBOR ${tenor}…`, "info");
    try {
      const url = `${WIBOR_BASE}/${WIBOR_FILES[tenor]}`;
      const res = await window.fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      const raw = await res.json();
      const entries = raw.map((e) => ({ date: e.d, rate: e.r }));
      if (!entries.length) {
        sdk.log("Brak danych", "error");
        return;
      }
      saveTenorData(tenor, entries);
    } catch (e) {
      sdk.log(`Błąd pobierania: ${e.message}`, "error");
    }
  }
  async function fetchAllTenors() {
    for (const t of ["1M", "3M", "6M"]) await fetchTenor(t);
  }
  function detectTenorFromFilename(filename) {
    const fn = filename.toLowerCase();
    if (fn.includes("wibor1m") || fn.includes("wibor_1m") || fn.includes("wibor-1m") || fn.includes("plopln1m")) return "1M";
    if (fn.includes("wibor3m") || fn.includes("wibor_3m") || fn.includes("wibor-3m") || fn.includes("plopln3m")) return "3M";
    if (fn.includes("wibor6m") || fn.includes("wibor_6m") || fn.includes("wibor-6m") || fn.includes("plopln6m")) return "6M";
    return null;
  }
  async function importTenorFile(tenor) {
    const file = await sdk.openFileDialog(".csv,.json");
    if (!file) return;
    const detected = detectTenorFromFilename(file.name);
    if (detected && detected !== tenor) {
      sdk.log(`Plik "${file.name}" zawiera dane WIBOR ${detected}, a nie ${tenor}`, "error");
      return;
    }
    const text = await file.text();
    let entries;
    if (file.name.endsWith(".json")) {
      const raw = JSON.parse(text);
      entries = raw.map((e) => ({ date: e.d, rate: e.r }));
    } else {
      entries = parseStooqCSV(text);
    }
    if (!entries.length) {
      sdk.log("Brak danych w pliku", "error");
      return;
    }
    saveTenorData(tenor, entries);
  }
  function initAutoFetch() {
    if (!getAutoFetch()) return;
    const stale = ["1M", "3M", "6M"].some((t) => {
      var _a;
      const sets = store.getPosts("wibor-rate-set");
      const tenorId = `wibor-${t.toLowerCase()}`;
      const rateSet = sets.find((s) => s.data.tenorId === tenorId);
      const entries = ((_a = rateSet == null ? void 0 : rateSet.data) == null ? void 0 : _a.entries) || [];
      if (!entries.length) return true;
      const lastDate = entries[entries.length - 1].date;
      return daysBetween(new Date(lastDate), /* @__PURE__ */ new Date()) >= 14;
    });
    if (stale) {
      sdk.log("Auto-aktualizacja stawek WIBOR…", "info");
      fetchAllTenors();
    }
  }
  function WiborDataPanel() {
    const autoFetch = useAutoFetch();
    return /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsx(ui.Text, { muted: true, children: "Historyczne stawki WIBOR potrzebne do obliczeń. Pobierz aktualne dane jednym kliknięciem lub zaimportuj własny plik." }),
        /* @__PURE__ */ jsxs(ui.Row, { justify: "between", align: "center", children: [
          /* @__PURE__ */ jsxs(ui.Row, { align: "center", gap: "xs", children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox", checked: autoFetch, onChange: (e) => setAutoFetch(e.target.checked) }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: "Auto-aktualizacja" })
          ] }),
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: fetchAllTenors, children: "Pobierz wszystkie" })
        ] })
      ] }) }),
      ["1M", "3M", "6M"].map((t, i, arr) => {
        const s = useRateStatus(t);
        return /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Text, { muted: true, children: `WIBOR ${t}` }),
          /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: s.count > 0 ? `${s.count} stawek · do ${s.lastDate} · ostatnia ${formatPct(s.lastRate)}` : "brak danych" }),
          /* @__PURE__ */ jsxs(ui.Row, { children: [
            /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => fetchTenor(t), children: "Pobierz" }),
            /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: () => importTenorFile(t), children: "Importuj z pliku" })
          ] }),
          i < arr.length - 1 && /* @__PURE__ */ jsx(ui.Divider, {})
        ] }, t);
      })
    ] });
  }
  function TemplatesPanel({ onApply }) {
    const [selectedOpp, setSelectedOpp] = useState("");
    const opponents = store.usePosts("opponent");
    const templates = store.usePosts("opponent-template");
    if (!opponents.length) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Brak banków w bazie" });
    const options = [{ value: "", label: "— wszystkie banki —" }, ...opponents.map((o) => ({ value: o.id, label: o.data.name }))];
    const filtered = selectedOpp ? opponents.filter((o) => o.id === selectedOpp) : opponents;
    const KV = (label, value) => /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
      /* @__PURE__ */ jsx(ui.Text, { muted: true, children: label }),
      /* @__PURE__ */ jsx(ui.Value, { size: "sm", children: value })
    ] });
    const applyTemplate = (t) => {
      const data = {};
      if (t.data.margin) data.margin = Number(t.data.margin);
      if (t.data.bridgeMargin) data.bridgeMargin = Number(t.data.bridgeMargin);
      if (t.data.wiborType) data.wiborTenor = t.data.wiborType;
      if (t.data.interestMethod) data.interestMethod = t.data.interestMethod;
      onApply == null ? void 0 : onApply(data);
      sdk.log(`Zastosowano szablon: ${t.data.name}`, "ok");
    };
    return /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsx(ui.Text, { muted: true, children: "Szablony umów z danymi banków. Wybierz bank i zastosuj szablon aby wypełnić parametry kalkulatora." }) }),
      /* @__PURE__ */ jsx(ui.Select, { value: selectedOpp, options, onChange: (e) => setSelectedOpp(e.target.value) }),
      filtered.map((opp) => {
        const tpls = templates.filter((t) => t.parentId === opp.id);
        if (!tpls.length) return null;
        return /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Text, { muted: true, children: opp.data.name }),
          tpls.map((t) => /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: t.data.name }),
            t.data.margin && KV("Marża", formatPct(Number(t.data.margin))),
            t.data.bridgeMargin && KV("Pomostowa", formatPct(Number(t.data.bridgeMargin))),
            t.data.wiborType && KV("WIBOR", t.data.wiborType),
            t.data.commission && KV("Prowizja", formatPct(Number(t.data.commission))),
            t.data.interestMethod && KV("Naliczanie", t.data.interestMethod === "365" ? "365 dni" : "360 dni"),
            /* @__PURE__ */ jsx(ui.Row, { justify: "end", children: /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => applyTemplate(t), children: "Zastosuj" }) })
          ] }) }, t.id))
        ] }, opp.id);
      })
    ] });
  }
  return { useRatesForTenor, WiborDataPanel, TemplatesPanel, initAutoFetch };
}
function createViews(deps, useInput) {
  const { React, ui, store, sdk } = deps;
  const { useState } = React;
  const KV = (label, value, color) => /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
    /* @__PURE__ */ jsx(ui.Text, { muted: true, children: label }),
    /* @__PURE__ */ jsx(ui.Value, { size: "sm", bold: !!color, color, children: value })
  ] });
  const KVCard = ({ title, rows }) => /* @__PURE__ */ jsx(ui.Card, { title, children: /* @__PURE__ */ jsx(ui.Stack, { children: rows.map(([l, v, c], i) => KV(l, v, c)) }) });
  function Summary({ r }) {
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { title: "Korzyść całkowita", value: formatPLN(r.overpaidInterest + r.futureSavings), color: "success" }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Rata aktualna", value: formatPLN(r.currentInstallment) }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Rata bez WIBOR", value: formatPLN(r.installmentNoWibor), color: "info" }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Rata bez WIBOR i marży", value: formatPLN(r.installmentNoRate), color: "success" })
      ] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Dotychczasowe", rows: [["Zapłacono łącznie", formatPLN(r.pastTotalPaid)], ["Kapitał", formatPLN(r.pastPrincipalPaid)], ["Odsetki", formatPLN(r.pastInterestTotal)], ["w tym WIBOR", formatPLN(r.pastInterestWibor), "warning"], ["w tym marża", formatPLN(r.pastInterestMargin), "warning"], ["Rat zapłaconych", String(r.pastInstallmentsCount)]] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Przyszłe", rows: [["Do zapłaty", formatPLN(r.futureTotalToPay)], ["Kapitał do spłaty", formatPLN(r.futureTotalToPay - r.futureInterestTotal)], ["Odsetki przyszłe", formatPLN(r.futureInterestTotal)], ["w tym WIBOR", formatPLN(r.futureInterestWibor), "warning"], ["w tym marża", formatPLN(r.futureInterestMargin), "warning"], ["Rat pozostałych", String(r.futureInstallmentsCount)]] })
    ] });
  }
  function Schedule({ r }) {
    const [filter, setFilter] = useState("all");
    const filtered = filter === "past" ? r.schedule.filter((x) => x.isPast) : filter === "future" ? r.schedule.filter((x) => !x.isPast) : r.schedule;
    const tableRows = filtered.map((x) => ({ number: x.number, date: formatDate(x.date), installment: formatPLN(x.installment), principal: formatPLN(x.principal), interest: formatPLN(x.interestTotal), wibor: formatPct(x.wiborRate), balance: formatPLN(x.remainingBalance) }));
    const filterTabs = [{ id: "all", label: `Wszystkie (${r.schedule.length})` }, { id: "past", label: "Przeszłe" }, { id: "future", label: "Przyszłe" }];
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Tabs, { tabs: filterTabs, active: filter, onChange: setFilter, variant: "lift" }),
      /* @__PURE__ */ jsx(ui.Table, { columns: scheduleColumns, rows: tableRows, pageSize: 24, empty: "Brak rat dla wybranego filtra" })
    ] });
  }
  function Compare({ r }) {
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { title: "Nadpłacone odsetki", value: formatPLN(r.overpaidInterest), color: "error" }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Przyszłe oszczędności", value: formatPLN(r.futureSavings), color: "success" })
      ] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Przeszłość", rows: [["Zapłacone z WIBOR", formatPLN(r.pastTotalPaid)], ["Zapłacone bez WIBOR", formatPLN(r.pastTotalPaidNoWibor)], ["Nadpłata (WIBOR)", formatPLN(r.overpaidInterest), "error"], ["Nadpłata (WIBOR + marża)", formatPLN(r.overpaidWithMargin), "error"]] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Przyszłość", rows: [["Do zapłaty z WIBOR", formatPLN(r.futureTotalToPay)], ["Do zapłaty bez WIBOR", formatPLN(r.futureTotalNoWibor)], ["Oszczędność", formatPLN(r.futureSavings), "success"]] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Porównanie rat", rows: [["Rata aktualna", formatPLN(r.currentInstallment)], ["Rata bez WIBOR", formatPLN(r.installmentNoWibor), "info"], ["Rata sam kapitał", formatPLN(r.installmentNoRate), "success"]] })
    ] });
  }
  function Benefit({ r }) {
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { title: "Korzyść łączna (WIBOR)", value: formatPLN(r.overpaidInterest + r.futureSavings), color: "success" }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Korzyść łączna (WIBOR + marża)", value: formatPLN(r.overpaidWithMargin + r.futureSavingsWithMargin), color: "success" })
      ] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Nadpłacone dotychczas", rows: [["Nadpłata z tytułu WIBOR", formatPLN(r.overpaidInterest), "error"], ["Nadpłata z tytułu WIBOR + marża", formatPLN(r.overpaidWithMargin), "error"]] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Przyszłe oszczędności", rows: [["Oszczędność (WIBOR)", formatPLN(r.futureSavings), "success"], ["Oszczędność (WIBOR + marża)", formatPLN(r.futureSavingsWithMargin), "success"]] }),
      /* @__PURE__ */ jsx(KVCard, { title: "Różnica w racie miesięcznej", rows: [["Rata aktualna", formatPLN(r.currentInstallment)], ["Rata bez WIBOR", formatPLN(r.installmentNoWibor), "info"], ["Rata bez WIBOR i marży", formatPLN(r.installmentNoRate), "success"], ["Oszczędność miesięczna (bez WIBOR)", formatPLN(r.currentInstallment - r.installmentNoWibor), "info"], ["Oszczędność miesięczna (bez WIBOR i marży)", formatPLN(r.currentInstallment - r.installmentNoRate), "success"]] })
    ] });
  }
  function Calculations({ r }) {
    const inp = useInput();
    const [expanded, setExpanded] = useState(1);
    if (!inp) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Brak danych wejściowych" });
    const baseDays = inp.interestBase || 360;
    const tenor = inp.wiborTenor || "3M";
    const resetMonths = { "1M": 1, "3M": 3, "6M": 6 }[tenor] || 3;
    const repType = inp.repaymentType === "decreasing" ? "malejące" : "równe (annuitetowe)";
    const toggle = (n) => setExpanded(expanded === n ? null : n);
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Card, { title: "Parametry wejściowe", children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        KV("Kwota kredytu", formatPLN(inp.loanAmount)),
        KV("Marża banku", formatPct(inp.margin)),
        KV("Okres", `${inp.loanPeriodMonths} mies.`),
        KV("Tenor WIBOR", `WIBOR ${tenor} (reset co ${resetMonths} mies.)`),
        KV("Rodzaj rat", repType),
        KV("Data rozpoczęcia", formatDate(inp.startDate)),
        KV("Dzień spłaty", String(inp.paymentDay)),
        KV("Baza odsetkowa", `${baseDays} dni`),
        KV("Marża pomostowa", formatPct(inp.bridgeMargin)),
        inp.bridgeEndDate && KV("Koniec pomostowej", formatDate(inp.bridgeEndDate))
      ] }) }),
      /* @__PURE__ */ jsx(ui.Card, { title: "Wzory", children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
          "Odsetki = saldo × (stawka / 100) × dni_w_okresie / ",
          baseDays
        ] }),
        /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: "Rata annuitetowa = saldo × (r × (1+r)^n) / ((1+r)^n − 1), gdzie r = stawka/100/12" }),
        /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: "Stawka = WIBOR + marża + marża_pomostowa" }),
        /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
          "WIBOR: ostatnia znana stawka ≤ data płatności, reset co ",
          resetMonths,
          " mies."
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(ui.Card, { title: "Obliczenia krok po kroku", children: /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: "Kliknij ratę aby rozwinąć szczegóły obliczeń" }) }),
      r.schedule.map((s) => {
        const isOpen = expanded === s.number;
        const bridge = s.interestBridge > 0;
        const totalRate = s.wiborRate + inp.margin + (bridge ? inp.bridgeMargin : 0);
        const prevDate = s.number === 1 ? inp.startDate : r.schedule[s.number - 2].date;
        return /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsxs(ui.Row, { justify: "between", onClick: () => toggle(s.number), children: [
            /* @__PURE__ */ jsxs(ui.Text, { bold: true, size: "xs", children: [
              "Rata #",
              s.number,
              " — ",
              formatDate(s.date)
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: formatPLN(s.installment) })
          ] }),
          isOpen && /* @__PURE__ */ jsxs(ui.Stack, { children: [
            /* @__PURE__ */ jsx(ui.Divider, {}),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "1. Okres" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              "Od ",
              formatDate(prevDate),
              " do ",
              formatDate(s.date),
              " = ",
              s.days,
              " dni"
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "2. Stawka WIBOR" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              "WIBOR ",
              tenor,
              " na dzień ",
              formatDate(s.date),
              ": ",
              formatPct(s.wiborRate)
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "3. Oprocentowanie łączne" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              formatPct(s.wiborRate),
              " (WIBOR) + ",
              formatPct(inp.margin),
              " (marża)",
              bridge ? ` + ${formatPct(inp.bridgeMargin)} (pomostowa)` : "",
              " = ",
              formatPct(totalRate)
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "4. Odsetki WIBOR" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              formatPLN(s.remainingBalance + s.principal),
              " × ",
              formatPct(s.wiborRate),
              " × ",
              s.days,
              " / ",
              baseDays,
              " = ",
              formatPLN(s.interestWibor)
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "5. Odsetki marża" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              formatPLN(s.remainingBalance + s.principal),
              " × ",
              formatPct(inp.margin),
              " × ",
              s.days,
              " / ",
              baseDays,
              " = ",
              formatPLN(s.interestMargin)
            ] }),
            bridge && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "5b. Odsetki pomostowa" }),
              /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
                formatPLN(s.remainingBalance + s.principal),
                " × ",
                formatPct(inp.bridgeMargin),
                " × ",
                s.days,
                " / ",
                baseDays,
                " = ",
                formatPLN(s.interestBridge)
              ] })
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "6. Odsetki łącznie" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              formatPLN(s.interestWibor),
              " + ",
              formatPLN(s.interestMargin),
              bridge ? ` + ${formatPLN(s.interestBridge)}` : "",
              " = ",
              formatPLN(s.interestTotal)
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "7. Rata i kapitał" }),
            inp.repaymentType === "decreasing" ? /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              "Kapitał = saldo / pozostałe raty = ",
              formatPLN(s.remainingBalance + s.principal),
              " / ",
              inp.loanPeriodMonths - s.number + 1,
              " = ",
              formatPLN(s.principal)
            ] }) : /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              "Rata annuitetowa = ann(",
              formatPLN(s.remainingBalance + s.principal),
              ", ",
              formatPct(totalRate),
              ", ",
              inp.loanPeriodMonths - s.number + 1,
              ") = ",
              formatPLN(s.installment),
              ", kapitał = ",
              formatPLN(s.installment),
              " − ",
              formatPLN(s.interestTotal),
              " = ",
              formatPLN(s.principal)
            ] }),
            /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", bold: true, children: "8. Saldo po racie" }),
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              formatPLN(s.remainingBalance + s.principal),
              " − ",
              formatPLN(s.principal),
              " = ",
              formatPLN(s.remainingBalance)
            ] })
          ] })
        ] }) }, s.number);
      })
    ] });
  }
  function Report({ r }) {
    const inp = useInput();
    if (!inp) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Brak danych wejściowych" });
    const caseId = sdk.shared((s) => {
      var _a;
      return (_a = s.crm) == null ? void 0 : _a.caseId;
    });
    const nav = sdk.shared((s) => s.navigate);
    const cas = caseId ? store.usePost(caseId) : null;
    const [saved, setSaved] = useState(false);
    const reportData = {
      loanAmount: inp.loanAmount,
      startDate: typeof inp.startDate === "object" ? inp.startDate.toISOString().slice(0, 10) : inp.startDate,
      loanPeriodMonths: inp.loanPeriodMonths,
      wiborTenor: inp.wiborTenor || "3M",
      margin: inp.margin,
      overpaidInterest: r.overpaidInterest,
      futureSavings: r.futureSavings,
      overpaidWithMargin: r.overpaidWithMargin,
      futureSavingsWithMargin: r.futureSavingsWithMargin,
      currentInstallment: r.currentInstallment,
      installmentNoWibor: r.installmentNoWibor,
      installmentNoRate: r.installmentNoRate,
      totalBenefit: r.overpaidInterest + r.futureSavings,
      totalBenefitWithMargin: r.overpaidWithMargin + r.futureSavingsWithMargin
    };
    const saveToCase = () => {
      if (!caseId) return;
      store.add("event", {
        kind: "raport-wibor",
        text: `Analiza WIBOR — zwrot: ${formatPLN(r.overpaidInterest)}, korzyść: ${formatPLN(reportData.totalBenefit)}`,
        date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        report: reportData
      }, { parentId: caseId });
      sdk.log("Raport zapisany w sprawie", "ok");
      setSaved(true);
    };
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Stats, { children: [
        /* @__PURE__ */ jsx(ui.Stat, { title: "Kwota zwrotu od banku", value: formatPLN(r.overpaidInterest), color: "error" }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Dodatkowe korzyści", value: formatPLN(r.futureSavings), color: "success" }),
        /* @__PURE__ */ jsx(ui.Stat, { title: "Nowa rata (bez WIBOR)", value: formatPLN(r.installmentNoWibor), color: "info" })
      ] }),
      /* @__PURE__ */ jsx(ui.Card, { title: "Analiza prawno-finansowa", children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        KV("Kwota kredytu", formatPLN(inp.loanAmount)),
        KV("Okres kredytowania", `${inp.loanPeriodMonths} mies.`),
        KV("WIBOR", inp.wiborTenor || "3M"),
        KV("Marża banku", formatPct(inp.margin)),
        KV("Korzyść łączna (WIBOR)", formatPLN(reportData.totalBenefit), "success"),
        KV("Korzyść łączna (WIBOR + marża)", formatPLN(reportData.totalBenefitWithMargin), "success"),
        KV("Rata aktualna", formatPLN(r.currentInstallment)),
        KV("Rata bez WIBOR", formatPLN(r.installmentNoWibor), "info"),
        KV("Rata bez WIBOR i marży", formatPLN(r.installmentNoRate), "success")
      ] }) }),
      cas ? /* @__PURE__ */ jsx(ui.Card, { title: "Sprawa CRM", color: saved ? "success" : void 0, children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsx(ui.Text, { muted: true, children: cas.data.subject || cas.id.slice(0, 8) }),
        saved ? /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Text, { bold: true, color: "success", children: "Raport zapisany w sprawie" }),
          nav && /* @__PURE__ */ jsxs(ui.Button, { color: "primary", block: true, onClick: () => {
            if (nav.onReturn) nav.onReturn();
            sdk.shared.setState({ navigate: null });
            sdk.useHostStore.setState({ activeId: nav.from });
          }, children: [
            "← ",
            nav.label || "Wróć"
          ] })
        ] }) : /* @__PURE__ */ jsx(ui.Button, { color: "primary", block: true, onClick: saveToCase, children: "Zapisz raport w sprawie" })
      ] }) }) : nav ? /* @__PURE__ */ jsxs(ui.Button, { color: "primary", block: true, onClick: () => {
        if (nav.onReturn) nav.onReturn();
        sdk.shared.setState({ navigate: null });
        sdk.useHostStore.setState({ activeId: nav.from });
      }, children: [
        "← ",
        nav.label || "Wróć"
      ] }) : /* @__PURE__ */ jsx(ui.Card, { color: "warning", children: /* @__PURE__ */ jsx(ui.Text, { muted: true, children: "Brak aktywnej sprawy CRM — wybierz sprawę w module Kancelaria, aby zapisać raport" }) })
    ] });
  }
  return { Summary, Schedule, Compare, Benefit, Calculations, Report };
}
const plugin = (deps) => {
  const { React, store, ui, icons, sdk } = deps;
  const { useState } = React;
  const { useRatesForTenor, WiborDataPanel, TemplatesPanel, initAutoFetch } = createWiborService(deps);
  const useCalcStore = sdk.create(() => ({ result: null, input: null }));
  const setResult = (r, inp) => useCalcStore.setState({ result: r, input: inp || null });
  const useResult = () => useCalcStore((s) => s.result);
  const useInput = () => useCalcStore((s) => s.input);
  const { Summary, Schedule, Compare, Benefit, Calculations, Report } = createViews(deps, useInput);
  function useCaseDefaults() {
    const caseId = sdk.shared((s) => {
      var _a;
      return (_a = s.crm) == null ? void 0 : _a.caseId;
    });
    const cases = store.usePosts("case");
    const opponents = store.usePosts("opponent");
    const templates = store.usePosts("opponent-template");
    if (!caseId) return null;
    const cas = cases.find((c) => c.id === caseId);
    if (!cas) return null;
    const opponentId = cas.data.opponent;
    const opponent = opponentId ? opponents.find((o) => o.id === opponentId) : null;
    const template = opponent ? templates.find((t) => t.parentId === opponent.id) : null;
    return {
      loanAmount: Number(cas.data.loanAmount) || 3e5,
      startDate: cas.data.loanDate || "2018-01-01",
      margin: Number(template == null ? void 0 : template.data.margin) || 2,
      bridgeMargin: Number(template == null ? void 0 : template.data.bridgeMargin) || 0,
      wiborTenor: (template == null ? void 0 : template.data.wiborType) || "3M",
      interestMethod: (template == null ? void 0 : template.data.interestMethod) || "360",
      opponentName: (opponent == null ? void 0 : opponent.data.name) || null,
      caseSubject: cas.data.subject || cas.id.slice(0, 8)
    };
  }
  function Left() {
    const [leftTab, setLeftTab] = useState("params");
    const crmDefaults = useCaseDefaults();
    const defaults = { loanAmount: 3e5, margin: 2, loanPeriodMonths: 360, startDate: "2018-01-01", paymentDay: 15, bridgeMargin: 0, bridgeEndDate: "", wiborTenor: "3M", manualRate: "", interestMethod: "360", repaymentType: "annuity", ...crmDefaults };
    const { form, bind, set } = sdk.useForm(defaults);
    const rates = useRatesForTenor(form.wiborTenor);
    const calculate = () => {
      const wd = rates.length ? rates : form.manualRate ? [{ date: "2000-01-01", rate: Number(form.manualRate) }] : null;
      if (!wd) {
        sdk.log("Podaj stawkę WIBOR ręcznie lub zaimportuj dane", "error");
        return;
      }
      const loanInput = { ...form, startDate: new Date(form.startDate), bridgeEndDate: form.bridgeEndDate ? new Date(form.bridgeEndDate) : null, wiborData: wd, interestBase: Number(form.interestMethod) || 360 };
      const r = calculateLoan(loanInput);
      if (r) setResult(r, loanInput);
    };
    const F = (label, key, type) => /* @__PURE__ */ jsx(ui.Field, { label, children: /* @__PURE__ */ jsx(ui.Input, { type: type === "n" ? "number" : type === "d" ? "date" : void 0, ...bind(key, type === "n" ? Number : void 0) }) });
    return /* @__PURE__ */ jsx(
      ui.Box,
      {
        header: /* @__PURE__ */ jsx(ui.Tabs, { tabs: [{ id: "params", label: "Parametry" }, { id: "wibor", label: "Stawki WIBOR" }, { id: "templates", label: "Szablony" }], active: leftTab, onChange: setLeftTab }),
        body: leftTab === "wibor" ? /* @__PURE__ */ jsx(WiborDataPanel, {}) : leftTab === "templates" ? /* @__PURE__ */ jsx(TemplatesPanel, { onApply: (data) => {
          set(data);
          setLeftTab("params");
        } }) : /* @__PURE__ */ jsxs(ui.Stack, { children: [
          (crmDefaults == null ? void 0 : crmDefaults.caseSubject) && /* @__PURE__ */ jsx(ui.Card, { color: "info", children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
            /* @__PURE__ */ jsxs(ui.Text, { muted: true, children: [
              "Sprawa: ",
              crmDefaults.caseSubject
            ] }),
            crmDefaults.opponentName && /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "2xs", children: [
              "Bank: ",
              crmDefaults.opponentName
            ] })
          ] }) }),
          F("Kwota kredytu (PLN)", "loanAmount", "n"),
          F("Marża (%)", "margin", "n"),
          F("Okres (miesiące)", "loanPeriodMonths", "n"),
          /* @__PURE__ */ jsx(ui.Field, { label: "WIBOR", children: /* @__PURE__ */ jsx(ui.Select, { ...bind("wiborTenor"), options: WIBOR_TENORS }) }),
          /* @__PURE__ */ jsx(ui.Field, { label: "Rodzaj rat", children: /* @__PURE__ */ jsx(ui.Select, { ...bind("repaymentType"), options: REPAYMENT_TYPES }) }),
          F("Data rozpoczęcia", "startDate", "d"),
          F("Dzień spłaty", "paymentDay", "n"),
          F("Marża pomostowa (%)", "bridgeMargin", "n"),
          form.bridgeMargin > 0 && /* @__PURE__ */ jsx(ui.Field, { label: "Koniec pomostowej", children: /* @__PURE__ */ jsx(ui.Input, { type: "date", ...bind("bridgeEndDate") }) }),
          !rates.length && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(ui.Field, { label: "Stawka WIBOR (%)", children: /* @__PURE__ */ jsx(ui.Input, { type: "number", ...bind("manualRate"), placeholder: "np. 5.85" }) }),
            /* @__PURE__ */ jsx(ui.Card, { color: "warning", children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
              /* @__PURE__ */ jsx(ui.Text, { muted: true, children: "Stała stawka — obliczenie zakłada niezmienną wartość WIBOR przez cały okres kredytu. Aby uwzględnić historyczne zmiany stawek, zaimportuj dane CSV." }),
              /* @__PURE__ */ jsx(ui.Row, { justify: "end", children: /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", outline: true, onClick: () => setLeftTab("wibor"), children: "Stawki WIBOR" }) })
            ] }) })
          ] }),
          /* @__PURE__ */ jsx(ui.Button, { onClick: calculate, block: true, color: "primary", children: "Oblicz" })
        ] }),
        grow: true
      }
    );
  }
  function Center() {
    const result = useResult(), [tab, setTab] = useState("summary");
    if (!result) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wprowadź dane i kliknij Oblicz" });
    return /* @__PURE__ */ jsxs(ui.Page, { children: [
      /* @__PURE__ */ jsx(ui.Tabs, { tabs: resultTabs, active: tab, onChange: setTab }),
      tab === "summary" && /* @__PURE__ */ jsx(Summary, { r: result }),
      tab === "schedule" && /* @__PURE__ */ jsx(Schedule, { r: result }),
      tab === "compare" && /* @__PURE__ */ jsx(Compare, { r: result }),
      tab === "benefit" && /* @__PURE__ */ jsx(Benefit, { r: result }),
      tab === "calc" && /* @__PURE__ */ jsx(Calculations, { r: result }),
      tab === "report" && /* @__PURE__ */ jsx(Report, { r: result })
    ] });
  }
  function Footer() {
    const crmDefaults = useCaseDefaults();
    return /* @__PURE__ */ jsx(ui.Text, { muted: true, children: (crmDefaults == null ? void 0 : crmDefaults.opponentName) ? `WIBOR · ${crmDefaults.opponentName}` : "Kalkulator WIBOR" });
  }
  store.registerType("wibor-config", [
    { key: "autoFetch", label: "Auto-aktualizacja" }
  ], "Ustawienia WIBOR");
  store.registerType("wibor-rate-set", [
    { key: "tenorId", label: "Tenor", required: true },
    { key: "entries", label: "Stawki" }
  ], "Stawki WIBOR");
  sdk.registerView("wiborCalc.left", { slot: "left", component: Left });
  sdk.registerView("wiborCalc.center", { slot: "center", component: Center });
  sdk.registerView("wiborCalc.footer", { slot: "footer", component: Footer });
  initAutoFetch();
  sdk.registerParser("wiborCalc.csv", {
    accept: ".csv",
    targetType: "wibor-rate-set",
    parse: (text, filename) => {
      const entries = parseStooqCSV(text);
      if (!entries.length) return [];
      const fn = (filename || "").toLowerCase();
      const tenorId = fn.includes("6m") ? "wibor-6m" : fn.includes("1m") ? "wibor-1m" : "wibor-3m";
      return [{ tenorId, entries }];
    }
  });
  return {
    id: "plugin-wibor-calc",
    label: "Kalkulator WIBOR",
    description: "Kalkulator kredytu hipotecznego WIBOR",
    version: "1.0.0",
    icon: icons.DollarSign
  };
};
export {
  plugin as default
};
