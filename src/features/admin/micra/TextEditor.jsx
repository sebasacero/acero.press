import { useEffect, useRef, useState } from 'react';

// Editor de texto de Micra, como el de las historias: pantalla oscura, el
// texto grande en su tipografía real y, arriba, una ficha por cada texto de
// la tarjeta. Nada se redibuja mientras se escribe: «Listo» aplica todo junto.

const AUTO_KEYS = ['title', 'subtitle', 'note', 'fig', 'sign'];
const FREE_FONTS = [['marker', 'Marcador'], ['mono', 'Plano'], ['grotesk', 'Titular']];
const FREE_COLORS = [['red', 'Rojo', '#fa2525'], ['theme', 'Tinta', '#F7F3E8']];
const ALIGN_NEXT = { left: 'center', center: 'right', right: 'left' };
const ALIGN_GLYPH = { left: '⟸', center: '≡', right: '⟹' };

export default function TextEditor({ targets, initialKey, values, autos, placeholders = {}, freeLook, titleColor, onCommit, onCancel }) {
  const [active, setActive] = useState(() => (targets.some((t) => t.key === initialKey) ? initialKey : targets[0]?.key));
  const [vals, setVals] = useState(() => Object.fromEntries(targets.map((t) => [t.key, values[t.key]])));
  const [free, setFree] = useState(() => ({ style: freeLook.style, color: freeLook.color, bg: freeLook.bg, align: freeLook.align }));
  const [tColor, setTColor] = useState(titleColor);
  const inputRef = useRef(null);
  const target = targets.find((t) => t.key === active) ?? targets[0];

  useEffect(() => { inputRef.current?.focus(); }, [active]);

  const value = vals[active] ?? '';
  const isAuto = AUTO_KEYS.includes(active);
  const setValue = (v) => setVals((s) => ({ ...s, [active]: v }));

  const commit = () => {
    const patch = {};
    for (const t of targets) {
      let v = vals[t.key];
      // En los textos automáticos, vacío = volver al automático
      if (AUTO_KEYS.includes(t.key) && (v === '' || v === undefined)) v = null;
      if (typeof v === 'string') v = t.multiline ? v.replace(/\s+$/g, '') : v.trim();
      if (v !== values[t.key]) patch[t.key] = v;
    }
    const style = {};
    if (free.style !== freeLook.style) style.style = free.style;
    if (free.color !== freeLook.color) style.color = free.color;
    if (free.bg !== freeLook.bg) style.bg = free.bg;
    if (free.align !== freeLook.align) style.align = free.align;
    onCommit(patch, { free: style, titleColor: tColor !== titleColor ? tColor : undefined });
  };

  // Enter = Listo; Mayús+Enter = otra línea (solo en el texto libre, el único que respeta los saltos)
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || (e.shiftKey && target?.breaks)) return;
    e.preventDefault();
    commit();
  };

  const fontClass = target?.font === 'free' ? `is-free is-${free.style}` : `is-${target?.font || 'body'}`;
  const placeholder = isAuto ? (autos[active] || 'Automático') : placeholders[active] || 'Escribe aquí';
  const freeColor = FREE_COLORS.find(([id]) => id === free.color)?.[2];

  return (
    <div className="mtext" role="dialog" aria-modal="true" aria-label="Editar texto">
      <header className="mtext-top">
        <button type="button" className="mc-pill" onClick={onCancel}>Cancelar</button>
        <button type="button" className="mc-pill mc-pill-on" onClick={commit}>Listo</button>
      </header>

      <div className="mtext-chips" role="tablist" aria-label="Texto">
        {targets.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            className={`mtext-chip ${t.key === active ? 'on' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mtext-mid">
        <textarea
          ref={inputRef}
          className={`mtext-input ${fontClass} ${active === 'free' && free.bg ? 'has-bg' : ''}`}
          style={active === 'free' ? { color: freeColor, textAlign: free.align } : active === 'title' && tColor === 'red' ? { color: '#fa2525' } : undefined}
          aria-label={target?.label}
          rows={target?.multiline ? 3 : 1}
          maxLength={target?.max}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(target?.breaks ? e.target.value : e.target.value.replace(/\n/g, ' '))}
          onKeyDown={onKeyDown}
        />
      </div>

      {active === 'free' && (
        <div className="mtext-tools" aria-label="Estilo del texto libre">
          <div className="mtext-fonts" role="group" aria-label="Letra">
            {FREE_FONTS.map(([id, label]) => (
              <button key={id} type="button" className={`mtext-font is-${id} ${free.style === id ? 'on' : ''}`} aria-pressed={free.style === id} onClick={() => setFree((f) => ({ ...f, style: id }))}>{label}</button>
            ))}
          </div>
          <div className="mtext-row">
            {FREE_COLORS.map(([id, label, hex]) => (
              <button key={id} type="button" className={`mtext-dot ${free.color === id ? 'on' : ''}`} style={{ '--dot': hex }} aria-pressed={free.color === id} aria-label={label} title={label} onClick={() => setFree((f) => ({ ...f, color: id }))} />
            ))}
            <button type="button" className={`mtext-tool ${free.bg ? 'on' : ''}`} aria-pressed={free.bg} onClick={() => setFree((f) => ({ ...f, bg: !f.bg }))}>A▣ Fondo</button>
            <button type="button" className="mtext-tool" aria-label={`Alinear: ${free.align === 'left' ? 'izquierda' : free.align === 'center' ? 'centro' : 'derecha'}`} onClick={() => setFree((f) => ({ ...f, align: ALIGN_NEXT[f.align] }))}>{ALIGN_GLYPH[free.align]}</button>
          </div>
        </div>
      )}
      {active === 'title' && (
        <div className="mtext-tools">
          <div className="mtext-row">
            {[['auto', 'Auto', '#F7F3E8'], ['red', 'Rojo', '#fa2525']].map(([id, label, hex]) => (
              <button key={id} type="button" className={`mtext-tool ${tColor === id ? 'on' : ''}`} aria-pressed={tColor === id} onClick={() => setTColor(id)}>
                <i className="mtext-swatch" style={{ background: hex }} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </div>
      )}

      <footer className="mtext-foot">
        <span className="mtext-count">{value.length}/{target?.max}</span>
        {isAuto ? (
          <button type="button" className="mtext-auto" disabled={vals[active] == null} onClick={() => setValue(null)}>Usar automático</button>
        ) : (
          <button type="button" className="mtext-auto" disabled={!value} onClick={() => setValue('')}>Borrar</button>
        )}
      </footer>
    </div>
  );
}
