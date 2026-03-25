import { useState, useEffect, useCallback, useMemo } from "react";

const SK = "fin-mgr-v8";
const PRODUCTS = [
  { id: "bakusoq", label: "BAKUSOQ", color: "#2563eb", bg: "#dbeafe" },
  { id: "ninkuboxx", label: "NiNKUBOXX", color: "#7c3aed", bg: "#ede9fe" },
  { id: "other", label: "その他", color: "#059669", bg: "#d1fae5" },
];
const TABS = [
  { id: "bakusoq", label: "BAKUSOQ契約", icon: "📄" },
  { id: "ninkuboxx", label: "NiNKUBOXX契約", icon: "📄" },
  { id: "other", label: "その他契約", icon: "📄" },
  { id: "cashflow", label: "資金繰り表", icon: "📊" },
  { id: "companies", label: "企業マスタ", icon: "🏢" },
];

// close: offset from billing month (-1, 0, 1)
// pay: "same_end" | "next_end" | "next_10" (relative to close month)
const CL_OPTS = [{ v: "-1", l: "前月" }, { v: "0", l: "当月" }, { v: "1", l: "翌月" }];
const PY_OPTS = [{ v: "same_end", l: "当月末" }, { v: "next_end", l: "翌月末" }, { v: "next_10", l: "翌月10日" }];

const calcPayOff = (cl, py) => parseInt(cl) + (py.startsWith("next") ? 1 : 0);
const monthAt = (base, off) => { const m = base + off; return ((m - 1 + 120) % 12) + 1; };

const payDesc = (cl, py, base) => {
  if (!base) return "";
  const clM = monthAt(base, parseInt(cl));
  const pyM = py === "same_end" ? clM : monthAt(clM, 1);
  return clM + "月締" + pyM + "月" + (py.includes("10") ? "10日" : "末") + "払";
};

const defData = () => ({ companies: [], contracts: [] });
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fN = (n) => n === 0 ? "0" : n.toLocaleString("ja-JP");
const fY = (n) => "¥" + fN(n);
const fD = (d) => { if (!d) return ""; const p = d.split("-"); return p[0] + "/" + parseInt(p[1]) + "/" + parseInt(p[2]); };

const cEnd = (sd, m) => {
  if (!sd || !m) return "";
  const p = sd.split("-").map(Number), d = new Date(p[0], p[1] - 1 + m, p[2]);
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

const bMos = (sd, m) => {
  if (!sd || !m) return [];
  const p = sd.split("-").map(Number), r = [];
  for (let i = 0; i < m; i++) {
    const mm = ((p[1] - 1 + i) % 12) + 1;
    r.push((p[0] + Math.floor((p[1] - 1 + i) / 12)) + "-" + String(mm).padStart(2, "0"));
  }
  return r;
};

const sM = (ym, o) => {
  if (o === 0) return ym;
  const p = ym.split("-").map(Number), n = p[1] + o;
  return (p[0] + Math.floor((n - 1) / 12)) + "-" + String(((n - 1) % 12) + 1).padStart(2, "0");
};

const mkBS = (bm, bd) => bm ? bm + "-" + String(parseInt(bd)).padStart(2, "0") : "";

const gAllM = (cs) => {
  const s = new Set();
  cs.forEach((c) => {
    const bs = mkBS(c.billingMonth, c.billingDay), ms = bMos(bs, c.durationMonths);
    const mo = calcPayOff(c.monthlyClose || "0", c.monthlyPay || "same_end");
    ms.forEach((m) => { s.add(m); s.add(sM(m, mo)); });
    if (c.hasOption) { const oo = calcPayOff(c.optionClose || "0", c.optionPay || "same_end"); ms.forEach((m) => s.add(sM(m, oo))); }
    if (c.hasInitialFee && ms.length > 0) { const io = calcPayOff(c.initialClose || "0", c.initialPay || "same_end"); s.add(sM(ms[0], io)); }
  });
  const now = new Date();
  for (let i = 0; i < 18; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); s.add(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
  return [...s].sort();
};

const iS = { width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lS = { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 };
const bP = { padding: "10px 28px", background: "#1e293b", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const bSc = { padding: "10px 20px", background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer" };
const bD = { padding: "8px 16px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const sS = { padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", flex: 1, minWidth: 0 };

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 32, minWidth: 420, maxWidth: 700, width: "92%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Bdg = ({ product }) => { const x = PRODUCTS.find((q) => q.id === product); return x ? <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: x.color, background: x.bg }}>{x.label}</span> : null; };

const PayCfg = ({ label, close, pay, onCC, onPC, baseMonth }) => {
  const bm = baseMonth ? parseInt(baseMonth.split("-")[1]) : 0;
  const clM = bm ? monthAt(bm, parseInt(close)) : 0;
  return (
    <div>
      <label style={lS}>{label}</label>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <select style={sS} value={close} onChange={(e) => onCC(e.target.value)}>
          {CL_OPTS.map((o) => <option key={o.v} value={o.v}>{bm ? monthAt(bm, parseInt(o.v)) + "月" : o.l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>締め</span>
        <select style={sS} value={pay} onChange={(e) => onPC(e.target.value)}>
          {PY_OPTS.map((o) => {
            const pm = clM ? (o.v === "same_end" ? clM : monthAt(clM, 1)) : 0;
            const dayLabel = o.v.includes("10") ? "10日" : "末";
            return <option key={o.v} value={o.v}>{pm ? pm + "月" + dayLabel : o.l}</option>;
          })}
        </select>
        <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>払い</span>
      </div>
      {bm > 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#3b82f6", fontWeight: 500 }}>
        → 当月締め{PY_OPTS.find((o) => o.v === pay)?.l || "当月末"}払い
      </div>}
    </div>
  );
};

const MIn = ({ label, value, onChange, placeholder }) => (
  <div>
    {label && <label style={lS}>{label}</label>}
    <input style={iS} value={value ? fN(value) : ""} onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)} placeholder={placeholder || ""} inputMode="numeric" />
  </div>
);

const CoForm = ({ company, onSave, onClose }) => {
  const [nm, sNm] = useState(company?.name || "");
  const [ct, sCt] = useState(company?.contact || "");
  const [nt, sNt] = useState(company?.note || "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><label style={lS}>会社名 *</label><input style={iS} value={nm} onChange={(e) => sNm(e.target.value)} placeholder="株式会社〇〇" /></div>
      <div><label style={lS}>担当者・連絡先</label><input style={iS} value={ct} onChange={(e) => sCt(e.target.value)} /></div>
      <div><label style={lS}>メモ</label><textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={nt} onChange={(e) => sNt(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button style={bSc} onClick={onClose}>キャンセル</button>
        <button style={{ ...bP, opacity: nm ? 1 : 0.4 }} disabled={!nm} onClick={() => onSave({ id: company?.id || gid(), name: nm, contact: ct, note: nt })}>{company ? "更新" : "登録"}</button>
      </div>
    </div>
  );
};

const ConForm = ({ contract: c, productType, companies, onSave, onAddCompany, onClose }) => {
  const [cid, sCid] = useState(c?.companyId || "");
  const [csd, sCsd] = useState(c?.contractStartDate || "");
  const [bMon, sBMon] = useState(c?.billingMonth || "");
  const [bDay, sBDay] = useState(c?.billingDay || "1");
  const [dur, sDur] = useState(c?.durationMonths || 12);
  const [mF, sMF] = useState(c?.monthlyFee || 0);
  const [mC, sMC] = useState(c?.monthlyClose || "0");
  const [mP, sMP] = useState(c?.monthlyPay || "same_end");
  const [hI, sHI] = useState(c?.hasInitialFee || false);
  const [iF, sIF] = useState(c?.initialFee || 0);
  const [iC, sIC] = useState(c?.initialClose || "0");
  const [iP, sIP] = useState(c?.initialPay || "same_end");
  const [hO, sHO] = useState(c?.hasOption || false);
  const [oF, sOF] = useState(c?.optionFee || 0);
  const [oN, sON] = useState(c?.optionName || "");
  const [oC, sOC] = useState(c?.optionClose || "0");
  const [oP, sOP] = useState(c?.optionPay || "same_end");
  const [nt, sNt] = useState(c?.note || "");
  const [shN, setShN] = useState(false);
  const [nNm, sNNm] = useState("");
  const [nCt, sNCt] = useState("");

  useEffect(() => {
    if (!csd || bMon) return;
    const pp = csd.split("-").map(Number);
    let bm = pp[1], by = pp[0];
    if (pp[2] > parseInt(bDay)) { bm++; if (bm > 12) { bm = 1; by++; } }
    sBMon(by + "-" + String(bm).padStart(2, "0"));
  }, [csd]);

  const bs = mkBS(bMon, bDay), endD = cEnd(bs, dur);
  const valid = cid && csd && bMon && dur > 0;

  const addCo = () => {
    if (!nNm.trim()) return;
    const co = { id: gid(), name: nNm.trim(), contact: nCt.trim(), note: "" };
    onAddCompany(co); sCid(co.id); setShN(false); sNNm(""); sNCt("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={lS}>契約企業 *</label>
        {!shN ? (
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...iS, flex: 1 }} value={cid} onChange={(e) => sCid(e.target.value)}>
              <option value="">-- 選択 --</option>
              {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
            </select>
            <button style={{ padding: "10px 16px", background: "#f0fdf4", color: "#059669", border: "1.5px solid #bbf7d0", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => setShN(true)}>+ 新規企業</button>
          </div>
        ) : (
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>新しい企業を登録</div>
            <input style={iS} placeholder="会社名 *" value={nNm} onChange={(e) => sNNm(e.target.value)} />
            <input style={iS} placeholder="担当者（任意）" value={nCt} onChange={(e) => sNCt(e.target.value)} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={{ ...bSc, padding: "8px 16px", fontSize: 13 }} onClick={() => { setShN(false); sNNm(""); sNCt(""); }}>キャンセル</button>
              <button style={{ ...bP, padding: "8px 16px", fontSize: 13, background: "#059669", opacity: nNm.trim() ? 1 : 0.4 }} disabled={!nNm.trim()} onClick={addCo}>登録して選択</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 14 }}>📅 契約期間</div>
        <div><label style={lS}>契約開始日 *</label><input type="date" style={iS} value={csd} onChange={(e) => { sCsd(e.target.value); sBMon(""); }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div><label style={lS}>起算月 *</label><input type="month" style={iS} value={bMon} onChange={(e) => sBMon(e.target.value)} /></div>
          <div><label style={lS}>起算日 *</label><select style={iS} value={bDay} onChange={(e) => sBDay(e.target.value)}><option value="1">1日</option><option value="16">16日</option></select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div><label style={lS}>契約期間（ヶ月）*</label><input style={iS} inputMode="numeric" value={dur || ""} onChange={(e) => sDur(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)} /></div>
          <div><label style={lS}>契約完了日（自動計算）</label><div style={{ ...iS, background: "#e0e7ff", color: "#1e40af", fontWeight: 700, display: "flex", alignItems: "center" }}>{endD ? fD(endD) : "—"}</div></div>
        </div>
        {bs && <div style={{ marginTop: 10, fontSize: 12, color: "#3b82f6" }}>起算日: {fD(bs)} → 完了日: {endD ? fD(endD) : "—"}</div>}
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 10 }}>💴 月額料金</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <MIn label="月額料金（税別）*" value={mF} onChange={sMF} placeholder="30,000" />
          <PayCfg label="お客様お振込日" close={mC} pay={mP} onCC={sMC} onPC={sMP} baseMonth={bMon} />
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={hI} onChange={(e) => sHI(e.target.checked)} /> 初期導入費あり
        </label>
        {hI && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <MIn label="初期導入費（税別）" value={iF} onChange={sIF} placeholder="200,000" />
          <PayCfg label="初月お客様お振込日" close={iC} pay={iP} onCC={sIC} onPC={sIP} baseMonth={bMon} />
        </div>}
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={hO} onChange={(e) => sHO(e.target.checked)} /> オプションあり
        </label>
        {hO && <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label style={lS}>オプション名</label><input style={iS} value={oN} onChange={(e) => sON(e.target.value)} placeholder="追加機能名" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MIn label="オプション月額（税別）" value={oF} onChange={sOF} />
            <PayCfg label="初月お客様お振込日" close={oC} pay={oP} onCC={sOC} onPC={sOP} baseMonth={bMon} />
          </div>
        </div>}
      </div>

      <div><label style={lS}>メモ</label><textarea style={{ ...iS, minHeight: 50, resize: "vertical" }} value={nt} onChange={(e) => sNt(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button style={bSc} onClick={onClose}>キャンセル</button>
        <button style={{ ...bP, opacity: valid ? 1 : 0.4 }} disabled={!valid} onClick={() => onSave({
          id: c?.id || gid(), productType, companyId: cid, contractStartDate: csd, billingMonth: bMon, billingDay: bDay, durationMonths: dur,
          monthlyFee: mF, monthlyClose: mC, monthlyPay: mP,
          hasInitialFee: hI, initialFee: hI ? iF : 0, initialClose: iC, initialPay: iP,
          hasOption: hO, optionFee: hO ? oF : 0, optionName: hO ? oN : "", optionClose: oC, optionPay: oP, note: nt,
        })}>{c ? "更新" : "登録"}</button>
      </div>
    </div>
  );
};

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bakusoq");
  const [modal, setModal] = useState(null);
  const [side, setSide] = useState(true);
  const [detailPid, setDetailPid] = useState(null);

  useEffect(() => { (async () => { try { const r = await window.storage.get(SK); setData(r?.value ? JSON.parse(r.value) : defData()); } catch (e) { setData(defData()); } })(); }, []);
  const save = useCallback(async (d) => { setData(d); try { await window.storage.set(SK, JSON.stringify(d)); } catch (e) {} }, []);
  const cn = useCallback((id) => data?.companies.find((c) => c.id === id)?.name || "不明", [data]);
  const aM = useMemo(() => data ? gAllM(data.contracts) : [], [data]);

  const gRev = useCallback((month, pf) => {
    if (!data) return 0;
    return data.contracts.filter((c) => !pf || c.productType === pf).reduce((sum, c) => {
      const bs = mkBS(c.billingMonth, c.billingDay), ms = bMos(bs, c.durationMonths);
      let amt = 0;
      const mo = calcPayOff(c.monthlyClose || "0", c.monthlyPay || "same_end");
      ms.forEach((m) => { if (sM(m, mo) === month) amt += c.monthlyFee; });
      if (c.hasOption) { const oo = calcPayOff(c.optionClose || "0", c.optionPay || "same_end"); ms.forEach((m) => { if (sM(m, oo) === month) amt += c.optionFee; }); }
      if (c.hasInitialFee && ms.length > 0) { if (sM(ms[0], calcPayOff(c.initialClose || "0", c.initialPay || "same_end")) === month) amt += c.initialFee; }
      return sum + amt;
    }, 0);
  }, [data]);

  if (!data) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><div>読み込み中...</div></div>;

  const svCo = (c) => { const e = data.companies.find((x) => x.id === c.id); save({ ...data, companies: e ? data.companies.map((x) => x.id === c.id ? c : x) : [...data.companies, c] }); setModal(null); };
  const addCo = (c) => save({ ...data, companies: [...data.companies, c] });
  const dlCo = (id) => { if (confirm("削除？")) save({ ...data, companies: data.companies.filter((c) => c.id !== id) }); };
  const svCn = (c) => { const e = data.contracts.find((x) => x.id === c.id); save({ ...data, contracts: e ? data.contracts.map((x) => x.id === c.id ? c : x) : [...data.contracts, c] }); setModal(null); };
  const dlCn = (id) => { if (confirm("削除？")) save({ ...data, contracts: data.contracts.filter((c) => c.id !== id) }); };
  const cFor = (pid) => data.contracts.filter((c) => c.productType === pid);

  const rCnDetail = (pid) => {
    const pr = PRODUCTS.find((p) => p.id === pid), cons = cFor(pid);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setDetailPid(null)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#475569" }}>← 戻る</button>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📋 {pr.label} 契約一覧</h2>
          </div>
          <button style={{ ...bP, background: pr.color }} onClick={() => setModal({ type: "cn", productType: pid })}>+ 契約を追加</button>
        </div>
        {cons.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#f8fafc", borderRadius: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div><div>{pr.label}の契約がまだありません</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
              <thead><tr style={{ background: "#f8fafc" }}>{["企業名", "開始", "起算", "期間", "完了", "月額", "条件", "初期", "OP", ""].map((h, i) => <th key={i} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>)}</tr></thead>
              <tbody>{cons.map((c) => {
                const bs = mkBS(c.billingMonth, c.billingDay), end = cEnd(bs, c.durationMonths);
                const bm = c.billingMonth ? parseInt(c.billingMonth.split("-")[1]) : 0;
                return (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setModal({ type: "cn", productType: pid, item: c })}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{cn(c.companyId)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{fD(c.contractStartDate)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{fD(bs)}</td>
                    <td style={{ padding: "10px 12px" }}>{c.durationMonths}ヶ月</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{fD(end)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{fY(c.monthlyFee)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 10, color: "#64748b" }}>{payDesc(c.monthlyClose || "0", c.monthlyPay || "same_end", bm)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: c.hasInitialFee ? "#1e293b" : "#cbd5e1" }}>{c.hasInitialFee ? <span>{fY(c.initialFee)}<br /><span style={{ fontSize: 9, color: "#64748b" }}>{payDesc(c.initialClose || "0", c.initialPay || "same_end", bm)}</span></span> : "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: c.hasOption ? "#1e293b" : "#cbd5e1" }}>{c.hasOption ? <span>{c.optionName} {fY(c.optionFee)}/月<br /><span style={{ fontSize: 9, color: "#64748b" }}>{payDesc(c.optionClose || "0", c.optionPay || "same_end", bm)}</span></span> : "—"}</td>
                    <td style={{ padding: "10px 12px" }}><button style={bD} onClick={(e) => { e.stopPropagation(); dlCn(c.id); }}>削除</button></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const rCns = (pid) => {
    if (detailPid === pid) return rCnDetail(pid);
    const pr = PRODUCTS.find((p) => p.id === pid), cons = cFor(pid);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📄 {pr.label} 契約</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ padding: "10px 20px", background: "#fff", color: pr.color, border: "1.5px solid " + pr.color, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }} onClick={() => setDetailPid(pid)}>📋 契約一覧</button>
            <button style={{ ...bP, background: pr.color }} onClick={() => setModal({ type: "cn", productType: pid })}>+ 契約を追加</button>
          </div>
        </div>
        {cons.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#f8fafc", borderRadius: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div><div>{pr.label}の契約がまだありません</div>
            <button style={{ ...bP, marginTop: 16, background: pr.color }} onClick={() => setModal({ type: "cn", productType: pid })}>最初の契約を追加</button>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📅 月別売上（{pr.label}）</h3>
            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #e2e8f0", position: "sticky", left: 0, background: "#f8fafc", minWidth: 120 }}>企業名</th>
                  {aM.map((m) => <th key={m} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: "#64748b", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", minWidth: 85 }}>{parseInt(m.split("-")[1])}月<br /><span style={{ fontSize: 10, color: "#94a3b8" }}>{m.split("-")[0]}</span></th>)}
                </tr></thead>
                <tbody>
                  {cons.map((c) => {
                    const bs = mkBS(c.billingMonth, c.billingDay), ms = bMos(bs, c.durationMonths);
                    const mo = calcPayOff(c.monthlyClose || "0", c.monthlyPay || "same_end");
                    const oo = c.hasOption ? calcPayOff(c.optionClose || "0", c.optionPay || "same_end") : 0;
                    const io = c.hasInitialFee ? calcPayOff(c.initialClose || "0", c.initialPay || "same_end") : 0;
                    return (
                      <tr key={c.id}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, borderBottom: "1px solid #f1f5f9", position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>{cn(c.companyId)}</td>
                        {aM.map((m) => {
                          let a = 0;
                          ms.forEach((bm) => { if (sM(bm, mo) === m) a += c.monthlyFee; });
                          if (c.hasOption) ms.forEach((bm) => { if (sM(bm, oo) === m) a += c.optionFee; });
                          if (c.hasInitialFee && ms.length > 0 && sM(ms[0], io) === m) a += c.initialFee;
                          return <td key={m} style={{ padding: "10px 8px", textAlign: "right", borderBottom: "1px solid #f1f5f9", color: a > 0 ? "#334155" : "#e2e8f0" }}>{a > 0 ? fN(a) : "—"}</td>;
                        })}
                      </tr>);
                  })}
                  <tr style={{ background: pr.bg }}>
                    <td style={{ padding: "10px 12px", fontWeight: 800, position: "sticky", left: 0, background: pr.bg }}>合計</td>
                    {aM.map((m) => { const t = gRev(m, pid); return <td key={m} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, color: pr.color }}>{t > 0 ? fN(t) : "—"}</td>; })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const rCos = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🏢 企業マスタ</h2>
        <button style={bP} onClick={() => setModal({ type: "co" })}>+ 企業を追加</button>
      </div>
      {data.companies.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#f8fafc", borderRadius: 16 }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div><div>まだ企業が登録されていません</div></div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {data.companies.map((c) => {
            const pr = [...new Set(data.contracts.filter((x) => x.companyId === c.id).map((x) => x.productType))];
            return (
              <div key={c.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setModal({ type: "co", item: c })}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>{pr.map((p) => <Bdg key={p} product={p} />)}{pr.length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>契約なし</span>}</div>
                  {c.contact && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{c.contact}</div>}
                </div>
                <button style={bD} onClick={(e) => { e.stopPropagation(); dlCo(c.id); }}>削除</button>
              </div>);
          })}
        </div>
      )}
    </div>
  );

  const rCF = () => (
    <div>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>📊 資金繰り表</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[{ l: "企業数", v: data.companies.length, u: "社", c: "#1e293b", b: "#f1f5f9" }, { l: "BAKUSOQ", v: cFor("bakusoq").length, u: "件", c: "#2563eb", b: "#dbeafe" }, { l: "NiNKUBOXX", v: cFor("ninkuboxx").length, u: "件", c: "#7c3aed", b: "#ede9fe" }, { l: "その他", v: cFor("other").length, u: "件", c: "#059669", b: "#d1fae5" }].map((x) => (
          <div key={x.l} style={{ background: x.b, borderRadius: 14, padding: "18px 20px" }}><div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{x.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: x.c, marginTop: 4 }}>{x.v}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4 }}>{x.u}</span></div></div>
        ))}
      </div>
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, position: "sticky", left: 0, background: "#f8fafc", borderBottom: "2px solid #e2e8f0", minWidth: 140 }}>項目</th>
            {aM.map((m) => <th key={m} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: "#64748b", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", minWidth: 90 }}>{parseInt(m.split("-")[1])}月<br /><span style={{ fontSize: 10, color: "#94a3b8" }}>{m.split("-")[0]}</span></th>)}
          </tr></thead>
          <tbody>
            {PRODUCTS.map((pr) => <tr key={pr.id}><td style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", position: "sticky", left: 0, background: "#fff" }}><Bdg product={pr.id} /></td>{aM.map((m) => { const v = gRev(m, pr.id); return <td key={m} style={{ padding: "8px 8px", textAlign: "right", borderBottom: "1px solid #f1f5f9", color: v > 0 ? "#334155" : "#e2e8f0" }}>{v > 0 ? fN(v) : "—"}</td>; })}</tr>)}
            <tr style={{ background: "#f0fdf4" }}>
              <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 14, position: "sticky", left: 0, background: "#f0fdf4", color: "#059669" }}>売上合計</td>
              {aM.map((m) => { const v = gRev(m); return <td key={m} style={{ padding: "12px 8px", textAlign: "right", fontWeight: 800, fontSize: 13, color: "#059669" }}>{v > 0 ? fN(v) : "—"}</td>; })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const content = tab === "cashflow" ? rCF() : tab === "companies" ? rCos() : rCns(tab);

  return (
    <div style={{ fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif", display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ width: side ? 220 : 56, background: "#0f172a", color: "#fff", transition: "width 0.3s", overflow: "hidden", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: side ? "20px 18px" : "20px 10px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSide(!side)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{side ? "◀" : "▶"}</button>
          {side && <span style={{ fontSize: 15, fontWeight: 800 }}>💼 財務管理</span>}
        </div>
        <div style={{ padding: "12px 8px", flex: 1 }}>
          {TABS.map((t, i) => (
            <div key={t.id}>
              {i === 3 && <div style={{ borderTop: "1px solid #1e3a5f", margin: side ? "10px 10px" : "10px 4px" }} />}
              <button onClick={() => { setTab(t.id); setDetailPid(null); }} style={{ width: "100%", padding: side ? "10px 14px" : "10px 0", background: tab === t.id ? "#1e40af" : "transparent", color: tab === t.id ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: tab === t.id ? 700 : 500, marginBottom: 2, justifyContent: side ? "flex-start" : "center", fontFamily: "inherit" }}><span style={{ fontSize: 16 }}>{t.icon}</span>{side && t.label}</button>
            </div>
          ))}
        </div>
        {side && <div style={{ padding: "12px 18px", borderTop: "1px solid #1e293b", fontSize: 11, color: "#475569" }}>自動保存</div>}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}><div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 32px" }}>{content}</div></div>
      <Modal open={!!modal && modal.type === "co"} onClose={() => setModal(null)} title={modal?.item ? "企業を編集" : "企業を登録"}>
        <CoForm company={modal?.item} onSave={svCo} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={!!modal && modal.type === "cn"} onClose={() => setModal(null)} title={modal?.item ? "契約を編集" : "契約を登録"}>
        <ConForm contract={modal?.item} productType={modal?.productType} companies={data.companies} onSave={svCn} onAddCompany={addCo} onClose={() => setModal(null)} />
      </Modal>
    </div>
  );
}
