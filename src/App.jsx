import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Study from './Study';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [authError, setAuthError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('drill-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('drill-theme', theme); }, [theme]);
  useEffect(() => {
    let active = true;
    const expired = () => { setUser(null); setAuthError('Your session ended. Please sign in again.'); };
    window.addEventListener('drill-session-expired', expired);
    if (getToken()) api('/api/auth/me').then(u => { if (active) setUser(u); }).catch(e => { if (active) setAuthError(e.message); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; window.removeEventListener('drill-session-expired', expired); };
  }, []);
  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); setToken(null); setUser(null); }
    catch (e) { setAuthError(e.message); }
  }
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/">drill<span>✳</span></a><span className="tagline">A little practice. A deeper understanding.</span>
      <div className="header-actions"><button className="quiet" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
        {user && <><span className="user-name">{user.name}</span><button className="quiet" onClick={logout}>Sign out</button></>}</div></header>
    {authError && <div className="notice" role="alert">{authError}<button onClick={() => setAuthError('')} aria-label="Dismiss message">×</button></div>}
    {checking ? <p className="empty" role="status">Opening your workspace…</p> : user ? <Workspace key={user.id} /> : <Auth onSuccess={session => { setToken(session.token); setUser(session.user); setAuthError(''); }} />}
    <footer>DRILL / YOUR STUDY WORKSPACE <span>Built for the next “I get it.”</span></footer>
  </div>;
}

function Auth({ onSuccess }) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { onSuccess(await api(`/api/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: values })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="intro"><p className="eyebrow">LESS SCATTER. MORE RECALL.</p><h1>Make knowledge<br /><em>stick.</em></h1><p>Your courses, class notes, and study decks.<br />One calm place to come back to.</p><div className="intro-steps"><span>01 / Organize your classes</span><span>02 / Turn slides into practice</span><span>03 / Return. Recall. Repeat.</span></div></section>
    <section className="panel auth-panel"><p className="eyebrow">YOUR NEXT STUDY SESSION STARTS HERE</p><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{signup ? 'Keep your learning in one place.' : 'Pick up where you left your materials.'}</p>
      <form onSubmit={submit}><fieldset disabled={busy}>{signup && <label>Your name<input name="name" autoComplete="name" required maxLength={80} /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Password<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} maxLength={72} /></label>
        {signup && <small className="muted">Use at least 12 characters.</small>}
        {error && <p className="error" role="alert">{error}</p>}<button className="primary full" type="submit">{busy ? 'Please wait…' : signup ? 'Create account →' : 'Sign in →'}</button></fieldset></form>
      <button className="text-button" disabled={busy} onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Already have an account? Sign in' : 'New to Drill? Create an account'}</button>
    </section></main>;
}

function Workspace() {
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [decks, setDecks] = useState([]);
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [deck, setDeck] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const classPath = course ? `/api/courses/${course.id}/classes` : '';
  const deckPath = lesson ? `${classPath}/${lesson.id}/decks` : '';
  useEffect(() => {
    const abort = new AbortController();
    const path = lesson ? `/api/courses/${course.id}/classes/${lesson.id}/decks` : course ? `/api/courses/${course.id}/classes` : '/api/courses';
    api(path, { signal: abort.signal }).then(items => {
      if (lesson) setDecks(items); else if (course) setClasses(items); else setCourses(items);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [course, lesson, revision]);
  function navigate(nextCourse, nextLesson = null) { setCourse(nextCourse); setLesson(nextLesson); setDeck(null); setSearch(''); setLoading(true); setError(''); }
  async function perform(action) {
    setBusy(true); setError('');
    try { await action(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  async function remove(kind, item) {
    const suffix = kind === 'course' ? ' and all its classes and decks' : kind === 'class' ? ' and all its decks' : '';
    if (!confirm(`Delete “${item.title}”${suffix}? This cannot be undone.`)) return;
    await perform(async () => {
      await api(`${kind === 'course' ? '/api/courses' : kind === 'class' ? classPath : deckPath}/${item.id}`, { method: 'DELETE' });
      setLoading(true); setRevision(r => r + 1); if (deck?.id === item.id) setDeck(null);
    });
  }
  async function save(values) {
    const { kind, item } = editor;
    const base = kind === 'course' ? '/api/courses' : kind === 'class' ? classPath : deckPath;
    let body = values;
    if (kind === 'class') body = { ...values, studied: values.studied === 'on' };
    const ok = await perform(async () => {
      const saved = await api(base + (item ? `/${item.id}` : ''), { method: item ? 'PUT' : 'POST', body });
      if (deck?.id === saved.id) setDeck(saved);
      setLoading(true); setRevision(r => r + 1);
    });
    if (ok) setEditor(null);
  }
  async function generate(event) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const files = data.getAll('files');
    if (files.length > 10 || files.some(f => f.size > 20 * 1024 * 1024) || files.reduce((n, f) => n + f.size, 0) > 50 * 1024 * 1024) { setError('Choose up to 10 files, 20 MB each, 50 MB total.'); return; }
    await perform(async () => {
      const saved = await api(`${classPath}/${lesson.id}/generate`, { method: 'POST', body: data });
      setDecks(items => [...items, saved]); setDeck(saved); form.reset();
    });
  }
  const kind = lesson ? 'deck' : course ? 'class' : 'course';
  const items = (lesson ? decks : course ? classes : courses).filter(i => `${i.title} ${i.code || ''} ${i.semester || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="workspace"><nav className="breadcrumbs" aria-label="Breadcrumb"><button disabled={busy} onClick={() => navigate(null)}>My courses</button>{course && <><span>/</span><button disabled={busy} onClick={() => navigate(course)}>{course.code || course.title}</button></>}{lesson && <><span>/</span><button disabled={busy} onClick={() => { setDeck(null); }}>{lesson.title}</button></>}</nav>
    <div className="page-heading"><div><p className="eyebrow">{lesson ? 'YOUR STUDY MATERIALS' : course ? course.semester || 'COURSE WORKSPACE' : 'YOUR LEARNING, ORGANIZED'}</p><h1>{deck ? deck.title : lesson ? lesson.title : course ? course.title : 'My courses'}</h1><p className="muted">{lesson ? lesson.notes || 'Create a study deck from your lecture slides.' : course ? course.description || 'Give each lecture its own space.' : 'A home for everything you’re learning.'}</p></div>
      {!lesson && <button className="primary" disabled={busy} onClick={() => setEditor({ kind })}>+ Add {kind}</button>}</div>
    {error && <div className="notice error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    <fieldset disabled={busy} className="workspace-content">
    {deck ? <><div className="deck-toolbar"><button onClick={() => setDeck(null)}>← All study decks</button><button onClick={() => setEditor({ kind: 'deck', item: deck })}>Edit deck</button></div><Study key={deck.id + deck.content} content={deck.content} /></> : <>
    {lesson && <form className="panel upload-panel" onSubmit={generate}><div><p className="eyebrow">FROM SLIDES TO STUDY SESSION</p><h2>Build a new deck</h2><p className="muted">AI-generated flashcards and questions, saved to this class.</p></div><label>Deck title<input name="title" required maxLength={160} placeholder="e.g. Lecture 03 — Memory management" /></label><label>PowerPoint slides<input name="files" type="file" accept=".pptx" multiple required /></label><small className="muted">Up to 10 files · 20 MB each · 50 MB total</small><button className="primary" type="submit">{busy ? 'Generating and saving…' : 'Generate study deck ↗'}</button>{busy && <p role="status">This can take several minutes. Keep this page open.</p>}</form>}
    <div className="list-heading"><h2>{lesson ? 'Saved decks' : course ? 'Classes & lectures' : 'Course library'}</h2><input type="search" aria-label={`Search ${kind}s`} placeholder={`Search ${kind === 'class' ? 'classes' : kind + 's'}…`} value={search} onChange={e => setSearch(e.target.value)} /></div>
    {loading ? <p className="empty" role="status">Loading your library…</p> : items.length === 0 ? <div className="empty panel"><span className="empty-symbol">✳</span><h2>{search ? 'No matches' : `Your first ${kind} starts here`}</h2><p className="muted">{search ? 'Try another search.' : lesson ? 'Upload slides above to generate a deck you can revisit.' : `Add a ${kind} to start organizing your studies.`}</p></div> : <div className="card-grid">{items.map((item, index) => <article className="panel library-card" key={item.id}><div className="card-top"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="badge">{kind === 'course' ? item.semester || 'Course' : kind === 'class' ? item.studied ? 'Studied ✓' : 'To study' : 'Study deck'}</span></div><button className="card-open" onClick={() => kind === 'course' ? navigate(item) : kind === 'class' ? navigate(course, item) : setDeck(item)}>{item.code && <small>{item.code}</small>}<h3>{item.title}</h3><p>{kind === 'course' ? item.description || 'Open course →' : kind === 'class' ? item.notes || 'Open class →' : 'Learn, review flashcards, or take a test →'}</p></button><div className="card-actions"><button onClick={() => setEditor({ kind, item })}>Edit</button><button className="danger" onClick={() => remove(kind, item)}>Delete</button>{kind === 'class' && <button className="status-button" onClick={() => perform(async () => { await api(`${classPath}/${item.id}`, { method: 'PUT', body: { title: item.title, notes: item.notes, studied: !item.studied } }); setLoading(true); setRevision(r => r + 1); })}>{item.studied ? 'Mark to study' : 'Mark studied'}</button>}</div></article>)}</div>}
    </>}
    </fieldset>
    {editor && <Editor key={editor.item?.id || editor.kind} editor={editor} busy={busy} error={error} onSave={save} onClose={() => setEditor(null)} />}
  </main>;
}

function Editor({ editor: { kind, item }, busy, error, onSave, onClose }) {
  useEffect(() => {
    const dialog = document.getElementById('record-editor'); dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog id="record-editor" aria-labelledby="editor-heading" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><form onSubmit={event => { event.preventDefault(); onSave(Object.fromEntries(new FormData(event.currentTarget))); }}><fieldset disabled={busy}><div className="dialog-heading"><h2 id="editor-heading">{item ? 'Edit' : 'Add'} {kind}</h2><button type="button" onClick={onClose} aria-label="Close editor">×</button></div>
    <label>Title<input name="title" required maxLength={160} defaultValue={item?.title || ''} autoFocus /></label>
    {kind === 'course' && <><label>Course code<input name="code" maxLength={40} defaultValue={item?.code || ''} placeholder="COSC 350" /></label><label>Semester<input name="semester" maxLength={80} defaultValue={item?.semester || ''} placeholder="Fall 2026" /></label><label>Description<textarea name="description" maxLength={2000} defaultValue={item?.description || ''} /></label></>}
    {kind === 'class' && <><label>Class notes<textarea name="notes" maxLength={10000} defaultValue={item?.notes || ''} /></label><label className="check"><input type="checkbox" name="studied" defaultChecked={item?.studied || false} />I’ve studied this class</label></>}
    {kind === 'deck' && <DeckFields content={item.content} />}
    {error && <p className="error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">{busy ? 'Saving…' : 'Save changes'}</button></div></fieldset></form></dialog>;
}

function DeckFields({ content }) {
  const [data, setData] = useState(() => JSON.parse(content));
  function change(group, index, field, value) {
    setData(current => ({ ...current, [group]: current[group].map((entry, i) => i === index ? { ...entry, [field]: value } : entry) }));
  }
  return <div className="deck-fields"><input type="hidden" name="content" value={JSON.stringify(data)} />
    <h3>Flashcards</h3>{data.flashcards.map((card, i) => <details key={i}><summary>Card {i + 1}: {card.front}</summary>
      <label>Question<textarea required value={card.front} onChange={e => change('flashcards', i, 'front', e.target.value)} /></label>
      <label>Answer<textarea required value={card.back} onChange={e => change('flashcards', i, 'back', e.target.value)} /></label></details>)}
    <h3>Questions</h3>{data.questions.map((question, i) => <details key={i}><summary>Question {i + 1}: {question.question}</summary>
      <label>Question<textarea required value={question.question} onChange={e => change('questions', i, 'question', e.target.value)} /></label>
      {question.options.map((option, j) => <label key={j}>Option {j + 1}<input required value={option} onChange={e => change('questions', i, 'options', question.options.map((text, k) => j === k ? e.target.value : text))} /></label>)}
      {question.options.length ? <label>Correct option number<input type="number" min="1" max={question.options.length} required value={question.answerIndex + 1} onChange={e => change('questions', i, 'answerIndex', Number(e.target.value) - 1)} /></label> : <label>Correct answer<input required value={question.answerText} onChange={e => change('questions', i, 'answerText', e.target.value)} /></label>}
      <label>Explanation<textarea required value={question.explanation} onChange={e => change('questions', i, 'explanation', e.target.value)} /></label></details>)}
  </div>;
}
