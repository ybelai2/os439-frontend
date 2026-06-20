import { useState } from "react";

const API = "https://drillapi.onrender.com";

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

function App() {
  const [data, setData] = useState(null); // { flashcards, questions }
  const [mode, setMode] = useState("learn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");

  const upload = async (files) => {
    if (!files || files.length === 0) return;
    setFileName(files.length === 1 ? files[0].name : `${files.length} files`);
    setLoading(true); setError(null); setData(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      const res = await fetch(API + "/api/generate", { method: "POST", body: form });
      if (!res.ok) throw new Error("Server returned " + res.status + (res.status === 503 ? " — Gemini is busy, try again in a moment." : ""));
      const d = await res.json();
      if (!d || !Array.isArray(d.questions) || d.questions.length === 0) throw new Error("No questions came back.");
      setData(d); setMode("learn");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen text-zinc-200 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="font-mono text-lg text-zinc-100 mb-1">OS439 <span className="text-amber-400">//</span> <span className="text-zinc-400">drill</span></div>
        <div className="text-xs text-zinc-600 font-mono mb-6">upload a .pptx &rarr; AI builds your study set</div>

        {!data && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <label className="block">
              <span className="text-sm text-zinc-400">Upload a PowerPoint (.pptx)</span>
              <input type="file" accept=".pptx" multiple disabled={loading} onChange={(e) => upload(e.target.files)}
                className="mt-3 block w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-amber-400 file:text-zinc-950 file:font-medium hover:file:bg-amber-300 file:cursor-pointer" />
            </label>
            {loading && <div className="mt-5 text-sm font-mono text-amber-300">Building study set from &ldquo;{fileName}&rdquo;&hellip;<div className="text-xs text-zinc-600 mt-1">First request can take ~50s while the server wakes.</div></div>}
            {error && <div className="mt-5 text-sm font-mono text-red-400 border border-red-500/30 bg-red-500/5 rounded-md px-3 py-2">{error}</div>}
          </div>
        )}

        {data && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                {[["learn", "Learn"], ["cards", "Flashcards"], ["test", "Test"]].map(([k, l]) => (
                  <button key={k} onClick={() => setMode(k)}
                    className={"px-3.5 py-1.5 rounded-md text-sm font-mono transition " + (mode === k ? "bg-zinc-800 text-amber-300" : "text-zinc-500 hover:text-zinc-300")}>{l}</button>
                ))}
              </div>
              <button onClick={() => { setData(null); setFileName(""); }} className="text-xs font-mono text-zinc-600 hover:text-zinc-300">new deck</button>
            </div>
            {mode === "learn" && <Learn questions={data.questions} />}
            {mode === "cards" && <Flashcards cards={data.flashcards || []} />}
            {mode === "test" && <Test questions={data.questions} />}
          </div>
        )}
      </div>
    </div>
  );
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
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState([]);
  const [flip, setFlip] = useState(false);
  const [mastered, setMastered] = useState(0);

  if (cards.length === 0) {
    return <div className="text-center text-zinc-500 text-sm font-mono py-16 border border-dashed border-zinc-800 rounded-xl">No flashcards in this set.</div>;
  }

  const startSession = (size) => {
    const order = [...cards.keys()].sort(() => Math.random() - 0.5).slice(0, size);
    setQueue(order);
    setMastered(0);
    setFlip(false);
    setStarted(true);
  };

  if (!started) {
    const sizes = [10, 20, 30].filter((n) => n < cards.length);
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="text-sm text-zinc-400 mb-1">{cards.length} cards in this deck</div>
        <div className="text-xs text-zinc-600 font-mono mb-5">study in focused batches instead of the whole deck at once</div>
        <div className="flex gap-2 flex-wrap">
          {sizes.map((n) => (
            <button key={n} onClick={() => startSession(n)}
              className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-mono hover:border-amber-400/60 hover:text-amber-300 transition">
              {n} cards
            </button>
          ))}
          <button onClick={() => startSession(cards.length)}
            className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-mono hover:border-amber-400/60 hover:text-amber-300 transition">
            all {cards.length}
          </button>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <div className="text-2xl text-emerald-300 font-mono mb-2">session cleared</div>
        <div className="text-sm text-zinc-400 mb-5">{mastered} marked as known</div>
        <button onClick={() => setStarted(false)} className="px-5 py-2.5 rounded-md bg-amber-400 text-zinc-950 font-medium text-sm">new session</button>
      </div>
    );
  }

  const c = cards[queue[0]];
  const total = mastered + queue.length;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const gotIt = () => { setMastered((m) => m + 1); setQueue((q) => q.slice(1)); setFlip(false); };
  const stillLearning = () => { setQueue((q) => [...q.slice(1), q[0]]); setFlip(false); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-xs font-mono">
        <span className="text-zinc-500">{queue.length} left</span>
        <span className="text-emerald-400">{mastered} known</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-4">
        <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div style={{ perspective: "1200px" }}>
        <div
          onClick={() => setFlip((f) => !f)}
          className="relative w-full min-h-[220px] cursor-pointer"
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1)",
            transform: flip ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col justify-center hover:border-amber-400/40 transition-colors"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/70 mb-3">term</div>
            <div className="text-xl text-zinc-100 font-medium leading-snug">{c.front}</div>
            <div className="text-xs text-zinc-600 mt-5 font-mono">tap to flip &rarr;</div>
          </div>
          <div
            className="absolute inset-0 rounded-xl border border-emerald-500/30 bg-zinc-900 p-6 flex flex-col justify-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70 mb-3">definition</div>
            <div className="text-[15px] text-zinc-300 leading-relaxed">{c.back}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button onClick={stillLearning} className="py-3 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-mono hover:border-red-500/50 hover:text-red-300 transition">still learning</button>
        <button onClick={gotIt} className="py-3 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-mono hover:border-emerald-500/50 hover:text-emerald-300 transition">got it</button>
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

export default App;
