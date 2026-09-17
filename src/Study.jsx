import { useState } from "react";



const norm = (s) => (s || "").trim().toLowerCase().replace(/[.\s]+$/, "");
function isCorrect(q, ans) {
  if (q.type === "fill") {
    if (ans == null) return false;
    const a = norm(ans), b = norm(q.answerText);
    return a.length > 0 && (a === b || (b.length > 3 && b.includes(a) && a.length >= 3));
  }
  return ans === q.answerIndex;
}
const TYPE_LABEL = { mc: "multiple choice", tf: "true / false", fill: "fill in the blank" };

// Gemini doesn't always return the exact "mc" / "tf" / "fill" enum we expect —
// sometimes it sends human-readable variants like "Fill In Blank" or "True or False".
// Normalize on ingest so the rest of the app can rely on a strict 3-value type.
const TYPE_MAP = {
  mc: "mc", multiplechoice: "mc",
  tf: "tf", truefalse: "tf",
  fill: "fill", fillintheblank: "fill", fillinblank: "fill", fillintheblanks: "fill",
};
function normalizeType(t) {
  const key = (t || "").toLowerCase().replace(/[^a-z]/g, "");
  const mapped = TYPE_MAP[key];
  if (!mapped) {
    console.warn(`Unrecognized question type "${t}" — defaulting to "mc". Check the backend/Gemini schema.`);
    return "mc";
  }
  return mapped;
}

/* ---------- shared rendering ---------- */
function TypeBadge({ t }) {
  return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/40 text-zinc-400">{TYPE_LABEL[t] || t}</span>;
}

function Choices({ q, selected, onSelect, locked, reveal }) {
  return (
    <div className="space-y-2">
      {q.options.map((opt, idx) => {
        let cls = "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600";
        if (reveal) {
          if (idx === q.answerIndex) cls = "border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
          else if (idx === selected) cls = "border-red-500/60 bg-red-500/10 text-red-200";
          else cls = "border-zinc-800 bg-zinc-950 text-zinc-600";
        } else if (selected === idx) { cls = "border-amber-400/60 bg-amber-400/10 text-amber-100"; }
        return (
          <button key={idx} onClick={() => !locked && onSelect(idx)} disabled={locked}
            className={"w-full text-left px-4 py-2.5 rounded-lg border text-sm font-mono transition " + cls}>
            <span className="text-zinc-600 mr-2">{String.fromCharCode(65 + idx)}.</span>{opt}
          </button>
        );
      })}
    </div>
  );
}

function FillInput({ value, onChange, locked, reveal, q }) {
  const ok = reveal && isCorrect(q, value);
  return (
    <div>
      <input type="text" value={value || ""} disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder="type your answer"
        className={"w-full px-4 py-2.5 rounded-lg border text-sm font-mono bg-zinc-950 outline-none " +
          (reveal ? (ok ? "border-emerald-500/60 text-emerald-200" : "border-red-500/60 text-red-200") : "border-zinc-800 text-zinc-200 focus:border-amber-400/60")} />
      {reveal && !ok && <div className="mt-2 text-xs font-mono text-emerald-300">answer: {q.answerText}</div>}
    </div>
  );
}

/* ---------- LEARN (immediate feedback) ---------- */
function Learn({ questions }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState({ right: 0, done: 0 });
  const q = questions[i];

  const submit = () => {
    if (submitted) return;
    const correct = isCorrect(q, ans);
    setSubmitted(true);
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), done: s.done + 1 }));
  };
  const next = () => { setAns(null); setSubmitted(false); setI((p) => (p + 1) % questions.length); };
  const canSubmit = q.type === "fill" ? (ans && ans.trim()) : ans != null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs font-mono">
        <span className="text-zinc-500">Q {i + 1} / {questions.length}</span>
        <span className="text-zinc-400">Score <span className="text-emerald-400">{score.right}</span>/{score.done}</span>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3"><TypeBadge t={q.type} /></div>
        <div className="text-[15px] text-zinc-100 mb-4 leading-relaxed">{q.question}</div>
        {q.type === "fill"
          ? <FillInput q={q} value={ans} onChange={(v) => !submitted && setAns(v)} locked={submitted} reveal={submitted} />
          : <Choices q={q} selected={ans} onSelect={(idx) => !submitted && setAns(idx)} locked={submitted} reveal={submitted} />}
        {submitted && (
          <div className="mt-4 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
            <div className={"text-xs font-mono mb-1 " + (isCorrect(q, ans) ? "text-emerald-400" : "text-red-400")}>{isCorrect(q, ans) ? "\u2713 Correct" : "\u2717 Incorrect"}</div>
            <div className="text-sm text-zinc-400 leading-relaxed">{q.explanation}</div>
          </div>
        )}
      </div>
      {!submitted
        ? <button onClick={submit} disabled={!canSubmit} className="mt-4 w-full px-4 py-2.5 rounded-md bg-amber-400 text-zinc-950 font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed">Check</button>
        : <button onClick={next} className="mt-4 w-full px-4 py-2.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm hover:bg-zinc-700">Next \u2192</button>}
    </div>
  );
}

/* ---------- FLASHCARDS ---------- */
function Flashcards({ cards }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (cards.length === 0) return <div className="text-center text-zinc-500 text-sm font-mono py-16 border border-dashed border-zinc-800 rounded-xl">No flashcards in this set.</div>;
  const c = cards[i];
  const go = (d) => { setI((p) => (p + d + cards.length) % cards.length); setFlip(false); };
  return (
    <div>
      <div className="text-xs font-mono text-zinc-500 mb-3">Card {i + 1} / {cards.length}</div>
      <button onClick={() => setFlip((f) => !f)} className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 p-6 min-h-[200px] flex flex-col justify-center hover:border-zinc-700 transition">
        <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-3">{flip ? "definition" : "term"}</div>
        <div className={flip ? "text-[15px] text-zinc-300 leading-relaxed" : "text-xl text-zinc-100 font-medium"}>{flip ? c.back : c.front}</div>
        {!flip && <div className="text-xs text-zinc-600 mt-5 font-mono">tap to flip &rarr;</div>}
      </button>
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => go(-1)} className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm hover:border-zinc-600">&larr; Prev</button>
        <button onClick={() => setFlip((f) => !f)} className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm">Flip</button>
        <button onClick={() => go(1)} className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm hover:border-zinc-600">Next &rarr;</button>
      </div>
    </div>
  );
}

/* ---------- TEST (no feedback until submit) ---------- */
function Test({ questions }) {
  const [answers, setAnswers] = useState({});
  const [cur, setCur] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[cur];
  const set = (v) => setAnswers((a) => ({ ...a, [cur]: v }));

  if (done) {
    let right = 0; questions.forEach((qq, idx) => { if (isCorrect(qq, answers[idx])) right++; });
    const pct = Math.round((right / questions.length) * 100);
    return (
      <div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center mb-4">
          <div className={"text-5xl font-mono mb-2 " + (pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-300" : "text-red-400")}>{pct}%</div>
          <div className="text-zinc-500 text-sm">{right} / {questions.length} correct</div>
        </div>
        <div className="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-2">review</div>
        <div className="space-y-3">
          {questions.map((qq, idx) => {
            const ok = isCorrect(qq, answers[idx]);
            const given = qq.type === "fill" ? (answers[idx] || "\u2014") : (answers[idx] != null ? qq.options[answers[idx]] : "\u2014");
            const correct = qq.type === "fill" ? qq.answerText : qq.options[qq.answerIndex];
            return (
              <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex gap-2 items-center mb-2"><span className={"text-xs font-mono " + (ok ? "text-emerald-400" : "text-red-400")}>{ok ? "\u2713" : "\u2717"}</span><TypeBadge t={qq.type} /></div>
                <div className="text-sm text-zinc-200 mb-2">{qq.question}</div>
                <div className="text-xs font-mono text-zinc-400">your answer: {given}</div>
                {!ok && <div className="text-xs font-mono text-emerald-300 mt-0.5">correct: {correct}</div>}
                <div className="text-xs text-zinc-500 leading-relaxed mt-1">{qq.explanation}</div>
              </div>
            );
          })}
        </div>
        <button onClick={() => { setDone(false); setAnswers({}); setCur(0); }} className="mt-5 w-full py-3 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm hover:bg-zinc-700">Retake</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs font-mono">
        <span className="text-zinc-500">Q {cur + 1} / {questions.length}</span>
        <span className="text-zinc-500">{Object.keys(answers).length} answered</span>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3"><TypeBadge t={q.type} /></div>
        <div className="text-[15px] text-zinc-100 mb-4 leading-relaxed">{q.question}</div>
        {q.type === "fill"
          ? <FillInput q={q} value={answers[cur]} onChange={set} locked={false} reveal={false} />
          : <Choices q={q} selected={answers[cur]} onSelect={set} locked={false} reveal={false} />}
      </div>
      <div className="flex items-center justify-between mt-4 gap-2">
        <button onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0} className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm disabled:opacity-40">&larr; Prev</button>
        {cur < questions.length - 1
          ? <button onClick={() => setCur((c) => c + 1)} className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm">Next &rarr;</button>
          : <button onClick={() => setDone(true)} className="px-5 py-2 rounded-md bg-emerald-500 text-zinc-950 font-medium text-sm hover:bg-emerald-400">Submit</button>}
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {questions.map((_, idx) => (
          <button key={idx} onClick={() => setCur(idx)}
            className={"w-7 h-7 rounded text-[11px] font-mono border " + (idx === cur ? "border-amber-400 text-amber-300" : answers[idx] != null ? "border-zinc-600 bg-zinc-800 text-zinc-300" : "border-zinc-800 text-zinc-600")}>{idx + 1}</button>
        ))}
      </div>
    </div>
  );
}

export default function Study({ content }) {
  const [mode, setMode] = useState("learn");
  const data = JSON.parse(content);
  const questions = data.questions.map(q => ({ ...q, type: normalizeType(q.type) }));
  return <section className="study"><div className="tabs">
    {[["learn","Learn"],["cards","Flashcards"],["test","Test"]].map(([key,label]) => <button key={key} aria-pressed={mode===key} onClick={() => setMode(key)}>{label}</button>)}
    </div>{mode === "learn" && <Learn questions={questions} />}
    {mode === "cards" && <Flashcards cards={data.flashcards} />}
    {mode === "test" && <Test questions={questions} />}</section>;
}
