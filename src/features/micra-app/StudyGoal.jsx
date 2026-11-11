import { useEffect, useState } from 'react';
import { studyRows } from './study.js';
import { studyGoal, studyTips } from './studyGoal.js';
import { buildReport } from '../admin/piloto/pilotReport.js';
import { loadStudy } from './studyData.js';

// Tu trabajo en el estudio (pedido del usuario, 11 nov 2026: «una métrica de cómo medir mi trabajo…
// para llegar a tener una propuesta de valor con este estudio de mercado»). Mide el trabajo de campo
// contra lo que pide la propuesta: lo listo del informe (`readiness` de pilotReport.js), la muestra,
// el ritmo de la semana y qué tan completas están las fichas. En Estudio (con las fichas que ya
// leyó), en Equipo › Hoy y, corto, en Mi perfil del equipo. Lo puro en studyGoal.js.

const fecha = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export default function StudyGoal({ data = null, go, compact = false }) {
  const [own, setOwn] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (data) return undefined;
    let alive = true;
    loadStudy().then((d) => { if (alive) setOwn(d); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [data]);
  const src = data ?? own;
  if (!src) return failed || compact ? null : <section className="mapp-glass mapp-sgoal is-loading" aria-hidden="true" />;

  const g = studyGoal(studyRows(src.tinteros, src.surveys), new Date());
  const ready = buildReport(src, src.scenario).readiness;
  const readyN = ready.filter((r) => r.done).length;
  const pct = readyN / ready.length;
  const status = g.done ? 'Muestra completa' : g.onTrack ? 'A tiempo' : 'Atrasado';

  if (compact) {
    return (
      <button type="button" className="mapp-glass mapp-sgoal is-compact" onClick={() => go?.('/micra/estudio')} data-testid="study-work-compact">
        <span className="mapp-sgoal-ring" style={{ '--p': pct }} aria-hidden="true"><b>{readyN}/{ready.length}</b></span>
        <span>
          <b>Tu trabajo · propuesta {readyN} de {ready.length} lista</b>
          <small>{g.surveyed} de {g.goal.surveys} encuestas · {g.week.surveys} esta semana · {status.toLowerCase()}</small>
        </span>
      </button>
    );
  }

  const tips = studyTips(g);
  const fresh = g.plan.filter((p) => p.fresh);
  return (
    <section className="mapp-glass mapp-sgoal" aria-label="Tu trabajo en el estudio" data-testid="study-work">
      <p className="mapp-cota is-red">Tu trabajo · estudio de mercado</p>
      <div className="mapp-sgoal-top">
        <span className="mapp-sgoal-ring is-big" style={{ '--p': pct }} aria-hidden="true"><b>{readyN}/{ready.length}</b><small>listo</small></span>
        <div>
          <b className="mapp-sgoal-big">Propuesta de valor: {readyN} de {ready.length} cosas listas</b>
          <small>Lo que pide el informe para presentarla. La meta de campo es el {fecha(g.goal.until)}: {g.goal.surveys} encuestas en {g.goal.zones} localidades, {g.goal.perZone} o más en cada una.</small>
        </div>
      </div>

      <dl className="mapp-sgoal-kpis" data-testid="study-work-kpis">
        <div><dd>{g.surveyed}<small>/{g.goal.surveys}</small></dd><dt>encuestas</dt></div>
        <div><dd>{g.zonesDone.length}<small>/{g.goal.zones}</small></dd><dt>localidades con {g.goal.perZone}+</dt></div>
        <div><dd>{g.toMap}</dd><dt>puestos por mapear</dt></div>
        <div><dd>{g.usable}<small>/{g.needs[0]?.total ?? 0}</small></dd><dt>fichas que sirven</dt></div>
      </dl>

      <div className={`mapp-sgoal-pace ${g.done || g.onTrack ? 'is-ok' : 'is-late'}`} data-testid="study-work-pace">
        <p className="mapp-cota">Tu ritmo · últimos 7 días <span className="mapp-sgoal-chip">{status}</span></p>
        <div><span>Encuestas</span><b>{g.week.surveys}</b><small>semana anterior {g.week.prevSurveys} · necesitas {g.pace.surveys} por semana</small></div>
        <div><span>Puestos nuevos</span><b>{g.week.fichas}</b><small>semana anterior {g.week.prevFichas} · necesitas {g.pace.fichas} por semana</small></div>
        <p className="mapp-fine">Quedan {plural(g.days, 'día', 'días')} de calle, de lunes a sábado. Hoy llevas {plural(g.challenge.surveys.have, 'encuesta', 'encuestas')} y {plural(g.challenge.fichas.have, 'puesto nuevo', 'puestos nuevos')}.</p>
      </div>

      {!g.done && (
        <>
          <p className="mapp-cota">Dónde trabajar</p>
          <ul className="mapp-sgoal-plan" data-testid="study-work-plan">
            {g.plan.filter((p) => !p.fresh).map((p) => (
              <li key={p.zone}><b>{p.zone}</b><span>{plural(p.surveys, 'encuesta más', 'encuestas más')}{p.map ? ` · mapea ${p.map}` : ' · vuelve a las fichas que ya tienes'}</span></li>
            ))}
            {fresh.length > 0 && (
              <li><b>{fresh.length === 1 ? 'Una localidad nueva' : `${fresh.length} localidades nuevas`}</b><span>{fresh[0].map} puestos y {fresh[0].surveys} encuestas en cada una</span></li>
            )}
            {g.extra > 0 && <li><b>Las demás</b><span>{plural(g.extra, 'encuesta', 'encuestas')} volviendo a fichas que ya están en el mapa</span></li>}
          </ul>
        </>
      )}

      <p className="mapp-cota">Calidad de las fichas</p>
      <ul className="mapp-sgoal-needs" data-testid="study-work-needs">
        {g.needs.slice(0, 4).map((n) => (
          <li key={n.key}>
            <span><b>{n.label}</b><small>{n.why}</small></span>
            <span className="mapp-sgoal-bar" role="progressbar" aria-label={n.label} aria-valuemin={0} aria-valuemax={n.total} aria-valuenow={n.have}><i style={{ width: `${n.total ? (n.have / n.total) * 100 : 0}%` }} /></span>
            <b>{n.have}/{n.total}</b>
          </li>
        ))}
      </ul>

      <p className="mapp-cota">Para presentar la propuesta</p>
      <ul className="mapp-sgoal-ready" data-testid="study-work-ready">
        {ready.map((r) => (
          <li key={r.id} className={r.done ? 'is-done' : ''}>
            <span aria-hidden="true">{r.done ? '✓' : '○'}</span>
            <span>{r.label}{r.goal != null ? ` · ${r.have} de ${r.goal}` : ''}{r.hint ? ` (${r.hint})` : ''}</span>
          </li>
        ))}
      </ul>

      {tips.length > 0 && (
        <>
          <p className="mapp-cota">Qué mueve más los números</p>
          <ol className="mapp-sgoal-tips" data-testid="study-work-tips">{tips.map((t) => <li key={t.key}>{t.text}</li>)}</ol>
        </>
      )}
      {go && <button type="button" className="mapp-btn is-cta" onClick={() => go('/micra/estudio')} data-testid="study-work-go">Ir al estudio</button>}
    </section>
  );
}
