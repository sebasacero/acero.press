import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/lib/supabaseClient.js';
import { instagramStatus, instagramConnect, instagramRefresh, instagramSync } from '../../../shared/lib/instagram.js';

const DAY = 86_400_000;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-CO'));

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / DAY));
}

export default function InstagramPage() {
  const [state, setState] = useState(null); // respuesta de instagram-auth status
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null); // 'refresh' | 'sync' | 'connect'
  const [notice, setNotice] = useState(null);
  const [token, setToken] = useState('');
  const [posts, setPosts] = useState([]);

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('ig_media')
      .select('id, media_product, media_type, caption, permalink, thumbnail_url, posted_at, like_count, comments_count, reach, saved, shares, views')
      .order('posted_at', { ascending: false })
      .limit(12);
    setPosts(data ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setState(await instagramStatus());
    } catch (err) {
      setLoadError(err.message);
    }
    loadPosts();
  }, [loadPosts]);

  useEffect(() => { load(); }, [load]);

  const run = async (kind, fn, okText) => {
    setBusy(kind);
    setNotice(null);
    try {
      const r = await fn();
      setNotice({ ok: true, text: typeof okText === 'function' ? okText(r) : okText });
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    }
    setBusy(null);
  };

  const s = state?.status;
  const live = state?.live;
  const left = daysLeft(s?.expires_at);
  const connected = !!live?.ok;
  const neverExpires = s && !s.expires_at;
  const segs = left === null ? 20 : Math.round((Math.min(left, 60) / 60) * 20);

  return (
    <div className="admin-page esp">
      <header className="esp-head">
        <div className="esp-cota">
          <span>FIG. 07 — INSTAGRAM / CONEXIÓN</span>
          <span className="esp-badge">{connected ? 'CONECTADO' : 'SIN CONEXIÓN'}</span>
        </div>
        <h1 className="esp-title">Instagram.</h1>
        <p className="esp-sub">
          Mantén viva la conexión con Instagram para publicar las ventas de Micra y traer las
          métricas que usa el asistente de crecimiento.
        </p>
      </header>

      {loadError && (
        <p className="esp-notice err">
          No se pudo consultar el estado: {loadError}. Si acabas de crear las funciones, revisa que estén desplegadas en Supabase.
        </p>
      )}

      <div className="esp-layout ig-layout">
        <div className="esp-steps">
          <section className="esp-step">
            <div className="esp-step-head">
              <span className={`esp-step-num ${connected ? 'is-done' : ''}`}>{connected ? '✓' : '01'}</span>
              <div>
                <h3 className="esp-step-title">Estado</h3>
                <p className="esp-step-hint">
                  {state === null && !loadError ? 'Consultando a Meta…' : connected ? `@${live.username}` : live?.error || 'Instagram no está conectado.'}
                </p>
              </div>
            </div>

            <dl className="esp-specs ig-specs">
              <div><dt>Seguidores</dt><dd>{num(live?.followers_count)}</dd></div>
              <div><dt>Vence</dt><dd>{neverExpires ? 'Nunca' : left === null ? '—' : `${left} d`}</dd></div>
              <div><dt>Renovado</dt><dd>{s?.refreshed_at ? new Date(s.refreshed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}</dd></div>
            </dl>
            {!neverExpires && (
              <div className="ig-segbar" aria-label={`Días restantes del token: ${left ?? 'desconocido'}`}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className={i < segs ? (left !== null && left < 10 ? 'warn' : 'on') : ''} />
                ))}
              </div>
            )}
            <p className="esp-step-hint">
              {s?.token_kind === 'facebook_login'
                ? 'Token de Página de Facebook: no vence mientras sigas siendo admin de la Página.'
                : 'Se renueva solo cada semana mientras se use. Si pasan 60 días sin uso, vuelve a conectarlo abajo.'}
            </p>
            {state?.secrets?.token && (
              <p className="esp-step-hint">
                Token tomado de los Secrets de Supabase: <code>{state.secrets.token}</code> · <code>{state.secrets.userId ?? 'sin user id'}</code>. Las renovaciones se guardan en la base para que no venza.
              </p>
            )}
            {s?.last_error && <p className="esp-notice err">{s.last_error}</p>}

            <div className="esp-actions-row">
              <button type="button" className="esp-btn esp-btn-ghost" disabled={!s || busy} onClick={() => run('refresh', instagramRefresh, 'Token renovado por 60 días.')}>
                {busy === 'refresh' ? 'Renovando…' : 'Renovar ahora'}
              </button>
              <button type="button" className="esp-btn esp-btn-primary" disabled={!connected || busy} onClick={() => run('sync', instagramSync, (r) => `Sincronizados ${r.synced} posts · ${num(r.followers)} seguidores.`)}>
                {busy === 'sync' ? 'Sincronizando…' : 'Traer métricas'}
              </button>
            </div>
          </section>

          <section className="esp-step">
            <div className="esp-step-head">
              <span className="esp-step-num">02</span>
              <div>
                <h3 className="esp-step-title">Conectar o cambiar token</h3>
                <p className="esp-step-hint">Opcional: ya se usa el token de tus Secrets. Pega uno nuevo solo si Meta revoca el acceso.</p>
              </div>
            </div>
            <ol className="ig-guide">
              <li>
                Abre <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta for Developers → Mis apps</a> y entra a la app de AceroPress.
              </li>
              <li>
                Ve a <strong>Instagram → Configuración de la API con inicio de sesión de Instagram</strong>.
              </li>
              <li>
                En <strong>Generar tokens de acceso</strong>, agrega la cuenta <strong>@aceropress</strong> (debe ser cuenta profesional: Empresa o Creador) y pulsa <strong>Generar token</strong>.
              </li>
              <li>
                Acepta los permisos <code>instagram_business_basic</code>, <code>instagram_business_content_publish</code> e <code>instagram_business_manage_insights</code>, copia el token y pégalo aquí.
              </li>
            </ol>
            <label className="ig-token-field">
              <span>Token de acceso</span>
              <textarea
                className="esp-input"
                rows={3}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="IGAA… (Instagram) o EAA… (Facebook)"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="esp-step-hint">
              El token se guarda en Supabase, donde solo lo leen las funciones del servidor; nunca vuelve al navegador. Tipo detectado:{' '}
              <strong>{token.trim().startsWith('EAA') ? 'Facebook Login' : token.trim() ? 'Instagram Login' : '—'}</strong>
            </p>
            <div className="esp-actions-row">
              <button
                type="button"
                className="esp-btn esp-btn-primary"
                disabled={token.trim().length < 20 || busy}
                onClick={() => run('connect', () => instagramConnect(token), (r) => { setToken(''); return `Conectado como @${r.status?.username ?? 'cuenta'}.`; })}
              >
                {busy === 'connect' ? 'Validando con Meta…' : 'Conectar'}
              </button>
            </div>
            {state?.secrets && (
              <p className="esp-step-hint">
                Secrets encontrados en Supabase:{' '}
                {[
                  ['Token', state.secrets.token],
                  ['User ID', state.secrets.userId],
                  ['App ID', state.secrets.appId],
                  ['App Secret', state.secrets.appSecret],
                ].map(([label, name], i) => (
                  <span key={label}>{i ? ' · ' : ''}{label} {name ? <code>{name} ✓</code> : '✗'}</span>
                ))}
                {' '}(App ID y App Secret solo son obligatorios para tokens EAA de Facebook).
              </p>
            )}
          </section>
          {notice && <p className={`esp-notice ${notice.ok ? 'ok' : 'err'} ig-notice`}>{notice.text}</p>}
        </div>

        <div className="esp-preview">
          <div className="esp-cota esp-cota-dark">
            <span>POSTS RECIENTES · MÉTRICAS</span>
            <span className="esp-badge">{posts.length}</span>
          </div>
          {posts.length === 0 ? (
            <div className="esp-empty ig-empty">
              <span className="esp-empty-fig">FIG. 07</span>
              <p>Conecta Instagram y pulsa “Traer métricas”.</p>
            </div>
          ) : (
            <ul className="ig-posts">
              {posts.map((p) => (
                <li key={p.id} className="ig-post">
                  {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" loading="lazy" /> : <span className="ig-thumb-empty" />}
                  <div className="ig-post-body">
                    <div className="ig-post-meta">
                      <span>{p.media_product || p.media_type}</span>
                      <span>{fmtDate(p.posted_at)}</span>
                    </div>
                    <p className="ig-post-caption">{p.caption || 'Sin texto'}</p>
                    <div className="ig-post-stats">
                      <span><strong>{num(p.reach)}</strong> alcance</span>
                      <span><strong>{num(p.like_count)}</strong> likes</span>
                      <span><strong>{num(p.saved)}</strong> guardados</span>
                      <span><strong>{num(p.shares)}</strong> compartidos</span>
                    </div>
                    {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer">Ver en Instagram ↗</a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
