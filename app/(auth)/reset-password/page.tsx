'use client';

// Ekran ustawiania nowego hasła po kliknięciu linku z maila odzyskiwania.
// Supabase (createBrowserClient, detectSessionInUrl=true) sam konsumuje token
// z fragmentu URL i tworzy sesję odzyskiwania — my czekamy na nią i pozwalamy
// ustawić nowe hasło przez updateUser().

import React, { useEffect, useState } from 'react';
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase';

const MIN_LEN = 8;

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

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'#050810' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'0.02em' }}>EBS</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Eliton Benefits System</div>
        </div>
        <div style={{ borderRadius:18, padding:24, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (!ready) {
    return shell(
      <div style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:13, padding:'20px 0' }}>
        Weryfikacja linku…
      </div>
    );
  }

  if (done) {
    return shell(
      <div style={{ textAlign:'center' }}>
        <CheckCircle2 size={34} color="#4ade80" style={{ marginBottom:10 }} />
        <h1 style={{ color:'#fff', fontSize:17, fontWeight:800, marginBottom:6 }}>Hasło zmienione</h1>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, lineHeight:1.6, marginBottom:18 }}>
          Możesz teraz zalogować się nowym hasłem.
        </p>
        <a
          href="/login"
          className="ebs-btn"
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:11, borderRadius:12, fontSize:13, fontWeight:900, color:'#fff', textDecoration:'none' }}
        >
          Przejdź do logowania <ArrowRight size={14} strokeWidth={3} />
        </a>
      </div>
    );
  }

  if (!linkValid) {
    return shell(
      <div style={{ textAlign:'center' }}>
        <AlertCircle size={34} color="#f87171" style={{ marginBottom:10 }} />
        <h1 style={{ color:'#fff', fontSize:17, fontWeight:800, marginBottom:6 }}>Link wygasł lub jest nieprawidłowy</h1>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, lineHeight:1.6, marginBottom:18 }}>
          Linki do zmiany hasła są ważne przez godzinę i można ich użyć tylko raz.
          Poproś o nowy na ekranie logowania.
        </p>
        <a href="/login" style={{ color:'#60a5fa', fontSize:13, fontWeight:700, textDecoration:'none' }}>
          Wróć do logowania
        </a>
      </div>
    );
  }

  return shell(
    <>
      <h1 style={{ color:'#fff', fontSize:17, fontWeight:800, marginBottom:4 }}>Ustaw nowe hasło</h1>
      <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, marginBottom:18 }}>
        Minimum {MIN_LEN} znaków.
      </p>

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <Lock size={14} color="rgba(255,255,255,0.35)" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nowe hasło"
            autoComplete="new-password"
            required
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:13 }}
          />
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <Lock size={14} color="rgba(255,255,255,0.35)" />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Powtórz nowe hasło"
            autoComplete="new-password"
            required
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:13 }}
          />
        </label>

        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', borderRadius:10, background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', color:'#fca5a5', fontSize:12 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="ebs-btn"
          style={{ width:'100%', padding:11, borderRadius:12, fontSize:13, fontWeight:900, color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
        >
          {isPending ? 'Zapisywanie…' : <>Zapisz nowe hasło <ArrowRight size={14} strokeWidth={3} /></>}
        </button>
      </form>
    </>
  );
}
