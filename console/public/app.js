// We Love Scripture console. Plain JavaScript, no build step.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view'), modal = $('#modal');
const TYPES = { gather: 'Guide', read: 'Article', watch: 'Video', kids: 'Kids' };
let dirty = false, overview = null, projectsCache = [];

async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', 'x-wls-console': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}
function toast(msg, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), bad ? 6000 : 2800); }
const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const today = () => new Date().toISOString().slice(0, 10);
const go = h => { location.hash = h; };
const busy = async (btn, fn) => { const o = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = o; } };

function openModal(html, onMount) { modal.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true">${html}</div>`; modal.hidden = false; onMount?.(modal); modal.querySelector('input,select,textarea,button')?.focus(); }
const closeModal = () => { modal.hidden = true; modal.innerHTML = ''; };
modal.addEventListener('mousedown', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ---------- navigation
const NAV = [
  ['Home', '#/home'], ['grp', 'Make'], ['Resources', '#/resources', 'resources'], ['Projects', '#/projects', 'projects'], ['Pages', '#/pages'], ['Podcast episodes', '#/episodes'], ['Images', '#/media'],
  ['grp', 'Shape the site'], ['Menu links', '#/nav'], ['Growth counters', '#/counters'], ['Settings', '#/settings'], ['grp', 'Care'], ['Search & health check', '#/check', 'checks'], ['Updates', '#/updates']
];
async function refreshOverview() { try { overview = await api('GET', '/overview'); } catch {} drawNav(); }
function drawNav() {
  const cur = location.hash || '#/home';
  $('#nav').innerHTML = NAV.map(([a, b, k]) => a === 'grp' ? `<div class="grp">${b}</div>` : `<a href="${b}" class="${cur.startsWith(b) ? 'on' : ''}">${a}${k && overview ? (k === 'checks' ? (overview.checks ? `<span class="n">${overview.checks}</span>` : '') : `<span class="n">${overview.counts[k]}</span>`) : ''}</a>`).join('');
  const g = overview?.git; const n = g?.changes?.length || 0;
  $('#publishBtn').textContent = n ? `Publish ${n} change${n > 1 ? 's' : ''}` : 'Publish to the web';
}
$('#publishBtn').onclick = () => go('#/publish');
$('#menu').onclick = () => $('#side').classList.toggle('open');
$('#side').addEventListener('click', e => { if (e.target.closest('a')) $('#side').classList.remove('open'); });

function setTop(crumb, actions = '') { $('#crumb').textContent = crumb; $('#topActions').innerHTML = actions; }
async function route() {
  if (dirty && !confirm('You have changes that are not saved. Leave without saving?')) { history.back(); return; }
  clearInterval(Editor.timer); dirty = false; const h = (location.hash || '#/home').slice(2).split('/').map(decodeURIComponent); const [a, b, c] = h;
  drawNav(); view.innerHTML = '<p class="empty"><span class="spin"></span></p>'; window.scrollTo(0, 0);
  try {
    if (a === 'home') await Home();
    else if (a === 'resources' && b === 'edit') await Editor('resources', c);
    else if (a === 'resources') await Resources();
    else if (a === 'projects' && b === 'edit') await Editor('projects', c);
    else if (a === 'projects') await Projects();
    else if (a === 'pages' && b === 'edit') await Editor('pages', c);
    else if (a === 'pages') await Pages();
    else if (a === 'episodes') await Episodes();
    else if (a === 'media') await Media();
    else if (a === 'nav') await NavEditor();
    else if (a === 'counters') await Counters();
    else if (a === 'settings') await Settings();
    else if (a === 'check') await Check();
    else if (a === 'updates') await Updates();
    else if (a === 'publish') await Publish();
    else if (a === 'preview') await Preview();
    else go('#/home');
  } catch (e) { view.innerHTML = `<div class="msg msg--warn"><b>That did not work.</b> ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);

// ---------- Home
async function Home() {
  await refreshOverview(); const o = overview, c = o.counts, g = o.git;
  setTop('Home');
  const stat = (n, l, h) => `<a class="card stat" style="text-decoration:none;color:inherit" href="${h}"><b>${n}</b><span>${l}</span></a>`;
  view.innerHTML = `<div class="head"><div><h1>Welcome back</h1><p class="lede">Everything you need to keep ${esc(o.site.name)} going. Write something, check how it looks, then publish.</p></div></div>
  <div class="grid grid--3" style="margin-bottom:22px">${stat(c.gather, 'Guides published', '#/resources')}${stat(c.read, 'Articles published', '#/resources')}${stat(c.watch, 'Videos published', '#/resources')}${stat(c.episodes, 'Podcast episodes', '#/episodes')}${stat(c.drafts, 'Drafts waiting', '#/resources')}${stat(c.projects, 'Projects', '#/projects')}</div>
  <div class="grid grid--2">
   <section class="card"><h2>Start something</h2><p class="lede" style="margin-bottom:14px">A good rhythm: one guide, one video, one conversation.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-new="gather">New guide</button><button class="btn btn--ghost" data-new="read">New article</button><button class="btn btn--ghost" data-new="watch">Add a video</button><button class="btn btn--ghost" data-new="project">New project</button></div></section>
   <section class="card"><h2>Publishing</h2>${!g.isRepo ? '<p class="lede">This folder is not connected to GitHub yet.</p><p style="margin-top:12px"><a class="btn" href="#/publish">Set up publishing</a></p>' : `<p class="lede">${g.changes.length ? `<b>${g.changes.length}</b> change${g.changes.length > 1 ? 's' : ''} not yet on the web.` : 'Everything is published.'}</p><p style="margin-top:12px"><a class="btn ${g.changes.length ? 'btn--lamp' : 'btn--ghost'}" href="#/publish">${g.changes.length ? 'Publish now' : 'See details'}</a></p>`}</section>
   <section class="card"><h2>Health check</h2><p class="lede">${o.checks ? `${o.checks} thing${o.checks > 1 ? 's' : ''} could help people find your work.` : 'Everything looks good for search engines and social sharing.'}</p><p style="margin-top:12px"><a class="btn btn--ghost" href="#/check">Open the check</a></p></section>
   <section class="card"><h2>Preview</h2><p class="lede">See the whole site, drafts included, before anyone else does.</p><p style="margin-top:12px"><a class="btn btn--ghost" href="#/preview">Preview the site</a></p></section>
  </div>`;
  $$('[data-new]').forEach(b => b.onclick = () => newItem(b.dataset.new));
}
function newItem(type) {
  if (type === 'project') return createItem('projects', { title: 'New project', summary: '', color: 'teal', lampX: 78, lampY: 34, order: 10, draft: true }, 'Describe the series in a sentence or two.');
  if (type === 'watch') return openModal(`<h2>Add a video</h2><div class="field"><label for="yu">YouTube link</label><input type="url" id="yu" placeholder="https://www.youtube.com/watch?v=..."><p class="hint">Upload the video to YouTube first, then paste its link here. We fetch the title for you.</p></div><div class="modal__foot"><button class="btn btn--ghost" id="x">Cancel</button><button class="btn" id="ok">Add</button></div>`, m => {
    $('#x', m).onclick = closeModal;
    $('#ok', m).onclick = e => busy(e.currentTarget, async () => { try { const v = await api('GET', '/youtube?url=' + encodeURIComponent($('#yu', m).value)); closeModal(); await createItem('resources', { title: v.title, type: 'watch', youtube: v.id, summary: '', date: today(), draft: true }, 'Say a sentence or two about this video, and how a group could use it.'); } catch (er) { toast(er.message, 1); } });
  });
  const starter = type === 'gather' ? `## Read the passage\n\n::: passage Ecclesiastes 4:9–12 | King James Version\n9 Two are better than one...\n:::\n\n## What is being said\n\nWrite a few paragraphs, as if explaining to a friend.\n\n::: talk\nTell each other about a time you needed help and someone showed up.\n:::\n\n::: pray\nPray for each other, by name, for one thing you each need this week.\n:::\n\n::: sit\nWhere do you try to do life alone?\n:::\n` : 'Start writing here.\n';
  return createItem('resources', { title: type === 'gather' ? 'New guide' : type === 'kids' ? 'New kids resource' : 'New article', type, summary: '', date: today(), draft: true }, starter);
}
async function createItem(kind, data, body) { const r = await api('POST', `/items/${kind}`, { data, body }); go(`#/${kind}/edit/${r.id}`); }

// ---------- Lists
const draftPill = d => d.draft ? '<span class="pill pill--draft">Draft</span>' : '<span class="pill pill--ok">Live</span>';
async function Resources() {
  setTop('Resources', '<button class="btn btn--sm" data-new="gather">New guide</button><button class="btn btn--sm btn--ghost" data-new="read">Article</button><button class="btn btn--sm btn--ghost" data-new="watch">Video</button><button class="btn btn--sm btn--ghost" data-new="kids">Kids</button>');
  $$('[data-new]', $('#topActions')).forEach(b => b.onclick = () => newItem(b.dataset.new));
  const [items, projects] = await Promise.all([api('GET', '/items/resources'), api('GET', '/items/projects')]);
  const pn = Object.fromEntries(projects.map(p => [p.id, p.data.title]));
  items.sort((a, b) => (b.data.draft ? 1 : 0) - (a.data.draft ? 1 : 0) || String(b.data.date).localeCompare(String(a.data.date)));
  view.innerHTML = `<div class="head"><div><h1>Resources</h1><p class="lede">Guides, articles, videos and kids' resources. Drafts show only to you until you switch them on.</p></div></div>
  <div class="field" style="max-width:360px"><input type="text" id="q" placeholder="Search by title" aria-label="Search"></div>
  <div class="list" id="L">${items.length ? '' : '<div class="empty">Nothing here yet. Use the buttons above to start.</div>'}${items.map(i => `<a class="row" href="#/resources/edit/${i.id}" data-t="${esc((i.data.title || '').toLowerCase())}"><div class="row__main"><div class="row__t">${esc(i.data.title)}</div><div class="row__s">${esc(i.data.summary || 'No summary yet')}</div></div><span class="pill">${TYPES[i.data.type] || i.data.type}</span>${i.data.project ? `<span class="pill">${esc(pn[i.data.project] || i.data.project)}</span>` : ''}${draftPill(i.data)}<button class="btn btn--danger btn--sm" data-trash="${i.id}" aria-label="Move ${esc(i.data.title)} to the trash">Trash</button></a>`).join('')}</div>`;
  $$('[data-trash]').forEach(b => b.onclick = async e => { e.preventDefault(); e.stopPropagation(); if (!confirm('Move this to the trash? It stays in the "trash" folder, so it can be recovered.')) return; await api('DELETE', `/items/resources/${b.dataset.trash}`); toast('Moved to trash'); refreshOverview(); Resources(); });
  $('#q').oninput = e => $$('#L .row').forEach(r => r.style.display = r.dataset.t.includes(e.target.value.toLowerCase()) ? '' : 'none');
}
async function Projects() {
  setTop('Projects', '<button class="btn btn--sm" id="np">New project</button>'); $('#np').onclick = () => newItem('project');
  const [ps, rs] = await Promise.all([api('GET', '/items/projects'), api('GET', '/items/resources')]);
  ps.sort((a, b) => (a.data.order || 99) - (b.data.order || 99));
  view.innerHTML = `<div class="head"><div><h1>Projects</h1><p class="lede">A project is a series on one theme. Add resources to it by choosing the project in the resource.</p></div></div><div class="list">${ps.map(p => `<a class="row" href="#/projects/edit/${p.id}"><div class="row__main"><div class="row__t">${esc(p.data.title)}</div><div class="row__s">${esc(p.data.summary || '')}</div></div><span class="pill">${rs.filter(r => r.data.project === p.id).length} resources</span>${draftPill(p.data)}<button class="btn btn--danger btn--sm" data-trash="${p.id}" aria-label="Move ${esc(p.data.title)} to the trash">Trash</button></a>`).join('') || '<div class="empty">No projects yet.</div>'}</div>`;
  $$('[data-trash]').forEach(b => b.onclick = async e => { e.preventDefault(); e.stopPropagation(); if (!confirm('Move this project to the trash? Its resources stay, but will no longer belong to a project.')) return; await api('DELETE', `/items/projects/${b.dataset.trash}`); toast('Moved to trash'); refreshOverview(); Projects(); });
}
async function Pages() {
  const ps = await api('GET', '/items/pages'); setTop('Pages');
  view.innerHTML = `<div class="head"><div><h1>Pages</h1><p class="lede">About, Start here and the AI policy. Their addresses are fixed.</p></div></div><div class="list">${ps.map(p => `<a class="row" href="#/pages/edit/${p.id}"><div class="row__main"><div class="row__t">${esc(p.data.title)}</div><div class="row__s">${esc(p.data.summary || '')}</div></div></a>`).join('')}</div>`;
}

// ---------- Editor
const FIELDS = {
  resources: [['title', 'Title', 'text', 'Short and clear. Search results show about 60 characters.'], ['type', 'Kind', 'select:type'], ['project', 'Project', 'select:project'], ['date', 'Date', 'date'], ['order', 'Order in project', 'number', 'Lower comes first.'], ['youtube', 'YouTube link or ID', 'text', '', d => d.type === 'watch'], ['summary', 'Summary', 'area', 'One or two sentences. Shown on cards, in search results and in link previews (70 to 160 characters is best).'], ['image', 'Picture (optional)', 'image', 'Leave empty and we make a beautiful preview image for you.']],
  projects: [['title', 'Title', 'text'], ['summary', 'Summary', 'area', 'One or two sentences about the theme.'], ['color', 'Colour', 'select:color'], ['lampX', 'Lamp across (%)', 'number', 'Where the golden lamp sits on the cover, left to right.'], ['lampY', 'Lamp down (%)', 'number'], ['order', 'Order', 'number'], ['image', 'Picture (optional)', 'image']],
  pages: [['title', 'Title', 'text'], ['summary', 'Summary', 'area'], ['description', 'Search description', 'area', 'Shown in search results.']]
};
async function Editor(kind, id) {
  const [it, projects] = await Promise.all([api('GET', `/items/${kind}/${id}`), api('GET', '/items/projects')]);
  let data = { ...it.data }; const live = kind !== 'pages';
  setTop(kind === 'resources' ? 'Resources › Edit' : kind === 'projects' ? 'Projects › Edit' : 'Pages › Edit', `<span class="hint" id="saved"></span><button class="btn btn--sm btn--ghost" id="focus" title="Hide everything except the writing">Focus</button><a class="btn btn--sm btn--ghost" href="#/${kind}">Back</a>${live ? '<button class="btn btn--sm btn--danger" id="del2" title="Move this to the trash">Delete</button>' : ''}${live ? '<label class="switch"><input type="checkbox" id="pub"> Published</label>' : ''}<button class="btn btn--sm" id="save">Save</button>`);
  const opts = {
    type: Object.entries(TYPES).map(([v, l]) => [v, l]), project: [['', 'No project'], ...projects.map(p => [p.id, p.data.title])],
    color: [['teal', 'Teal'], ['ember', 'Ember'], ['sage', 'Sage']]
  };
  const fld = ([k, label, type, hint, show]) => {
    if (show && !show(data)) return '';
    const v = data[k] ?? ''; let inp;
    if (type === 'area') inp = `<textarea id="f_${k}" rows="3">${esc(v)}</textarea>`;
    else if (type.startsWith('select:')) inp = `<select id="f_${k}">${opts[type.slice(7)].map(([a, b]) => `<option value="${esc(a)}" ${String(v) === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
    else if (type === 'image') inp = `<div style="display:flex;gap:8px"><input type="text" id="f_${k}" value="${esc(v)}" placeholder="No picture chosen"><button class="btn btn--ghost btn--sm" type="button" data-pick="${k}">Choose</button></div>`;
    else inp = `<input type="${type}" id="f_${k}" value="${esc(v)}">`;
    return `<div class="field"><label for="f_${k}">${label}</label>${inp}${hint ? `<p class="hint">${hint}</p>` : ''}${k === 'summary' ? '<p class="hint" id="sumc"></p>' : ''}</div>`;
  };
  const meta = FIELDS[kind];
  view.innerHTML = `<div class="editor"><div class="editor__meta card">${fld(meta[0])}<details class="more" ${data.summary ? '' : 'open'}><summary>Details: ${kind === 'resources' ? 'kind, project, date, summary, picture' : 'summary and settings'}</summary><div class="two" style="margin-top:14px"><div>${meta.slice(1, Math.ceil((meta.length + 1) / 2)).map(fld).join('')}</div><div>${meta.slice(Math.ceil((meta.length + 1) / 2)).map(fld).join('')}</div></div></details></div>
  <div><div class="lbl" style="margin-bottom:8px">Write</div>
   <div class="tb" role="toolbar" aria-label="Formatting"><button data-a="h2" title="Big heading">Heading</button><button data-a="h3" title="Smaller heading">Subheading</button><span class="sep"></span><button data-a="b"><b>B</b></button><button data-a="i"><i>I</i></button><button data-a="quote">Quote</button><button data-a="ul">Bullets</button><button data-a="ol">Numbers</button><button data-a="hr" title="A dividing line">Divider</button><button data-a="link">Link</button><button data-a="img">Picture</button><span class="sep"></span><button data-a="passage" title="Insert Scripture">Scripture</button><button class="talk" data-a="talk">Tell each other</button><button class="pray" data-a="pray">Pray together</button><button class="sit" data-a="sit">Sit with this</button><span class="sep"></span><button data-a="write" title="A space for readers to write in">Write space</button><button data-a="note" title="A highlighted aside">Callout</button></div>
   <textarea id="body" spellcheck="true">${esc(it.body)}</textarea><p class="hint" style="margin-top:6px">Tip: the buttons write the formatting for you. Ctrl+B bold, Ctrl+I italic, Ctrl+K link, Ctrl+S save. Paste or drop a picture to add it. Your work also saves itself every few seconds.</p><p class="hint" id="wc"></p></div>
  <div id="rcol"><div class="preview"><div class="preview__t">Live preview</div><iframe id="pv" title="Preview"></iframe></div>
   <div style="margin-top:16px"><div class="lbl" style="margin-bottom:8px">Link preview (when shared)</div><div class="social"><img id="ogimg" alt="Social preview"><div><small>${esc(location.host ? 'welovescripture.org' : '')}</small><div id="ogt" style="font-weight:700"></div></div></div></div>
   ${live ? '<div style="margin-top:22px"><button class="btn btn--danger btn--sm" id="del">Move to trash</button></div>' : ''}</div></div>`;
  if (live) $('#pub').checked = !data.draft;
  const body = $('#body'); const mark = () => { dirty = true; };
  const sync = () => { for (const [k, , t] of meta) { const e = $('#f_' + k); if (!e) continue; let v = e.value; if (t === 'number') v = v === '' ? undefined : Number(v); if (v === '' || v === undefined) delete data[k]; else data[k] = v; } if (live) data.draft = !$('#pub').checked; };
  const sc = () => { const e = $('#sumc'); if (e) { const n = ($('#f_summary').value || '').length; e.textContent = `${n} characters` + (n && (n < 70 || n > 160) ? ' (70 to 160 is best)' : ''); } };
  view.addEventListener('input', () => { mark(); sc(); wc(); drawPv(); drawOg(); });
  const rerender = () => { if (['type', 'youtube'].includes(document.activeElement?.id?.slice(2))) { /* nothing */ } };
  $('#f_type')?.addEventListener('change', () => { sync(); Editor.keep = { data, body: body.value }; route.skip = 1; save(true).then(() => { dirty = false; Editor(kind, id); }); });
  $$('[data-pick]').forEach(b => b.onclick = () => pickImage(url => { $('#f_' + b.dataset.pick).value = url; mark(); drawOg(); }));
  let pt; function drawPv() { clearTimeout(pt); pt = setTimeout(async () => { try { const r = await api('POST', '/render', { body: body.value }); const doc = `<!doctype html><html data-theme="light" class="js"><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/tokens.css"><link rel="stylesheet" href="/assets/css/bundle.css"><link rel="stylesheet" href="/assets/css/site.css"><style>body{padding:24px 28px 60px;margin:0}</style></head><body class="wls-page"><h1 style="font:600 36px/42px var(--font-display);font-variation-settings:'SOFT' 100;margin:0 0 20px">${esc($('#f_title')?.value || '')}</h1><div class="prose">${r.html}</div></body></html>`; $('#pv').srcdoc = doc; } catch {} }, 350); }
  let ot; function drawOg() { clearTimeout(ot); ot = setTimeout(() => { const t = $('#f_title')?.value || ''; $('#ogt').textContent = t; const kk = kind === 'resources' ? (TYPES[$('#f_type')?.value] || '') : kind === 'projects' ? 'Project' : ''; $('#ogimg').src = `/api/og?title=${encodeURIComponent(t)}&kicker=${encodeURIComponent(kk)}&seed=${encodeURIComponent(id)}`; }, 600); }
  const wc = () => { const w = (body.value.match(/\S+/g) || []).length; $('#wc').textContent = `${w.toLocaleString()} words · about ${Math.max(1, Math.round(w / 200))} min read`; };
  async function save(quiet) { sync(); if (!data.title) return quiet ? undefined : toast('Please give it a title first.', 1); await api('PUT', `/items/${kind}/${id}`, { data, body: body.value }); dirty = false; $('#saved').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); if (!quiet) toast('Saved'); refreshOverview(); }
  clearInterval(Editor.timer); Editor.timer = setInterval(() => { if (dirty && $('#save')) save(true).catch(() => {}); }, 15000);
  $('#focus').onclick = () => { const on = $('.editor').classList.toggle('focus'); $('#focus').textContent = on ? 'Show all' : 'Focus'; };
  body.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey)) return; const k = e.key.toLowerCase(); if (k === 'b') { e.preventDefault(); toolbar('b', body, mark, drawPv); } else if (k === 'i') { e.preventDefault(); toolbar('i', body, mark, drawPv); } else if (k === 'k') { e.preventDefault(); toolbar('link', body, mark, drawPv); } });
  const addFile = async f => { if (!f || !f.type.startsWith('image/')) return; try { const r = await uploadImage(f); toolbar('img-url:' + r.url, body, mark, drawPv); } catch (er) { toast(er.message, 1); } };
  body.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); addFile(f); } });
  body.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
  body.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); addFile(f); } });
  $('#save').onclick = e => busy(e.currentTarget, () => save().catch(er => toast(er.message, 1)));
  document.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && $('#save')) { e.preventDefault(); $('#save').click(); } };
  const trashIt = async () => { if (!confirm('Move this to the trash? It stays in the "trash" folder, so it can be recovered.')) return; await api('DELETE', `/items/${kind}/${id}`); dirty = false; clearInterval(Editor.timer); toast('Moved to trash'); go(`#/${kind}`); };
  $('#del')?.addEventListener('click', trashIt); $('#del2')?.addEventListener('click', trashIt);
  $$('.tb button').forEach(b => b.onclick = () => toolbar(b.dataset.a, body, mark, drawPv));
  sc(); wc(); drawPv(); drawOg();
}
function wrap(ta, pre, post = pre, ph = 'text') { const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph; ta.setRangeText(pre + sel + post, s, e, 'select'); ta.setSelectionRange(s + pre.length, s + pre.length + sel.length); ta.focus(); }
function lines(ta, f) { const v = ta.value; let s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1, e = v.indexOf('\n', ta.selectionEnd); if (e < 0) e = v.length; ta.setRangeText(v.slice(s, e).split('\n').map(f).join('\n'), s, e, 'end'); ta.focus(); }
function block(ta, text) { const s = ta.selectionEnd; const pre = ta.value.slice(0, s).endsWith('\n\n') || s === 0 ? '' : ta.value.slice(0, s).endsWith('\n') ? '\n' : '\n\n'; ta.setRangeText(pre + text + '\n\n', s, s, 'end'); ta.focus(); }
function toolbar(a, ta, mark, draw) {
  const done = () => { mark(); draw(); };
  if (a === 'h2') lines(ta, l => '## ' + l.replace(/^#+\s*/, '')); else if (a === 'h3') lines(ta, l => '### ' + l.replace(/^#+\s*/, ''));
  else if (a === 'b') wrap(ta, '**', '**', 'bold text'); else if (a === 'i') wrap(ta, '*', '*', 'italic text');
  else if (a === 'quote') lines(ta, l => '> ' + l); else if (a === 'ul') lines(ta, l => '- ' + l.replace(/^(-|\d+\.)\s+/, '')); else if (a === 'ol') { let n = 0; lines(ta, l => (++n) + '. ' + l.replace(/^(-|\d+\.)\s+/, '')); }
  else if (a === 'hr') block(ta, '---');
  else if (a === 'note') block(ta, '::: note Good to know\nWrite a short aside here.\n:::');
  else if (a === 'write') return openModal(`<h2>Add a write-in space</h2><div class="field"><label for="wt">What should people write about?</label><input type="text" id="wt" placeholder="Where have you carried something alone?"></div><div class="field"><label for="wl">How many lines when printed?</label><input type="number" id="wl" value="6" min="1" max="30"><p class="hint">Online, readers get a private note box. In print and PDF, they get this many ruled lines.</p></div><div class="modal__foot"><button class="btn btn--ghost" id="x">Cancel</button><button class="btn" id="ok">Add</button></div>`, m => { $('#x', m).onclick = closeModal; $('#ok', m).onclick = () => { const t = $('#wt', m).value.trim() || 'Write it down', n = Math.max(1, Math.min(30, +$('#wl', m).value || 6)); closeModal(); block(ta, `::: write ${t} | ${n}\nAn optional line of guidance goes here.\n:::`); done(); }; });
  else if (a === 'talk') block(ta, '::: talk\nWrite a question or invitation for friends to answer out loud.\n:::');
  else if (a === 'pray') block(ta, '::: pray\nWrite a prayer prompt for the group.\n:::');
  else if (a === 'sit') block(ta, '::: sit\nWrite something to think about quietly.\n:::');
  else if (a === 'link') return openModal(`<h2>Add a link</h2><div class="field"><label for="lu">Web address</label><input type="url" id="lu" placeholder="https://"></div><div class="modal__foot"><button class="btn btn--ghost" id="x">Cancel</button><button class="btn" id="ok">Add link</button></div>`, m => { $('#x', m).onclick = closeModal; $('#ok', m).onclick = () => { const u = $('#lu', m).value.trim(); closeModal(); if (u) { wrap(ta, '[', `](${u})`, 'link text'); done(); } }; });
  else if (a.startsWith('img-url:')) return imageDialog(a.slice(8), ta, done);
  else if (a === 'img') return pickImage(url => imageDialog(url, ta, done));
  else if (a === 'img-old') return pickImage(url => { openModal(`<h2>Describe the picture</h2><div class="field"><label for="al">What does it show?</label><input type="text" id="al"><p class="hint">For people using screen readers, and for search engines.</p></div><div class="field"><label for="cp">Caption (optional)</label><input type="text" id="cp"></div><div class="modal__foot"><button class="btn" id="ok">Insert</button></div>`, m => { $('#ok', m).onclick = () => { const al = $('#al', m).value.trim(); if (!al) return toast('Please describe the picture.', 1); closeModal(); const cp = $('#cp', m).value.trim().replace(/"/g, "'"); block(ta, `![${al}](${url}${cp ? ` "${cp}"` : ''})`); done(); }; }); });
  else if (a === 'passage') return passageModal(ta, done);
  done();
}
function imageDialog(url, ta, done) {
  openModal(`<h2>Describe the picture</h2><div class="field"><label for="al">What does it show?</label><input type="text" id="al"><p class="hint">For people using screen readers, and for search engines.</p></div><div class="field"><label for="cp">Caption (optional)</label><input type="text" id="cp"></div><div class="modal__foot"><button class="btn" id="ok">Insert</button></div>`, m => { const go = () => { const al = $('#al', m).value.trim(); if (!al) return toast('Please describe the picture.', 1); const cp = $('#cp', m).value.trim().replace(/"/g, "'"); closeModal(); block(ta, `![${al}](${url}${cp ? ` "${cp}"` : ''})`); done(); }; $('#ok', m).onclick = go; m.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); }); });
}
function passageModal(ta, done) {
  openModal(`<h2>Insert Scripture</h2><div class="two"><div class="field"><label for="pr">Reference</label><input type="text" id="pr" placeholder="Ecclesiastes 4:9-12"></div><div class="field"><label for="pt">Translation</label><select id="pt"><option value="kjv">King James Version</option><option value="web">World English Bible</option></select></div></div><p><button class="btn btn--ghost btn--sm" id="lk">Look it up</button> <span class="hint" id="ls">Needs internet. Or type the verses below yourself.</span></p>
  <div class="field" style="margin-top:14px"><label for="pv2">Verses (one per line, starting with the verse number)</label><textarea id="pv2" rows="8" placeholder="9 Two are better than one..."></textarea></div><div class="modal__foot"><button class="btn btn--ghost" id="x">Cancel</button><button class="btn" id="ok">Insert</button></div>`, m => {
    let ref = '', tr = 'King James Version';
    $('#x', m).onclick = closeModal;
    $('#lk', m).onclick = e => busy(e.currentTarget, async () => { try { const r = await api('GET', `/passage?ref=${encodeURIComponent($('#pr', m).value)}&tr=${$('#pt', m).value}`); ref = r.reference; tr = r.translation; $('#pv2', m).value = r.verses.map(v => `${v.n} ${v.text}`).join('\n'); $('#ls', m).textContent = `${r.reference} (${r.translation})`; } catch (er) { toast(er.message, 1); } });
    $('#ok', m).onclick = () => { const t = $('#pv2', m).value.trim(); const r = ref || $('#pr', m).value.trim(); if (!t || !r) return toast('Add a reference and the verses.', 1); if (!ref) tr = $('#pt', m).selectedOptions[0].text; closeModal(); block(ta, `::: passage ${r} | ${tr}\n${t}\n:::`); done(); };
  });
}
async function pickImage(cb) {
  const imgs = await api('GET', '/media');
  openModal(`<h2>Choose a picture</h2><div class="drop" id="dz">Drop an image here or <label style="color:var(--link);text-decoration:underline;cursor:pointer">browse<input type="file" id="fi" accept="image/*" hidden></label></div><div class="thumbs">${imgs.map(i => `<button class="thumb" data-u="${i.url}"><img src="${i.url}" alt=""><span>${esc(i.name)}</span></button>`).join('') || '<p class="hint">No pictures yet.</p>'}</div><div class="modal__foot"><button class="btn btn--ghost" id="x">Cancel</button></div>`, m => {
    $('#x', m).onclick = closeModal; $$('.thumb', m).forEach(b => b.onclick = () => { closeModal(); cb(b.dataset.u); });
    const up = async f => { try { const r = await uploadImage(f); closeModal(); cb(r.url); } catch (e) { toast(e.message, 1); } };
    $('#fi', m).onchange = e => e.target.files[0] && up(e.target.files[0]);
    const dz = $('#dz', m); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); up(e.dataTransfer.files[0]); };
  });
}
async function uploadImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image.');
  const bm = await createImageBitmap(file).catch(() => null); let dataUrl;
  if (bm && file.type !== 'image/gif') { const max = 1800, s = Math.min(1, max / Math.max(bm.width, bm.height)); const c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); dataUrl = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .86); }
  else dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  return api('POST', '/media', { name: file.name, dataUrl });
}

// ---------- Media
async function Media() {
  setTop('Images'); const imgs = await api('GET', '/media');
  view.innerHTML = `<div class="head"><div><h1>Images</h1><p class="lede">Big pictures are made smaller automatically so pages load fast.</p></div></div><div class="drop" id="dz">Drop images here or <label style="color:var(--link);text-decoration:underline;cursor:pointer">browse<input type="file" id="fi" accept="image/*" multiple hidden></label></div><div class="thumbs">${imgs.map(i => `<div class="thumb" style="cursor:default"><img src="${i.url}" alt=""><span>${esc(i.name)} · ${Math.round(i.size / 1024)} KB</span><span><a href="#" data-d="${esc(i.name)}">Move to trash</a></span></div>`).join('')}</div>${imgs.length ? '' : '<p class="empty">No images yet.</p>'}`;
  const up = async fs => { for (const f of fs) { try { await uploadImage(f); } catch (e) { toast(e.message, 1); } } toast('Uploaded'); Media(); };
  $('#fi').onchange = e => up([...e.target.files]); const dz = $('#dz'); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); up([...e.dataTransfer.files]); };
  $$('[data-d]').forEach(a => a.onclick = async e => { e.preventDefault(); if (confirm('Move this image to the trash?')) { await api('DELETE', '/media/' + a.dataset.d); Media(); } });
}

// ---------- Episodes
async function Episodes() {
  setTop('Podcast episodes', '<button class="btn btn--sm" id="sy">Check for new episodes</button><button class="btn btn--sm btn--lamp" id="sv">Save</button>');
  let d; try { d = await api('GET', '/episodes'); } catch (e) { view.innerHTML = `<div class="msg msg--warn">Could not load episodes: ${esc(e.message)}</div>`; return; }
  const [projects] = await Promise.all([api('GET', '/items/projects')]); const map = d.map || {}; const eps = d.episodes || [];
  view.innerHTML = `<div class="head"><div><h1>Podcast episodes</h1><p class="lede">Episodes come from your Spotify feed. Add new ones on Spotify; they appear here and on the site automatically. Here you can group them into projects, hide any, note the Scripture, and <b>feature</b> up to three so they sit first on the Listen page and the home page. Each episode's <b>image</b> follows the default in <a href="#/settings">Settings</a> unless you choose otherwise here.</p></div></div>${d.error ? `<div class="msg msg--warn">${esc(d.error)}</div>` : ''}<div class="list">${eps.map(e => { const m = map[e.guid] || {}; return `<div class="row" data-g="${esc(e.guid)}" style="flex-wrap:wrap"><div class="row__main" style="min-width:240px"><div class="row__t">${esc(e.title)}</div><div class="row__s">${fmtDate(e.date)} · ${e.minutes || '?'} min</div></div><select data-k="project" aria-label="Project" style="width:200px"><option value="">No project</option>${projects.map(p => `<option value="${p.id}" ${m.project === p.id ? 'selected' : ''}>${esc(p.data.title)}</option>`).join('')}</select><input type="text" data-k="scripture" placeholder="Scripture, e.g. Psalm 23" value="${esc(m.scripture || '')}" style="width:190px" aria-label="Scripture"><select data-k="imageMode" aria-label="Preview image" title="The picture on the tile and when shared" style="width:210px"><option value="" ${!m.imageMode ? 'selected' : ''}>Image: use the default</option><option value="auto" ${m.imageMode === 'auto' ? 'selected' : ''}>Image: made by the site</option><option value="feed" ${m.imageMode === 'feed' ? 'selected' : ''}>Image: podcast artwork</option><option value="custom" ${m.imageMode === 'custom' ? 'selected' : ''}>Image: my own picture</option></select><span data-imgbox style="display:${m.imageMode === 'custom' ? 'inline-flex' : 'none'};gap:6px;align-items:center"><input type="text" data-k="image" value="${esc(m.image || '')}" placeholder="No picture" style="width:150px" aria-label="Picture"><button class="btn btn--ghost btn--sm" type="button" data-epick>Choose</button></span><label class="switch" title="Shown first on the Listen page and the home page. Up to three."><input type="checkbox" data-k="featured" ${m.featured ? 'checked' : ''}> Feature</label><label class="switch"><input type="checkbox" data-k="hidden" ${m.hidden ? 'checked' : ''}> Hide</label></div>`; }).join('') || '<div class="empty">No episodes found yet.</div>'}</div>`;
  view.oninput = () => { dirty = true; };
  $$('[data-k=imageMode]').forEach(sel => sel.onchange = () => { $('[data-imgbox]', sel.closest('.row')).style.display = sel.value === 'custom' ? 'inline-flex' : 'none'; });
  $$('[data-epick]').forEach(b => b.onclick = () => pickImage(url => { $('[data-k=image]', b.closest('.row')).value = url; dirty = true; }));
  $('#sv').onclick = e => busy(e.currentTarget, async () => { const out = {}; $$('[data-g]').forEach(r => { const o = {}; const p = $('[data-k=project]', r).value, s = $('[data-k=scripture]', r).value.trim(), h = $('[data-k=hidden]', r).checked, fe = $('[data-k=featured]', r).checked; if (p) o.project = p; if (s) o.scripture = s; if (h) o.hidden = true; if (fe) o.featured = true; const im = $('[data-k=imageMode]', r).value; if (im) { o.imageMode = im; const iu = $('[data-k=image]', r).value.trim(); if (im === 'custom' && iu) o.image = iu; } if (Object.keys(o).length) out[r.dataset.g] = o; }); if (Object.values(out).filter(o => o.featured && !o.hidden).length > 3) toast('Only the first three featured episodes are shown.'); await api('PUT', '/data/episodeMap', out); dirty = false; toast('Saved'); refreshOverview(); });
  $('#sy').onclick = e => busy(e.currentTarget, async () => { try { await api('POST', '/episodes'); toast('Checked the feed'); Episodes(); } catch (er) { toast(er.message, 1); } });
}

// ---------- Nav
async function NavEditor() {
  let nav = await api('GET', '/data/nav'); setTop('Menu links', '<button class="btn btn--sm btn--lamp" id="sv">Save</button>');
  const draw = () => { view.innerHTML = `<div class="head"><div><h1>Menu links</h1><p class="lede">The links at the top of every page, in order.</p></div></div><div class="list">${nav.map((n, i) => `<div class="row"><div class="row__main two"><input type="text" data-i="${i}" data-f="label" value="${esc(n.label)}" aria-label="Label"><input type="text" data-i="${i}" data-f="url" value="${esc(n.url)}" aria-label="Address"></div><button class="btn btn--ghost btn--sm" data-up="${i}" aria-label="Move up">↑</button><button class="btn btn--ghost btn--sm" data-dn="${i}" aria-label="Move down">↓</button><button class="btn btn--danger btn--sm" data-rm="${i}">Remove</button></div>`).join('')}</div><p style="margin-top:14px"><button class="btn btn--ghost" id="add">Add a link</button></p>`;
    $$('input[data-i]').forEach(x => x.oninput = () => { nav[x.dataset.i][x.dataset.f] = x.value; dirty = true; });
    $$('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i) { [nav[i - 1], nav[i]] = [nav[i], nav[i - 1]]; dirty = true; draw(); } });
    $$('[data-dn]').forEach(b => b.onclick = () => { const i = +b.dataset.dn; if (i < nav.length - 1) { [nav[i + 1], nav[i]] = [nav[i], nav[i + 1]]; dirty = true; draw(); } });
    $$('[data-rm]').forEach(b => b.onclick = () => { nav.splice(+b.dataset.rm, 1); dirty = true; draw(); });
    $('#add').onclick = () => { nav.push({ label: 'New link', url: '/' }); dirty = true; draw(); };
  }; draw();
  $('#sv').onclick = e => busy(e.currentTarget, async () => { await api('PUT', '/data/nav', nav); dirty = false; toast('Saved'); });
}

// ---------- Counters
async function Counters() {
  const g = await api('GET', '/growth'); const cfg = g.config; setTop('Growth counters', '<button class="btn btn--sm btn--lamp" id="sv">Save</button>');
  const draw = () => { view.innerHTML = `<div class="head"><div><h1>Growth counters</h1><p class="lede">Numbers shown on the home page that count up as people arrive. Counted ones update themselves. For others (like YouTube subscribers) type the number whenever you like.</p></div></div>
  <div class="card" style="margin-bottom:18px"><div class="two"><label class="switch"><input type="checkbox" id="cshow" ${cfg.show ? 'checked' : ''}> Show the counters on the home page</label><div class="field" style="margin:0"><input type="text" id="ctitle" value="${esc(cfg.title)}" aria-label="Heading"></div></div></div>
  <div class="list">${cfg.items.map((it, i) => `<div class="row" style="flex-wrap:wrap"><label class="switch"><input type="checkbox" data-i="${i}" data-f="show" ${it.show ? 'checked' : ''}> Show</label><input type="text" data-i="${i}" data-f="label" value="${esc(it.label)}" style="flex:1;min-width:200px" aria-label="Label">${it.source.startsWith('auto:') ? `<span class="pill pill--ok">Counted for you: ${g.now[it.id]}</span>` : `<input type="number" data-i="${i}" data-f="value" value="${it.value || 0}" style="width:140px" aria-label="Number">`}${it.source === 'manual' ? `<button class="btn btn--danger btn--sm" data-rm="${i}">Remove</button>` : ''}</div>`).join('')}</div>
  <p style="margin-top:14px"><button class="btn btn--ghost" id="add">Add your own counter</button></p>
  <section class="card" style="margin-top:26px"><h2>History</h2><p class="lede" style="margin:6px 0 14px">A snapshot of all counters is saved each time you publish. You can also take one now.</p>${hist(g)}<p style="margin-top:14px"><button class="btn btn--ghost btn--sm" id="snap">Take a snapshot now</button></p></section>`;
    $$('input[data-i]').forEach(x => x.oninput = x.onchange = () => { const it = cfg.items[x.dataset.i]; it[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? Number(x.value) : x.value; dirty = true; });
    $('#cshow').onchange = e => { cfg.show = e.target.checked; dirty = true; }; $('#ctitle').oninput = e => { cfg.title = e.target.value; dirty = true; };
    $$('[data-rm]').forEach(b => b.onclick = () => { cfg.items.splice(+b.dataset.rm, 1); dirty = true; draw(); });
    $('#add').onclick = () => { cfg.items.push({ id: 'c' + Date.now().toString(36), label: 'New counter', source: 'manual', value: 0, show: true }); dirty = true; draw(); };
    $('#snap').onclick = async () => { g.log = await api('POST', '/growth'); toast('Snapshot saved'); draw(); };
  };
  const hist = g => { const id = 'episodes'; const series = g.log.slice(-30); if (!series.length) return '<p class="hint">No snapshots yet.</p>'; const mx = Math.max(1, ...series.map(s => s.values[id] || 0)); return `<div class="lbl">Podcast episodes over time</div><div class="bars" role="img" aria-label="Episodes over time">${series.map(s => `<i title="${s.date}: ${s.values[id] || 0}" style="height:${Math.max(3, (s.values[id] || 0) / mx * 100)}%"></i>`).join('')}</div><p class="hint">${series[0].date} to ${series.at(-1).date}</p>`; };
  draw(); $('#sv').onclick = e => busy(e.currentTarget, async () => { await api('PUT', '/data/counters', cfg); dirty = false; toast('Saved'); });
}

// ---------- Settings
async function Settings() {
  const s = await api('GET', '/data/site'); setTop('Settings', '<button class="btn btn--sm btn--lamp" id="sv">Save</button>');
  const F = [['Identity', [['name', 'Site name'], ['tagline', 'Tagline'], ['description', 'Description', 'area', 'Used by search engines and in link previews.'], ['url', 'Website address', 'text', 'Starts with https://. Changing it also updates the domain file.']]], ['Podcast', [['podcastRss', 'Podcast feed address (RSS)', 'text', 'From Spotify for Creators. New episodes are read from here.'], ['listen.perPage', 'Episodes shown per page', 'text', 'The Listen page shows this many at a time (3 to 60), with the rest on following pages. Twelve fits the three-column layout neatly.'], ['listen.defaultImage', 'Default preview image for episodes', 'select', 'What shows on the tiles and when an episode is shared. Each episode can override this on the Podcast episodes screen.', [['auto', 'Made by the site, in our brand (recommended)'], ['feed', 'The podcast artwork from Spotify, placed on a branded card'], ['custom', 'One picture of my choosing, for every episode']]], ['listen.defaultImageUrl', 'The picture, if you chose "One picture"', 'image', 'Best at 1200 × 630 pixels.']]],
  ['Where people can find you', [['social.youtube', 'YouTube'], ['social.spotify', 'Spotify (the page listeners see)', 'text', 'Use the public listener link, not the Creators dashboard.'], ['social.apple', 'Apple Podcasts', 'text', 'Should end with /id and numbers.'], ['social.instagram', 'Instagram'], ['social.x', 'X']]],
  ['Search engines & stats', [['verification.google', 'Google Search Console code'], ['verification.bing', 'Bing Webmaster code'], ['analytics.goatcounter', 'GoatCounter name', 'text', 'Private, cookie-free visitor counts. Sign up free at goatcounter.com and enter just the name.']]],
  ['Words used across the site', [['defaultTranslation', 'Default Bible translation'], ['guideHowTo', 'How to use a guide', 'area'], ['footerNote', 'Footer note', 'area']]]];
  const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o); const set = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); const t = ks.reduce((a, k) => a[k] ??= {}, o); if (v === '') delete t[l]; else t[l] = v; };
  view.innerHTML = `<div class="head"><div><h1>Settings</h1></div></div>${F.map(([t, fs]) => `<section class="card" style="margin-bottom:18px"><h2 style="margin-bottom:14px">${t}</h2>${fs.map(([k, l, ty, h, o]) => `<div class="field"><label for="s_${k}">${l}</label>${ty === 'area' ? `<textarea id="s_${k}" data-k="${k}" rows="3">${esc(get(s, k))}</textarea>` : ty === 'select' ? `<select id="s_${k}" data-k="${k}">${o.map(([a, b]) => `<option value="${a}" ${(get(s, k) || o[0][0]) === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ty === 'image' ? `<div style="display:flex;gap:8px"><input type="text" id="s_${k}" data-k="${k}" value="${esc(get(s, k))}" placeholder="No picture chosen"><button class="btn btn--ghost btn--sm" type="button" data-spick="s_${k}">Choose</button></div>` : `<input type="text" id="s_${k}" data-k="${k}" value="${esc(get(s, k))}">`}${h ? `<p class="hint">${h}</p>` : ''}</div>`).join('')}</section>`).join('')}`;
  view.oninput = () => { dirty = true; };
  $$('[data-spick]').forEach(b => b.onclick = () => pickImage(url => { $('#' + b.dataset.spick).value = url; dirty = true; }));
  $('#sv').onclick = e => busy(e.currentTarget, async () => { $$('[data-k]').forEach(x => set(s, x.dataset.k, x.value.trim())); try { await api('PUT', '/data/site', s); dirty = false; toast('Saved'); } catch (er) { toast(er.message, 1); } });
}

// ---------- Check
async function Check() {
  setTop('Search & health check'); const list = await api('GET', '/check'); const sev = { bad: 'Fix', warn: 'Improve', info: 'Nice to have' };
  view.innerHTML = `<div class="head"><div><h1>Search & health check</h1><p class="lede">What helps search engines, AI assistants and social apps present your work well.</p></div></div>
  <div class="msg msg--ok"><b>AI & search setup.</b> Search engines and AI assistants that look things up for people are welcome. Crawlers that collect text to train models are asked to stay away. These are polite requests that well-behaved crawlers honour; they cannot force anyone. <a href="/ai-policy/" target="_blank" style="color:inherit">Read the policy page</a> (appears once published).</div>
  ${list.length ? `<div class="list">${list.map(c => `<a class="row" href="${c.kind === 'settings' ? '#/settings' : `#/${c.kind}/edit/${c.id}`}"><span class="pill ${c.sev === 'bad' ? 'pill--bad' : c.sev === 'warn' ? 'pill--draft' : ''}">${sev[c.sev]}</span><div class="row__main"><div class="row__t">${esc(c.where)}</div><div class="row__s" style="white-space:normal">${esc(c.msg)}</div></div></a>`).join('')}</div>` : '<div class="msg msg--ok">Everything looks good.</div>'}`;
}

// ---------- Preview
async function Preview() {
  setTop('Preview'); let st = await api('GET', '/preview');
  const draw = () => { view.innerHTML = `<div class="head"><div><h1>Preview the site</h1><p class="lede">This shows the whole site, including drafts, exactly as it will look. It updates as you save.</p></div></div><div class="card">${st.running ? `<p><span class="pill pill--ok">Running</span></p><p style="margin:14px 0"><a class="btn" href="${st.url}" target="_blank" rel="noopener">Open the preview</a> <button class="btn btn--ghost" id="stop">Stop</button></p><pre class="log">${esc((st.logs || []).join('\n'))}</pre>` : '<p class="lede">The preview is off.</p><p style="margin-top:14px"><button class="btn" id="start">Start the preview</button></p>'}</div>`;
    $('#start')?.addEventListener('click', e => busy(e.currentTarget, async () => { try { await api('POST', '/preview/start'); } catch (er) { return toast(er.message, 1); } await new Promise(r => setTimeout(r, 4000)); st = await api('GET', '/preview'); draw(); }));
    $('#stop')?.addEventListener('click', async () => { await api('POST', '/preview/stop'); st = await api('GET', '/preview'); draw(); });
  }; draw();
}

// ---------- Publish
async function Publish() {
  setTop('Publish'); await refreshOverview(); const g = overview.git;
  const repoUrl = g.remote.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
  view.innerHTML = `<div class="head"><div><h1>Publish to the web</h1><p class="lede">Publishing sends your latest work to GitHub. GitHub then builds the site and puts it online, usually within two minutes.</p></div></div>
  ${!g.isRepo ? `<div class="card"><h2>Step 1: connect this folder</h2><p class="lede" style="margin:8px 0 14px">This folder is not tracked by Git yet. This one button fixes that.</p><button class="btn" id="init">Set up Git</button></div>` : !g.remote ? `<div class="card"><h2>Step 2: connect to GitHub</h2><ol class="steps" style="margin:14px 0"><li><span>Go to <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a> and create an empty repository (name it anything, public is fine). Leave "Add a README" unticked.</span></li><li><span>Copy the address GitHub shows, ending in <code>.git</code>, and paste it here.</span></li></ol><div class="field"><input type="text" id="ru" placeholder="https://github.com/yourname/welovescripture-site.git" aria-label="Repository address"></div><button class="btn" id="rs">Connect</button></div>` : `<div class="card"><div class="head" style="margin-bottom:12px"><h2>${g.changes.length ? `${g.changes.length} change${g.changes.length > 1 ? 's' : ''} ready` : 'Nothing new to publish'}</h2><a href="${esc(repoUrl)}" target="_blank" rel="noopener">${esc(repoUrl.replace('https://github.com/', ''))}</a></div>
  ${g.changes.length ? `<div class="list" style="max-height:220px;overflow:auto;margin-bottom:14px">${g.changes.map(c => `<div class="row"><span class="pill">${esc(c.flag)}</span><div class="row__main row__t">${esc(c.file)}</div></div>`).join('')}</div>` : ''}
  <div class="field"><label for="cm">What did you change? (a note for yourself)</label><input type="text" id="cm" value="Update the site"></div><button class="btn btn--lamp" id="pub">Publish now</button> <button class="btn btn--ghost" id="bld">Test the build first</button><pre class="log" id="log" style="display:none;margin-top:14px"></pre><div id="after"></div></div>
  <div class="card" style="margin-top:18px"><h2>One-time GitHub setup</h2><ol class="steps" style="margin-top:12px"><li><span>On GitHub, open the repository, then <b>Settings → Pages</b>. Under "Build and deployment", set <b>Source</b> to <b>GitHub Actions</b>.</span></li><li><span>In the same page, under <b>Custom domain</b>, enter your domain and tick <b>Enforce HTTPS</b> once it lets you.</span></li><li><span>At your domain provider, point the domain to GitHub Pages (the README explains the records).</span></li></ol></div>`}`;
  $('#init')?.addEventListener('click', e => busy(e.currentTarget, async () => { const r = await api('POST', '/git/init'); if (!r.ok) toast('Could not set up Git. Is Git installed?', 1); Publish(); }));
  $('#rs')?.addEventListener('click', async () => { try { await api('POST', '/git/remote', { url: $('#ru').value.trim() }); Publish(); } catch (e) { toast(e.message, 1); } });
  const log = t => { const l = $('#log'); l.style.display = 'block'; l.textContent = t; };
  $('#bld')?.addEventListener('click', e => busy(e.currentTarget, async () => { const r = await api('POST', '/build'); log(r.log); toast(r.ok ? 'The site builds fine' : 'The build found a problem', !r.ok); }));
  $('#pub')?.addEventListener('click', e => busy(e.currentTarget, async () => { const r = await api('POST', '/git/publish', { message: $('#cm').value }); log(r.log); if (r.ok) { toast('Published'); $('#after').innerHTML = `<div class="msg msg--ok" style="margin-top:14px">Sent to GitHub. It will be live in a minute or two. <a href="${esc(repoUrl)}/actions" target="_blank" rel="noopener" style="color:inherit">Watch it build</a>.</div>`; refreshOverview(); } else { $('#after').innerHTML = `<div class="msg msg--warn" style="margin-top:14px">${esc(r.hint || 'Publishing did not finish.')}</div>`; } }));
}

// ---------- Updates
async function Updates() {
  setTop('Updates'); await refreshOverview();
  view.innerHTML = `<div class="head"><div><h1>Updates</h1><p class="lede">When Claude sends you a new zip, choose it here. Only the website's own files change. Your writing, images, settings, menu and domain are never touched, and every replaced file is backed up first.</p></div></div>
  <div class="card"><p>You have version <b>${esc(overview.version || '1.0.0')}</b>.</p><div class="drop" id="dz" style="margin-top:14px">Drop the zip here or <label style="color:var(--link);text-decoration:underline;cursor:pointer">browse<input type="file" id="fi" accept=".zip,application/zip" hidden></label></div><div id="plan"></div></div>`;
  const inspect = async f => {
    if (!f) return; const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    try {
      const r = await api('POST', '/update/inspect', { dataUrl }); const n = r.add.length + r.change.length + r.merge.length + (r.remove || []).length; const list = (t, a) => a.length ? `<p class="lbl" style="margin-top:12px">${t} (${a.length})</p><pre class="log">${esc(a.join('\n'))}</pre>` : '';
      $('#plan').innerHTML = n ? `<div class="msg msg--ok" style="margin-top:16px">Version <b>${esc(r.incoming)}</b> is ready. ${r.add.length + r.change.length + (r.remove || []).length} file${r.add.length + r.change.length + (r.remove || []).length === 1 ? '' : 's'} will change${r.merge.length ? `, and new settings will be added to ${r.merge.length}` : ''}. ${r.keepCount} of your own files stay as they are.${r.restart ? ' The console will restart itself, which takes a few seconds.' : ''}</div>${list('New', r.add)}${list('Updated', r.change)}${list('New settings added to', r.merge)}${list('Retired and removed', r.remove || [])}<p style="margin-top:16px"><button class="btn btn--lamp" id="ap">Apply update</button></p>` : '<div class="msg msg--ok" style="margin-top:16px">You already have everything in this zip.</div>';
      $('#ap')?.addEventListener('click', e => busy(e.currentTarget, async () => {
        try { const a = await api('POST', '/update/apply'); if (!a.restart) { toast('Updated'); return Updates(); }
          view.innerHTML = '<div class="card empty"><span class="spin"></span><p style="margin-top:12px">Updated. Restarting the console…</p></div>';
          for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 1500)); try { await api('GET', '/overview'); toast('Updated to ' + a.version); return location.reload(); } catch {} }
          view.innerHTML = '<div class="msg msg--warn">The update was applied, but the console did not restart on its own. Close this window and open the console again using its launcher file.</div>';
        } catch (er) { toast(er.message, 1); }
      }));
    } catch (er) { $('#plan').innerHTML = `<div class="msg msg--warn" style="margin-top:16px">${esc(er.message)}</div>`; }
  };
  $('#fi').onchange = e => inspect(e.target.files[0]); const dz = $('#dz'); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); inspect(e.dataTransfer.files[0]); };
}

refreshOverview().then(route);
