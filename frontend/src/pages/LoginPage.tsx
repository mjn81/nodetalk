import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError(t('auth.errors.required'));
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError((err as Error).message ?? t('auth.errors.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* Language switcher at top-right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <LanguageSwitcher />
        </div>

        <div className="auth-card__logo">
          <div className="auth-card__logo-icon">N</div>
          <span className="auth-card__wordmark">{t('app_name')}</span>
        </div>
        <p className="auth-card__tagline">{t('tagline')}</p>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">{t('auth.username')}</label>
            <input
              id="login-username"
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
            <label className="form-label" htmlFor="login-password">{t('auth.password')}</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn--primary"
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : t('auth.login')}
          </button>
        </form>

        <p className="auth-card__switch">
          {t('auth.no_account')}{' '}
          <Link to="/register">{t('auth.create_one')}</Link>
        </p>
      </div>
    </div>
  );
}
