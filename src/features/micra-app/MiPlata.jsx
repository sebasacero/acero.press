import { useState } from 'react';
import { money, cupsLabel, weekdayLetter } from './micraApp.js';
import { EXPENSE_KINDS, MAX_EXPENSE, byProductRows, byHourRows, addExpense, removeExpense, expensesOf, ledger, bogotaDay } from './plata.js';

// Mi plata como tablero (pedido del usuario, 6 nov 2026): la misma cabecera térmica de Vender con
// lo que entró hoy, y debajo la contabilidad del día: cobrado, fiado, gastos y ganancia; qué se
// vende más, a qué hora, la semana y quién debe. Los gastos se anotan aquí y viven en el celular.
const KEY = 'micra_gastos_v1';
const read = (id) => { try { return JSON.parse(localStorage.getItem(KEY))?.[id] ?? []; } catch { return []; } };
const write = (id, list) => { try { localStorage.setItem(KEY, JSON.stringify({ ...(JSON.parse(localStorage.getItem(KEY)) ?? {}), [id]: list })); } catch { /* sin memoria: vale mientras esté abierta */ } };
const kindOf = (id) => EXPENSE_KINDS.find((k) => k.id === id) ?? EXPENSE_KINDS.at(-1);
const hourLabel = (h) => (h === 12 ? '12 m.' : h < 12 ? `${h} a. m.` : `${h - 12} p. m.`);

export default function MiPlata({ day, board, sum, menu, bars, onShare, children, name = null, sub = null, av = null }) {
  const [list, setList] = useState(() => read(day.id));
  const [kind, setKind] = useState(null);
  const [amount, setAmount] = useState('');
  const today = bogotaDay();
  const gastos = expensesOf(list, today);
  const L = ledger({ total: board.total, cash: sum.cash, fiado: sum.fiado, expenses: gastos });
  const products = byProductRows(day.sales, menu);
  const { hours, best } = byHourRows(day.sales);
  const save = (next) => { setList(next); write(day.id, next); };
  const add = (e) => {
    e.preventDefault();
    const next = addExpense(list, kind, amount);
    if (next.length === list.length) return;
    save(next);
    setKind(null);
    setAmount('');
  };

  return (
    <div className="mapp-plata" data-testid="plata">
      <section className="mapp-plata-head" aria-label="Lo de hoy">
        {/* En «Mi cuenta» (12 nov 2026: Mi plata y Mi perfil en una sola página) arriba va quién es */}
        {name && (
          <header className="mapp-plata-who">
            {av && <span className="mapp-plata-av" aria-hidden="true">{av}</span>}
            <div><h1>{name}</h1>{sub && <p>{sub}</p>}</div>
          </header>
        )}
        <p className="mapp-plata-kicker">Mi plata · hoy</p>
        <p className="mapp-plata-total" data-testid="plata-total">{money(L.vendido)}</p>
        <p className="mapp-plata-sub">{cupsLabel(board.cups)} · semana {money(board.weekMoney)}</p>
        <dl className="mapp-plata-kpis">
          <div><dt>Cobrado</dt><dd>{money(L.cobrado)}</dd></div>
          <div><dt>Fiado</dt><dd>{money(L.fiado)}</dd></div>
          <div><dt>Gastos</dt><dd>{money(L.gastos)}</dd></div>
        </dl>
        <div className={`mapp-plata-win ${L.ganancia < 0 ? 'is-neg' : ''}`} data-testid="plata-ganancia">
          <span>Ganancia de hoy</span>
          <b>{L.ganancia < 0 ? '−' : ''}{money(Math.abs(L.ganancia))}</b>
          <small>Lo cobrado menos lo gastado. Lo fiado entra cuando te paguen.</small>
        </div>
      </section>

      <section className="mapp-glass" aria-labelledby="plata-gastos">
        <p className="mapp-cota" id="plata-gastos">Gastos de hoy · {money(L.gastos)}</p>
        <div className="mapp-plata-kinds" role="group" aria-label="Qué compraste">
          {EXPENSE_KINDS.map((k) => (
            <button key={k.id} type="button" className={kind === k.id ? 'on' : ''} aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>
              <span aria-hidden="true">{k.icon}</span>{k.label}
            </button>
          ))}
        </div>
        {kind && (
          <form className="mapp-plata-add" onSubmit={add}>
            <label className="mapp-field">
              <span>¿Cuánto pagaste por {kindOf(kind).label.toLowerCase()}?</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder="Ej.: 12000" aria-label="Valor del gasto" autoFocus />
            </label>
            <button type="submit" className="mapp-btn is-cta is-small" disabled={!amount || Number(amount) > MAX_EXPENSE} data-testid="gasto-add">Anotar gasto</button>
          </form>
        )}
        {gastos.length > 0 ? (
          <ul className="mapp-plata-list">
            {gastos.map((g) => (
              <li key={g.id}>
                <span aria-hidden="true">{kindOf(g.kind).icon}</span>
                <b>{kindOf(g.kind).label}</b>
                <em>{money(g.amount)}</em>
                <button type="button" className="mapp-link" onClick={() => save(removeExpense(list, g.id))} aria-label={`Quitar el gasto de ${kindOf(g.kind).label.toLowerCase()}`}>Quitar</button>
              </li>
            ))}
          </ul>
        ) : <p className="mapp-muted">Anota lo que compras para el día y Micra te dice cuánto te ganaste.</p>}
      </section>

      {children}

      {/* Lo que se mira de vez en cuando va plegado: la página abre con lo de hoy */}
      <details className="mapp-glass mapp-plata-more" data-testid="plata-stats">
        <summary>Cómo va tu venta <small>qué vendes más, a qué hora y la semana</small></summary>
      <section className="mapp-plata-sec" aria-labelledby="plata-prod">
        <p className="mapp-cota" id="plata-prod">Lo que más vendes hoy</p>
        {products.length === 0 ? <p className="mapp-muted">Cuando cuentes tu primera taza en Vender, aquí sale qué se vende más.</p> : (
          <ul className="mapp-plata-bars">
            {products.map((p) => (
              <li key={p.id}>
                <span><b>{p.label}</b> · {cupsLabel(p.cups)}</span>
                <em>{money(p.total)}</em>
                <i aria-hidden="true"><i style={{ width: `${Math.max(4, p.share * 100)}%` }} /></i>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mapp-plata-sec" aria-labelledby="plata-horas">
        <p className="mapp-cota" id="plata-horas">A qué hora vendes{best !== null ? ` · mejor a las ${hourLabel(best)}` : ''}</p>
        <div className="mapp-plata-hours" aria-hidden="true">
          {hours.map((h) => <span key={h.hour} className={h.hour === best ? 'is-best' : ''}><i style={{ height: `${Math.max(3, h.h * 100)}%` }} /><small>{h.hour % 3 === 0 ? h.hour : ''}</small></span>)}
        </div>
        <p className="mapp-cota">Esta semana · {cupsLabel(board.weekCups)}</p>
        <div className="mapp-week" aria-label="Tazas por día, esta semana">
          {bars.map((d) => (
            <span key={d.day} className={d.today ? 'is-today' : ''} title={`${d.cups} tazas`}>
              <i style={{ height: `${Math.max(4, d.h * 100)}%` }} />
              <small>{weekdayLetter(d.day)}</small>
            </span>
          ))}
        </div>
      </section>
      </details>
      <button type="button" className="mapp-btn is-ghost mapp-plata-share" onClick={onShare} disabled={board.cups === 0} data-testid="story-open">Compartir mi día</button>
    </div>
  );
}
