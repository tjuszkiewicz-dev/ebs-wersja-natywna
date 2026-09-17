'use client';

// Ekran logowania w języku wizualnym strony elitonbenefits.pl (powłoka: AuthShell).
// Logika bez zmian: signInWithPassword po stronie przeglądarki → GET /api/auth/role
// ustala rolę i cel przekierowania. Kroki logowania lądują w konsoli ([EBS-LOGIN]),
// nie na ekranie.

import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import AuthShell, { SITE_URL } from '@/components/auth/AuthShell';
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthEyebrow,
  AuthField,
  AuthTextLink,
} from '@/components/auth/AuthControls';
import { supabaseBrowser } from '@/lib/supabase';

const BOK_EMAIL = 'bok@stratton-prime.pl';

// Liczby ze strony marketingowej (hero elitonbenefits.pl) — jedno źródło prawdy.
const STATS: Array<[string, string]> = [
  ['5 000+', 'pracowników korzysta'],
  ['15+', 'partnerów usługowych'],
  ['100%', 'przejrzystość voucherów'],
];

const log = (msg: string) => {
  const ts = new Date().toISOString().slice(11, 23);
  console.log('[EBS-LOGIN]', `[${ts}] ${msg}`);
};

export default function LoginPage() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [isPending,   setIsPending]   = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // ── Odzyskiwanie hasła ────────────────────────────────────────────────────
  const [showForgot,    setShowForgot]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotMsg,     setForgotMsg]     = useState('');
  const [forgotErr,     setForgotErr]     = useState('');
  const [forgotPending, setForgotPending] = useState(false);

  // Link odzyskiwania trafia na Site URL (katalog główny), a ten przekierowuje
  // na /login — fragment z tokenem przeżywa przekierowanie, więc przerzucamy go
  // na właściwy ekran zamiast pozwolić mu przepaść.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      window.location.replace('/reset-password' + hash);
    }
  }, []);

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');

    const target = forgotEmail.trim().toLowerCase();
    if (!target) { setForgotErr('Podaj adres e-mail.'); return; }

    setForgotPending(true);
    try {
      const { error: resetErr } = await supabaseBrowser.auth.resetPasswordForEmail(target, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (resetErr) {
        setForgotErr(resetErr.message || 'Nie udało się wysłać linku.');
        return;
      }
      // Nie zdradzamy, czy konto istnieje — komunikat zawsze taki sam.
      setForgotMsg('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła. Sprawdź skrzynkę.');
    } catch {
      setForgotErr('Błąd połączenia. Spróbuj ponownie.');
    } finally {
      setForgotPending(false);
    }
  };

  const openForgot = () => {
    setShowForgot(true);
    setForgotEmail(email);
    setForgotErr('');
    setForgotMsg('');
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotErr('');
    setForgotMsg('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsPending(true);

    log('START: handleSubmit wywołany');

    try {
      log(`STEP 1: signInWithPassword → email=${email.trim().toLowerCase()}`);

      const { data: authData, error: authError } = await supabaseBrowser.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        log(`STEP 1 ERROR: ${authError.message} (status=${authError.status})`);
        const msg = authError.message ?? '';
        if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
          setError('Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.');
        } else if (msg.includes('Email not confirmed')) {
          setError('Adres e-mail nie został potwierdzony. Sprawdź skrzynkę pocztową.');
        } else {
          setError(msg || 'Błąd logowania. Spróbuj ponownie.');
        }
        return;
      }

      log(`STEP 1 OK: user.id=${authData?.user?.id ?? 'brak'} | session=${authData?.session ? 'TAK' : 'NIE'}`);

      // Sprawdź czy ciasteczka są w document.cookie
      const cookieNames = document.cookie
        .split(';')
        .map(c => c.trim().split('=')[0])
        .filter(n => n.startsWith('sb-'));
      log(`STEP 2: ciasteczka Supabase w dokumencie: [${cookieNames.join(', ') || 'BRAK'}]`);

      log('STEP 3: GET /api/auth/role ...');
      const res = await fetch('/api/auth/role', { credentials: 'same-origin' });
      const responseText = await res.text();
      log(`STEP 3 odpowiedź: status=${res.status} body=${responseText}`);

      let json: { redirectUrl?: string; error?: string } = {};
      try { json = JSON.parse(responseText); } catch { /* zostaw {} */ }

      if (!res.ok) {
        log(`STEP 3 ERROR: ${json.error ?? 'nieznany błąd'}`);
        setError(json.error ?? 'Błąd logowania. Spróbuj ponownie.');
        return;
      }

      const target = json.redirectUrl ?? '/dashboard/employee';
      log(`STEP 4: redirect → ${target}`);
      setRedirecting(true);
      window.location.href = target;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`WYJĄTEK: ${msg}`);
      console.error('[login] error:', err);
      setError('Błąd sieci. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setIsPending(false);
    }
  };

  const busy = isPending || redirecting;

  const brand = (
    <>
      <div className="animate-rise motion-reduce:animate-none">
        <AuthEyebrow>Twoje zasoby</AuthEyebrow>
      </div>
      <h1
        className="mt-4 text-balance text-[2.25rem] font-bold leading-[1.06] tracking-[-0.04em] animate-rise motion-reduce:animate-none sm:text-[3rem] xl:text-[4rem]"
        style={{ animationDelay: '60ms' }}
      >
        Twoje benefity,{' '}
        <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
          warte więcej niż myślisz.
        </span>
      </h1>
      <p
        className="mt-5 hidden max-w-[460px] text-[15px] leading-relaxed text-white/60 animate-rise motion-reduce:animate-none sm:block sm:text-[17px]"
        style={{ animationDelay: '120ms' }}
      >
        Każdy voucher to 1 zł + 4% ekstra co roku. Zaloguj się, żeby zarządzać
        voucherami i korzystać z usług partnerów.
      </p>
      <dl
        className="mt-10 hidden max-w-[520px] grid-cols-3 gap-6 sm:grid animate-rise motion-reduce:animate-none"
        style={{ animationDelay: '180ms' }}
      >
        {STATS.map(([value, label]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-[13px] leading-snug text-white/60">{label}</dt>
            <dd className="order-first text-[26px] font-bold tracking-[-0.03em] tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  const headerAction = (
    <div className="flex items-center gap-3">
      <span className="hidden text-[14px] text-white/50 sm:inline">Nie masz konta?</span>
      <a
        href={`${SITE_URL}/?page=register`}
        className="inline-flex h-10 items-center whitespace-nowrap rounded-full border border-white/[0.08] bg-[#191c1f] px-4 text-[13px] font-medium text-white transition-colors duration-300 ease-ebs hover:border-white/[0.14] hover:bg-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 sm:h-11 sm:px-5 sm:text-[14px]"
      >
        Dołącz do EBS
      </a>
    </div>
  );

  return (
    <AuthShell aside={brand} headerAction={headerAction}>
      <div className="animate-rise motion-reduce:animate-none" style={{ animationDelay: '140ms' }}>
        <AuthCard>
          {!showForgot ? (
            <div key="login" className="animate-fade-in motion-reduce:animate-none">
              <h2 className="text-[22px] font-bold tracking-[-0.03em]">Zaloguj się</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-white/50">
                Konto zakłada Twój pracodawca albo zespół EBS.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
                <AuthField
                  label="Adres e-mail"
                  type="email"
                  icon={<Mail size={16} />}
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jan.kowalski@firma.pl"
                  autoComplete="email"
                  inputMode="email"
                  disabled={busy}
                />

                <AuthField
                  label="Hasło"
                  revealable
                  icon={<Lock size={16} />}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Twoje hasło"
                  autoComplete="current-password"
                  disabled={busy}
                  labelAction={
                    <AuthTextLink onClick={openForgot} disabled={busy}>
                      Nie pamiętam hasła
                    </AuthTextLink>
                  }
                />

                {error && <AuthAlert tone="error">{error}</AuthAlert>}

                <AuthButton type="submit" loading={busy} className="mt-1">
                  {redirecting ? 'Przekierowanie…' : isPending ? 'Logowanie…' : (
                    <>Zaloguj się <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" /></>
                  )}
                </AuthButton>
              </form>
            </div>
          ) : (
            <div key="forgot" className="animate-fade-in motion-reduce:animate-none">
              <h2 className="text-[22px] font-bold tracking-[-0.03em]">Odzyskaj hasło</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-white/50">
                Wyślemy link do ustawienia nowego hasła. Jest ważny przez godzinę.
              </p>

              <form onSubmit={handleForgot} className="mt-7 flex flex-col gap-5">
                <AuthField
                  label="Adres e-mail"
                  type="email"
                  icon={<Mail size={16} />}
                  value={forgotEmail}
                  onChange={ev => setForgotEmail(ev.target.value)}
                  placeholder="jan.kowalski@firma.pl"
                  autoComplete="email"
                  inputMode="email"
                  disabled={forgotPending}
                  autoFocus
                />

                {forgotErr && <AuthAlert tone="error">{forgotErr}</AuthAlert>}
                {forgotMsg && <AuthAlert tone="success">{forgotMsg}</AuthAlert>}

                <AuthButton type="submit" loading={forgotPending} className="mt-1">
                  {forgotPending ? 'Wysyłanie…' : 'Wyślij link'}
                </AuthButton>
                <AuthButton type="button" variant="ghost" onClick={closeForgot} disabled={forgotPending}>
                  <ArrowLeft size={16} aria-hidden="true" /> Wróć do logowania
                </AuthButton>
              </form>
            </div>
          )}
        </AuthCard>

        <p className="mt-5 text-center text-[13px] text-white/50">
          Problem z logowaniem?{' '}
          <a
            href={`mailto:${BOK_EMAIL}`}
            className="font-medium text-white/80 underline-offset-4 transition-colors duration-150 hover:text-white hover:underline"
          >
            {BOK_EMAIL}
          </a>
        </p>
      </div>
    </AuthShell>
  );
}
