// Markdown mínimo para mostrar las respuestas del asistente (títulos ##,
// listas, **negrita** y [enlaces](url)). Genera elementos de React, nunca
// HTML crudo, así que el texto del modelo no puede inyectar marcado.

function inline(text, keyBase) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    else out.push(<a key={`${keyBase}-a${i++}`} href={m[3]} target="_blank" rel="noopener noreferrer">{m[2]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function MiniMarkdown({ text }) {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push(list.ordered
      ? <ol key={`l${blocks.length}`}>{list.items}</ol>
      : <ul key={`l${blocks.length}`}>{list.items}</ul>);
    list = null;
  };
  String(text || '').split('\n').forEach((raw, idx) => {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push(<h4 key={idx}>{inline(heading[1], idx)}</h4>);
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(<li key={idx}>{inline((bullet || numbered)[1], idx)}</li>);
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      blocks.push(<p key={idx}>{inline(line, idx)}</p>);
    }
  });
  flush();
  return <div className="mini-md">{blocks}</div>;
}
