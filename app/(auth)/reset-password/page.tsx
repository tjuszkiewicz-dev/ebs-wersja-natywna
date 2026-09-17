'use client';

// Ekran ustawiania nowego hasła po kliknięciu linku z maila odzyskiwania.
// Supabase (createBrowserClient, detectSessionInUrl=true) sam konsumuje token
// z fragmentu URL i tworzy sesję odzyskiwania — my czekamy na nią i pozwalamy
// ustawić nowe hasło przez updateUser(). Warstwa wizualna: ta sama powłoka co login.

import { AlertCircle, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import AuthShell from '@/components/auth/AuthShell';
import { AuthAlert, AuthButton, AuthCard, AuthEyebrow, AuthField } from '@/components/auth/AuthControls';
import { supabaseBrowser } from '@/lib/supabase';

const MIN_LEN = 8;

const LINK_BUTTON =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#191c1f] transition-[transform,background-color] duration-150 ease-ebs hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20';

export default function ResetPasswordPage() {
  const [ready,     setReady]     = useState(false);
  const [linkValid, setLinkValid] = useState(false);
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');
  const [isPending, setIsPending] = useState(false);
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Sesja odzyskiwania może powstać zanim zdążymy podpiąć nasłuch — stąd dwie ścieżki.
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setLinkValid(true);
        setReady(true);
      }
    });

    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setLinkValid(true);
        setReady(true);
        return;
      }
      // Token z fragmentu bywa przetwarzany asynchronicznie — dajemy mu chwilę,
      // zanim uznamy link za nieważny (inaczej mignąłby błędny komunikat).
      setTimeout(async () => {
        if (cancelled) return;
        const { data: retry } = await supabaseBrowser.auth.getSession();
        if (cancelled) return;
        setLinkValid(!!retry.session);
        setReady(true);
      }, 1500);
    })();

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LEN) {
      setError('Hasło musi mieć co najmniej ' + MIN_LEN + ' znaków.');
      return;
    }
    if (password !== confirm) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setIsPending(true);
    try {
      const { error: updErr } = await supabaseBrowser.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message || 'Nie udało się zmienić hasła. Spróbuj ponownie.');
        return;
      }
      // Wylogowujemy sesję odzyskiwania — użytkownik loguje się nowym hasłem.
      await supabaseBrowser.auth.signOut();
      setDone(true);
    } catch {
      setError('Błąd połączenia. Spróbuj ponownie.');
    } finally {
      setIsPending(false);
    }
  };

  let content: React.ReactNode;

  if (!ready) {
    content = (
      <div className="py-6 text-center" role="status" aria-live="polite">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 block h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"
        />
        <p className="text-[14px] text-white/50">Sprawdzamy link…</p>
      </div>
    );
  } else if (done) {
    content = (
      <div className="text-center">
        <CheckCircle2 size={36} className="mx-auto mb-4 text-[#4ade80]" aria-hidden="true" />
        <h1 className="text-[22px] font-bold tracking-[-0.03em]">Hasło zmienione</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/50">
          Możesz teraz zalogować się nowym hasłem.
        </p>
        <Link href="/login" className={`${LINK_BUTTON} mt-7`}>
          Przejdź do logowania <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    );
  } else if (!linkValid) {
    content = (
      <div className="text-center">
        <AlertCircle size={36} className="mx-auto mb-4 text-red-300" aria-hidden="true" />
        <h1 className="text-[22px] font-bold tracking-[-0.03em]">Link wygasł lub jest nieprawidłowy</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/50">
          Linki do zmiany hasła są ważne przez godzinę i można ich użyć tylko raz.
          Poproś o nowy na ekranie logowania.
        </p>
        <Link href="/login" className={`${LINK_BUTTON} mt-7`}>
          Wróć do logowania <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    );
  } else {
    content = (
      <>
        <h1 className="text-[22px] font-bold tracking-[-0.03em]">Ustaw nowe hasło</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/50">
          Minimum {MIN_LEN} znaków. Po zapisaniu zalogujesz się nowym hasłem.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
          <AuthField
            label="Nowe hasło"
            revealable
            icon={<Lock size={16} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Co najmniej ${MIN_LEN} znaków`}
            autoComplete="new-password"
            minLength={MIN_LEN}
            required
            disabled={isPending}
          />

          <AuthField
            label="Powtórz nowe hasło"
            revealable
            icon={<Lock size={16} />}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="To samo hasło jeszcze raz"
            autoComplete="new-password"
            required
            disabled={isPending}
          />

          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <AuthButton type="submit" loading={isPending} className="mt-1">
            {isPending ? 'Zapisywanie…' : (
              <>Zapisz nowe hasło <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" /></>
            )}
          </AuthButton>
        </form>
      </>
    );
  }

  return (
    <AuthShell>
      <div className="animate-rise motion-reduce:animate-none">
        <div className="mb-5 text-center">
          <AuthEyebrow pill>Odzyskiwanie hasła</AuthEyebrow>
        </div>
        <AuthCard>{content}</AuthCard>
      </div>
    </AuthShell>
  );
}
