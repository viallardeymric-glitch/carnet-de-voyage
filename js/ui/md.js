import { html } from '../../vendor/preact.js';

// Mise en forme simple du guide : « ## » titres, « - » listes, **gras**.
export function md(text) {
  const blocks = [];
  const inline = (t) => t.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? html`<b>${part}</b>` : part));
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,4}\s/.test(line)) blocks.push({ t: 'h', v: line.replace(/^#+\s*/, '') });
    else if (/^[-*•]\s/.test(line)) {
      const last = blocks[blocks.length - 1];
      const item = line.replace(/^[-*•]\s*/, '');
      if (last?.t === 'ul') last.v.push(item);
      else blocks.push({ t: 'ul', v: [item] });
    } else blocks.push({ t: 'p', v: line.replace(/^\*\*(.+)\*\*$/, '$1') });
  }
  return blocks.map((b) =>
    b.t === 'h' ? html`<h4>${b.v}</h4>` : b.t === 'ul' ? html`<ul>${b.v.map((x) => html`<li>${inline(x)}</li>`)}</ul>` : html`<p>${inline(b.v)}</p>`
  );
}

