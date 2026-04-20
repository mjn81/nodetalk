import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError(t('auth.errors.required'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.errors.min_password'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.errors.passwords_mismatch'));
      return;
    }
    setLoading(true);
    try {
      await register(username, password);
    } catch (err: unknown) {
      setError((err as Error).message ?? t('auth.errors.register_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__logo">
          <div className="auth-card__logo-icon">N</div>
          <span className="auth-card__wordmark">{t('app_name')}</span>
        </div>
        <p className="auth-card__tagline">{t('tagline')}</p>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-username">
              {t('auth.username')}
            </label>
            <input
              id="reg-username"
              type="text"
              className="form-input"
              placeholder={t('auth.username_placeholder')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              {t('auth.password')}
            </label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              placeholder={t('auth.password_placeholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">
              {t('auth.confirm_password')}
            </label>
            <input
              id="reg-confirm"
              type="password"
              className={`form-input ${confirm && confirm !== password ? 'error' : ''}`}
              placeholder={t('auth.confirm_password')}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {confirm && confirm !== password && (
              <p className="form-error">{t('auth.errors.passwords_mismatch')}</p>
            )}
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn--primary"
            disabled={loading}
          >
            {loading
              ? <span className="spinner" style={{ width: 18, height: 18 }} />
              : t('auth.register')}
          </button>
        </form>

        <p className="auth-card__switch">
          {t('auth.have_account')}{' '}
          <Link to="/login">{t('auth.sign_in')}</Link>
        </p>
      </div>
    </div>
  );
}
