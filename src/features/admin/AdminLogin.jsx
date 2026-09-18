import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth.js';

export default function AdminLogin() {
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: signInError } = await signIn(email, password);
    setBusy(false);
    if (signInError) {
      setError('Correo o contraseña incorrectos.');
    }
  };

  return (
    <div className="admin-login-wrap">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-logo">ACERO<span>PRESS</span></div>
        <p className="admin-login-sub">Panel administrativo</p>

        <label className="admin-field">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="admin-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="admin-login-error">{error}</p>}

        <button type="submit" className="admin-btn-primary" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
