import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { esc, slugify } from './util.mjs';

const ICONS = {
  talk: '<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H11l-5 4v-4H7a3 3 0 0 1-3-3z"/>',
  pray: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 1.5 1.5 2 2.5 2-.5-3 0-6.5.5-8z"/>',
  sit: '<path d="M7 4h10v16l-5-4-5 4z"/>',
};
const PROMPTS = { talk: 'Tell each other', pray: 'Pray together', sit: 'Sit with this' };

export function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

  // Scripture passage: ::: passage Ecclesiastes 4:9–10 | King James Version
  md.use(container, 'passage', {
    validate: params => /^passage\b/.test(params.trim()),
    render(tokens, idx) {
      const t = tokens[idx];
      if (t.nesting === 1) {
        const [ref] = t.info.trim().replace(/^passage\s*/, '').split('|').map(s => s.trim());
        return `<figure class="wls-passage" data-pagefind-ignore="false"><p class="wls-passage__ref">${esc(ref || '')}</p><div class="wls-passage__text">\n`;
      }
      let j = idx - 1; while (j >= 0 && !(tokens[j].type === 'container_passage_open' && tokens[j].level === t.level)) j--;
      const tr = j >= 0 ? (tokens[j].info.trim().replace(/^passage\s*/, '').split('|')[1] || '').trim() : '';
      return `</div>${tr ? `<figcaption class="wls-passage__src">${esc(tr)}</figcaption>` : ''}</figure>\n`;
    },
  });

  // A private writing space. On the web it is a note box saved only in the reader's browser;
  // in print and PDF it becomes ruled lines to write on.
  const hash = str => { let h = 5381; for (const ch of String(str)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return h.toString(36); };
  const WRITE_KINDS = new Set(['talk', 'pray', 'sit', 'write']);
  const notesHtml = (tokens, idx, kind, label, lines) => {
    let n = 0; for (let i = 0; i < idx; i++) if (tokens[i].type.startsWith('container_') && tokens[i].type.endsWith('_open') && WRITE_KINDS.has(tokens[i].type.slice(10, -5))) n++;
    let text = ''; for (let i = idx + 1; i < tokens.length && !(tokens[i].type === 'container_' + kind + '_close' && tokens[i].level === tokens[idx].level); i++) if (tokens[i].type === 'inline') { text = tokens[i].content; break; }
    const id = `n${n}-${hash(label + '|' + text.slice(0, 60))}`;
    return `<div class="wls-notes" data-note="${id}"><label class="wls-notes__label" for="${id}">${esc(label)} <span>Private. Saved only on this device.</span></label><textarea id="${id}" rows="${Math.max(3, Math.min(lines, 8))}" placeholder="Write here if you like"></textarea><div class="wls-lines" style="--n:${lines}" aria-hidden="true"></div></div>\n`;
  };
  const infoOf = (t, name) => t.info.trim().replace(new RegExp('^' + name + '\\b\\s*'), '');
  const linesOf = (rest, dflt) => { const m = /(\d{1,2})\s*$/.exec(rest); return m ? Math.min(30, Math.max(1, +m[1])) : dflt; };

  // Prompts: ::: talk / ::: pray / ::: sit   (optionally "::: talk 8" for 8 writing lines when printed)
  const DEFAULT_LINES = { talk: 6, pray: 5, sit: 5 };
  for (const kind of Object.keys(PROMPTS)) {
    md.use(container, kind, {
      render(tokens, idx) {
        if (tokens[idx].nesting === 1) {
          return `<aside class="wls-prompt wls-prompt--${kind}"><p class="wls-prompt__label"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[kind]}</svg>${PROMPTS[kind]}</p><div class="wls-prompt__text">\n`;
        }
        let j = idx - 1; while (j >= 0 && !(tokens[j].type === 'container_' + kind + '_open' && tokens[j].level === tokens[idx].level)) j--;
        const lines = j >= 0 ? linesOf(infoOf(tokens[j], kind), DEFAULT_LINES[kind]) : DEFAULT_LINES[kind];
        return '</div></aside>\n' + (j >= 0 ? notesHtml(tokens, j, kind, 'Your notes', lines) : '');
      },
    });
  }

  // Your own space to fill in: ::: write Label | 6
  md.use(container, 'write', {
    validate: params => /^write\b/.test(params.trim()),
    render(tokens, idx) {
      const t = tokens[idx];
      if (t.nesting === 1) {
        const [label] = infoOf(t, 'write').split('|').map(s => s.trim());
        return `<section class="wls-write"><h3 class="wls-write__title">${esc(label.replace(/\d+\s*$/, '').trim() || 'Write it down')}</h3><div class="wls-write__hint">\n`;
      }
      let j = idx - 1; while (j >= 0 && !(tokens[j].type === 'container_write_open' && tokens[j].level === t.level)) j--;
      const rest = j >= 0 ? infoOf(tokens[j], 'write') : '';
      const parts = rest.split('|').map(s => s.trim()); const lines = linesOf(parts.length > 1 ? parts[1] : parts[0], 8);
      return '</div>' + (j >= 0 ? notesHtml(tokens, j, 'write', 'Your answer', lines) : '') + '</section>\n';
    },
  });

  // A quiet callout: ::: note Title
  md.use(container, 'note', {
    validate: params => /^note\b/.test(params.trim()),
    render(tokens, idx) {
      const t = tokens[idx];
      if (t.nesting === 1) { const title = infoOf(t, 'note'); return `<aside class="wls-callout">${title ? `<p class="wls-callout__title">${esc(title)}</p>` : ''}<div>\n`; }
      return '</div></aside>\n';
    },
  });

  // Verse numbers: lines inside a passage that start with a number become superscripts.
  md.core.ruler.after('inline', 'passage_verses', state => {
    let inPassage = 0;
    for (const tok of state.tokens) {
      if (tok.type === 'container_passage_open') inPassage++;
      else if (tok.type === 'container_passage_close') inPassage--;
      else if (inPassage > 0 && tok.type === 'inline' && tok.children) {
        const out = []; let atStart = true;
        for (const c of tok.children) {
          if (c.type === 'text' && atStart) {
            const m = /^(\d{1,3})\s+/.exec(c.content);
            if (m) {
              const sup = new state.Token('html_inline', '', 0); sup.content = `<sup>${m[1]}</sup>`;
              out.push(sup); c.content = c.content.slice(m[0].length);
            }
          }
          atStart = c.type === 'softbreak';
          out.push(c);
        }
        tok.children = out;
      }
    }
  });

  // Heading ids
  md.core.ruler.push('heading_ids', state => {
    const seen = {};
    state.tokens.forEach((tok, i) => {
      if (tok.type === 'heading_open') {
        const inline = state.tokens[i + 1]; let id = slugify(inline.content) || 'section';
        if (seen[id]) id += '-' + (++seen[id]); else seen[id] = 1;
        tok.attrSet('id', id);
      }
    });
  });

  // Images: lazy, with figure when a title is given
  const defImg = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, o, env, self) => {
    const t = tokens[idx]; t.attrSet('loading', 'lazy'); t.attrSet('decoding', 'async');
    const html = defImg(tokens, idx, o, env, self);
    const title = t.attrGet('title');
    return title ? `<span class="prose-figure">${html}<span class="prose-figure__cap">${esc(title)}</span></span>` : html;
  };
  // External links
  const defLink = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, o, env, self) => {
    const href = tokens[idx].attrGet('href') || '';
    if (/^https?:\/\//.test(href) && !href.includes('welovescripture.org')) tokens[idx].attrSet('rel', 'noopener');
    return defLink(tokens, idx, o, env, self);
  };
  return md;
}
export const wordCount = s => (String(s || '').match(/\S+/g) || []).length;
export const readingMinutes = s => Math.max(1, Math.round(wordCount(s) / 200));
