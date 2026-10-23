import { BRANDS, OPTIONS, PRESETS, surveyProgress } from './survey.js';
import './survey.css';

// La encuesta del tintero, con los estilos de las hojas de Micra (msheet-*).
// Botones grandes y pocas letras: se llena de pie frente al puesto. Tocar
// otra vez una opción la quita. Sin el permiso, nada se puede marcar.

const fmtLb = (v) => (v === 0.5 ? '½' : String(v).replace('.', ','));

export function Choice({ label, field, options, form, set, grid = false }) {
  return (
    <div className="msheet-group">
      <span className="msheet-label" id={`srv-${field}`}>{label}</span>
      <div className={`msheet-chips ${grid ? 'is-grid srv-grid-7' : ''}`} role="group" aria-labelledby={`srv-${field}`}>
        {options.map(([value, text]) => {
          const on = form[field] === value;
          return (
            <button key={String(value)} type="button" className={`msheet-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ [field]: on ? null : value })}>{text}</button>
          );
        })}
      </div>
    </div>
  );
}

export function Multi({ label, field, options, form, set }) {
  const list = form[field] ?? [];
  return (
    <div className="msheet-group">
      <span className="msheet-label" id={`srv-${field}`}>{label}</span>
      <div className="msheet-chips" role="group" aria-labelledby={`srv-${field}`}>
        {options.map(([value, text]) => {
          const on = list.includes(value);
          return (
            <button key={value} type="button" className={`msheet-chip ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => set({ [field]: on ? list.filter((v) => v !== value) : [...list, value] })}>{text}</button>
          );
        })}
      </div>
    </div>
  );
}

function Amount({ label, field, presets, form, set, placeholder, inputMode = 'decimal', fmt = String, hint }) {
  return (
    <div className="msheet-group">
      <label className="msheet-label" htmlFor={`srv-in-${field}`}>{label}</label>
      {presets && (
        <div className="msheet-chips" role="group" aria-label={`${label}: valores rápidos`}>
          {presets.map((p) => {
            const on = String(form[field]).replace(',', '.') === String(p);
            return <button key={p} type="button" className={`msheet-chip is-sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ [field]: on ? '' : String(p) })}>{fmt(p)}</button>;
          })}
        </div>
      )}
      <input id={`srv-in-${field}`} className="msheet-input" inputMode={inputMode} autoComplete="off" placeholder={placeholder} value={form[field]} onChange={(e) => set({ [field]: e.target.value })} />
      {hint && <small className="msheet-fine">{hint}</small>}
    </div>
  );
}

function Brand({ form, set }) {
  const known = BRANDS.includes(form.coffee_brand);
  const other = !!form.coffee_brand && !known;
  return (
    <div className="msheet-group">
      <span className="msheet-label" id="srv-coffee_brand">Qué café usa</span>
      <div className="msheet-chips" role="group" aria-labelledby="srv-coffee_brand">
        {BRANDS.map((b) => {
          const on = form.coffee_brand === b;
          return <button key={b} type="button" className={`msheet-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ coffee_brand: on ? '' : b })}>{b}</button>;
        })}
      </div>
      <input className="msheet-input" autoComplete="off" maxLength={60} placeholder="Otra marca" aria-label="Otra marca de café" value={other ? form.coffee_brand : ''} onChange={(e) => set({ coffee_brand: e.target.value })} />
    </div>
  );
}

export default function SurveyForm({ form, onChange, name }) {
  const set = (patch) => onChange({ ...form, ...patch });
  const { answered, total } = surveyProgress(form);
  const props = { form, set };
  return (
    <div className="srv" data-testid="survey">
      <div className="msheet-group srv-consent">
        <p className="msheet-fine srv-say">
          Cuéntale{name ? ` a ${name}` : ''}: «Es un estudio de ACERO.press sobre el café en la calle. Lo que respondas no se publica con tu nombre y puedes saltarte lo que quieras.»
        </p>
        <label className="msheet-switch is-sale">
          <input type="checkbox" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} />
          <span>Aceptó responder</span>
          <small>sin esto no se guarda</small>
        </label>
      </div>

      <fieldset className="srv-body" disabled={!form.consent} aria-label="Preguntas de la encuesta">
        <div className="srv-progress" aria-live="polite"><i style={{ '--p': `${Math.round((answered / total) * 100)}%` }} /><span>{answered} de {total}</span></div>

        <h3 className="srv-h">Su negocio</h3>
        <Amount label="Tazas al día" field="cups_per_day" presets={PRESETS.cups_per_day} placeholder="Otro número" inputMode="numeric" {...props} />
        <Amount label="Horas al día" field="hours_per_day" presets={PRESETS.hours_per_day} placeholder="Otro número" {...props} />
        <Choice label="Días a la semana" field="days_per_week" options={PRESETS.days_per_week.map((d) => [d, String(d)])} grid {...props} />
        <Choice label="Hace cuánto vende tinto" field="years_selling" options={OPTIONS.years_selling} {...props} />

        <h3 className="srv-h">Su café</h3>
        <Brand {...props} />
        <Amount label="Libras a la semana (de 500 g)" field="libras_week" presets={PRESETS.libras_week} fmt={fmtLb} placeholder="Otra cantidad" {...props} />
        <Amount label="A cuánto compra la libra" field="price_libra" placeholder="$ por libra de 500 g" inputMode="numeric" {...props} />
        <Choice label="Dónde lo compra" field="buys_where" options={OPTIONS.buys_where} {...props} />

        <h3 className="srv-h">Café de especialidad</h3>
        <Choice label="¿Vendería una taza de especialidad?" field="would_sell_specialty" options={OPTIONS.would_sell_specialty} {...props} />
        <Amount label="¿A cuánto la vendería?" field="specialty_price" placeholder="$ por taza" inputMode="numeric" {...props} />
        <Choice label="¿Le interesa un kit AeroPress?" field="kit_interest" options={OPTIONS.kit_interest} {...props} />
        <Choice label="¿Cómo lo pagaría?" field="kit_payment" options={OPTIONS.kit_payment} {...props} />
        <Choice label="¿Qué preferiría: una nueva preparación o un termo con café listo para vender?" field="offer_choice" options={OPTIONS.offer_choice} {...props} />
        {form.offer_choice === 'termo' && (
          <Amount label="¿Cuántas tazas del termo vendería al día?" field="thermo_cups_day" presets={PRESETS.thermo_cups_day} placeholder="Otro número" inputMode="numeric" {...props} />
        )}

        <h3 className="srv-h">Celular y pagos</h3>
        <Choice label="¿Tiene celular con datos?" field="has_smartphone" options={OPTIONS.has_smartphone} {...props} />
        <Multi label="¿Cómo le pagan?" field="payments" options={OPTIONS.payments} {...props} />

        <h3 className="srv-h">Quién es <small>opcional · el informe solo muestra grupos de 5 o más</small></h3>
        <Choice label="Género" field="gender" options={OPTIONS.gender} {...props} />
        <Choice label="Edad" field="age_range" options={OPTIONS.age_range} {...props} />
        <Choice label="¿Es su ingreso principal?" field="main_income" options={OPTIONS.main_income} {...props} />

        <label className="msheet-group">
          <span className="msheet-label">Nota (opcional, no sale en el informe)</span>
          <textarea className="msheet-input is-caption" rows={2} maxLength={500} placeholder="Lo que contó y no cabe arriba" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </fieldset>
    </div>
  );
}
