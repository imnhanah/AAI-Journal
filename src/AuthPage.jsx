import React, { useCallback, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './landing.css';
import './authPage.css';
import { signUp, signIn, signInWithGoogle, requestPasswordReset } from './auth';
import { FinancialDisclaimerDialog } from './FinancialDisclaimer.jsx';
import LanguageSelector, { useLanguage } from './LanguageSelector';
import { translate } from './localization';
import Turnstile from './Turnstile.jsx';
import { TURNSTILE_CONFIGURATION_ERROR, TURNSTILE_SITE_KEY, TURNSTILE_WIDGET_ENABLED } from './turnstileConfig.js';

const t = translate;

function GoogleMark() {
  return <svg className="auth-google-mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path fill="var(--color-ink-1)" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.875 2.683-6.615Z"/>
    <path fill="var(--color-ink-2)" d="M9 18c2.43 0 4.468-.806 5.957-2.18l-2.909-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"/>
    <path fill="var(--color-ink-3)" d="M3.963 10.708A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.348 2.828.956 4.04l3.007-2.332Z"/>
    <path fill="var(--color-ink-4)" d="M9 3.58c1.322 0 2.508.455 3.442 1.35l2.582-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58Z"/>
  </svg>;
}

const COPY = {
  login: { eyebrow: 'SIGN IN', title: () => <>{t('Welcome back,')} <span>{t('trader.')}</span></>, body: 'Use the email you signed up with.', submit: 'Sign in' },
  signup: { eyebrow: 'FREE TO USE', title: 'Create your account', body: 'Your trading process starts here.', submit: 'Create account' },
  forgot: { eyebrow: 'RESET', title: 'Reset your password', body: 'We’ll email you a link to reset your password.', submit: 'Send reset link' },
};

export default function AuthPage({ onAuthed, initialMode = 'login', onModeChange, onBack, brand = 'AAICOREFX' }) {
  useLanguage(); // Re-render when the visitor switches language.
  const [mode, setMode] = useState(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [financialDisclaimerAcknowledged, setFinancialDisclaimerAcknowledged] = useState(false);
  const [financialDisclaimerOpen, setFinancialDisclaimerOpen] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const siteKey = TURNSTILE_SITE_KEY;
  const turnstileEnabled = TURNSTILE_WIDGET_ENABLED;
  const resetTurnstile = useCallback(() => { setCaptchaToken(''); setTurnstileResetKey(key => key + 1); }, []);
  const switchMode = (next) => { setMode(next); setPassword(''); setShowPassword(false); setError(''); setInfo(''); resetTurnstile(); if (next !== 'forgot') onModeChange?.(next); };
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    if (TURNSTILE_CONFIGURATION_ERROR) { setError('Secure sign-in is not configured for this environment.'); return; }
    if (turnstileEnabled && !captchaToken) { setError('Complete the security verification before continuing.'); return; }
    setError(''); setInfo(''); setBusy(true);
    try {
      const result = mode === 'forgot' ? await requestPasswordReset(email, captchaToken) : mode === 'signup' ? await signUp({ name: [firstName.trim(), lastName.trim()].join(' ').trim(), email, password, financialDisclaimerAcknowledged, captchaToken }) : await signIn({ email, password, captchaToken });
      if (result.error) setError(result.error);
      else if (mode === 'forgot') setInfo('If an account exists for that email, a reset link is on its way. Check your inbox.');
      else if (result.needsEmailConfirmation) setInfo('Check your email to confirm your account, then sign in.');
      else if (result.user) onAuthed(result.user);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setBusy(false); if (turnstileEnabled) resetTurnstile(); }
  };
  const google = async () => { setBusy(true); setError(''); setInfo(''); try { const result = await signInWithGoogle(); if (result.error) { setError(result.error); setBusy(false); } } catch { setError('Unable to connect to Google. Please try again.'); setBusy(false); } };
  const copy = COPY[mode] || COPY.login;
  const home = event => { event.preventDefault(); onBack?.(); };

  return <div className="lp lpa">
    <div className="lp-backdrop" aria-hidden="true"><i className="lp-grid"/><i className="lp-glow"/></div>
    <header className="lpa-top lp-in" style={{ '--i': 0 }}>
      <a className="lp-brand" href="/" onClick={home} aria-label={t('Back to home')}><img src="/brand/logo-dark.png" width="44" height="44" alt=""/><span>{brand}</span></a>
      <div className="lpa-top-actions">
        <button type="button" className="lpa-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/><span>{t('Back to home')}</span></button>
        <LanguageSelector publicSite/>
      </div>
    </header>
    <main className="lpa-main">
      <section className="lp-glass lpa-card lp-in" style={{ '--i': 1 }} aria-labelledby="auth-title">
        <div className="lpa-head">
          <span className="lp-eyebrow lp-eyebrow-mint">{t(copy.eyebrow)}</span>
          <h1 id="auth-title">{typeof copy.title === 'function' ? copy.title() : t(copy.title)}</h1>
          <p>{t(copy.body)}</p>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && <div className="lpa-names"><label>{t('First name')}<input required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John"/></label><label>{t('Last name')}<input required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe"/></label></div>}
          <label>{t('Email')}<input required type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
          {mode !== 'forgot' && <label>{t('Password')}<span className="lpa-password"><input required minLength={mode === 'signup' ? 6 : undefined} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={t(mode === 'signup' ? 'Create a strong password' : 'Enter your password')}/><button type="button" aria-label={t(showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>}
          {mode === 'signup' && <label className="lpa-check"><input required type="checkbox" checked={financialDisclaimerAcknowledged} onChange={event => setFinancialDisclaimerAcknowledged(event.target.checked)}/><span>{t('I acknowledge that AAICOREFX is for educational and personal journaling purposes only, and does not provide financial advice.')} <button type="button" onClick={() => setFinancialDisclaimerOpen(true)}>{t('Read the Financial Disclaimer')}</button></span></label>}
          {mode === 'login' && <button type="button" className="lpa-forgot" onClick={() => switchMode('forgot')}>{t('Forgot password?')}</button>}
          {turnstileEnabled && <Turnstile siteKey={siteKey} resetKey={turnstileResetKey} onSuccess={(token) => { setCaptchaToken(token); setError(''); }} onExpire={() => { setCaptchaToken(''); setError('Security verification expired. Please complete it again.'); }} onError={() => { setCaptchaToken(''); setError('Security verification could not be completed. Please refresh and try again.'); }}/>}
          {error && <div className="lpa-message lpa-error" role="alert">{t(error)}</div>}{info && <div className="lpa-message" role="status">{t(info)}</div>}
          <button className="lp-btn lp-btn-primary lpa-submit" type="submit" disabled={busy || TURNSTILE_CONFIGURATION_ERROR || (mode === 'signup' && !financialDisclaimerAcknowledged) || (turnstileEnabled && !captchaToken)}>{busy ? t('Please wait…') : t(copy.submit)}<ArrowRight size={17} aria-hidden="true"/></button>
        </form>
        {mode !== 'forgot' && <><div className="lpa-divider">{t('OR CONTINUE WITH')}</div><button type="button" className="lp-btn lp-btn-ghost lpa-google" disabled={busy || (mode === 'signup' && !financialDisclaimerAcknowledged)} onClick={google}><GoogleMark/>{t('Continue with Google')}</button></>}
        <p className="lpa-switch">{mode === 'login' ? <>{t('Don’t have an account?')} <button type="button" onClick={() => switchMode('signup')}>{t('Sign up free')}</button></> : <>{mode === 'signup' ? `${t('Already have an account?')} ` : ''}<button type="button" onClick={() => switchMode('login')}>{t(mode === 'signup' ? 'Sign in' : 'Back to sign in')}</button></>}</p>
      </section>
    </main>
    {financialDisclaimerOpen && <FinancialDisclaimerDialog onClose={() => setFinancialDisclaimerOpen(false)}/>}
  </div>;
}
