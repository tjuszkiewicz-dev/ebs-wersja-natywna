'use client';

import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import MagicRings from '@/components/ui/MagicRings';
import { supabaseBrowser } from '@/lib/supabase';

export default function LoginPage() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [isPending,   setIsPending]   = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [debugLogs,   setDebugLogs]   = useState<string[]>([]);

  const addLog = (msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    const line = `[${ts}] ${msg}`;
    console.log('[EBS-LOGIN]', line);
    setDebugLogs(prev => [...prev, line]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setDebugLogs([]);
    setIsPending(true);

    addLog('START: handleSubmit wywołany');

    try {
      addLog(`STEP 1: signInWithPassword → email=${email.trim().toLowerCase()}`);

      const { data: authData, error: authError } = await supabaseBrowser.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        addLog(`STEP 1 ERROR: ${authError.message} (status=${authError.status})`);
        const msg = authError.message ?? '';
        if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
          setError('Nieprawidłowy email lub hasło.');
        } else if (msg.includes('Email not confirmed')) {
          setError('Adres email nie został potwierdzony. Sprawdź skrzynkę pocztową.');
        } else {
          setError(msg || 'Błąd logowania. Spróbuj ponownie.');
        }
        return;
      }

      addLog(`STEP 1 OK: user.id=${authData?.user?.id ?? 'brak'} | session=${authData?.session ? 'TAK' : 'NIE'}`);

      // Sprawdź czy ciasteczka są w document.cookie
      const cookieNames = document.cookie
        .split(';')
        .map(c => c.trim().split('=')[0])
        .filter(n => n.startsWith('sb-'));
      addLog(`STEP 2: ciasteczka Supabase w dokumencie: [${cookieNames.join(', ') || 'BRAK'}]`);

      addLog('STEP 3: GET /api/auth/role ...');
      const res = await fetch('/api/auth/role', { credentials: 'same-origin' });
      const responseText = await res.text();
      addLog(`STEP 3 odpowiedź: status=${res.status} body=${responseText}`);

      let json: { redirectUrl?: string; error?: string } = {};
      try { json = JSON.parse(responseText); } catch { /* zostaw {} */ }

      if (!res.ok) {
        addLog(`STEP 3 ERROR: ${json.error ?? 'nieznany błąd'}`);
        setError(json.error ?? 'Błąd logowania. Spróbuj ponownie.');
        return;
      }

      const target = json.redirectUrl ?? '/dashboard/employee';
      addLog(`STEP 4: redirect → ${target}`);
      setRedirecting(true);
      window.location.href = target;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`WYJĄTEK: ${msg}`);
      console.error('[login] error:', err);
      setError('Błąd sieci. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes ebs-grad {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ebs-up {
          from { opacity:0; transform: translateY(24px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes ebs-ping {
          0%,100% { transform:scale(1); opacity:1; }
          60%     { transform:scale(1.8); opacity:0; }
        }
        @keyframes ebs-spin { to { transform: rotate(360deg); } }
        .ebs-up   { animation: ebs-up 0.7s cubic-bezier(.22,1,.36,1) both; }
        .ebs-spin { animation: ebs-spin 0.9s linear infinite; }
        .ebs-input {
          width:100%; padding:10px 12px 10px 36px;
          border-radius:11px; font-size:13px; color:#fff; outline:none;
          background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.08);
          transition: border-color .2s, box-shadow .2s;
        }
        .ebs-input::placeholder { color: rgba(255,255,255,0.2); }
        .ebs-input:focus {
          border-color: rgba(37,99,235,0.7);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
        }
        .ebs-btn {
          background: linear-gradient(135deg,#1d4ed8 0%,#0891b2 50%,#1d4ed8 100%);
          background-size: 200% auto;
          animation: ebs-grad 3s ease infinite;
          box-shadow: 0 6px 24px rgba(37,99,235,.4);
          transition: transform .2s, box-shadow .2s;
        }
        .ebs-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 10px 32px rgba(37,99,235,.55); }
        .ebs-btn:active:not(:disabled){ transform: scale(.98); }
        .ebs-btn:disabled { opacity:.5; cursor:not-allowed; }
        .ebs-card-border {
          padding: 1.5px; border-radius: 22px;
          background: linear-gradient(135deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb);
          background-size: 300% 300%;
          animation: ebs-grad 5s ease infinite;
        }
        .ebs-log {
          font-family: monospace; font-size: 10px; line-height: 1.5;
          color: #86efac; background: rgba(0,0,0,0.7);
          border: 1px solid rgba(74,222,128,0.2);
          border-radius: 10px; padding: 10px 12px;
          max-height: 160px; overflow-y: auto;
          white-space: pre-wrap; word-break: break-all;
        }
      `}</style>

      <div style={{ height:'100vh', position:'relative', background:'#030712', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }}>
          <MagicRings />
        </div>

        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, padding:'16px', overflowY:'auto' }}>

          <div className="ebs-up" style={{ width:'100%', maxWidth:264, animationDelay:'.05s' }}>
            <div className="ebs-card-border">
              <div style={{ borderRadius:21, overflow:'hidden', background:'rgba(5,10,22,0.96)', backdropFilter:'blur(24px)', boxShadow:'0 24px 60px rgba(0,0,0,.7)' }}>
                <div style={{ height:2, background:'linear-gradient(90deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb)', backgroundSize:'300% 100%', animation:'ebs-grad 4s ease infinite' }}/>

                <div style={{ padding:'22px 24px 24px' }}>
                  <div style={{ marginBottom:18 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'ebs-ping 2s ease infinite' }}/>
                      <span style={{ color:'#6ee7b7', fontSize:9, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase' }}>Bezpieczne połączenie</span>
                    </div>
                    <h2 style={{ fontSize:20, fontWeight:900, color:'#fff', marginBottom:4, letterSpacing:'-0.3px' }}>Witaj z powrotem</h2>
                    <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12 }}>Zaloguj się, żeby sprawdzić swoje benefity.</p>
                  </div>

                  <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div>
                      <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:6 }}>Email służbowy</label>
                      <div style={{ position:'relative' }}>
                        <Mail size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)' }}/>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="jan.kowalski@firma.pl"
                          className="ebs-input"
                          disabled={isPending || redirecting}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:6 }}>Hasło</label>
                      <div style={{ position:'relative' }}>
                        <Lock size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)' }}/>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••••"
                          className="ebs-input"
                          disabled={isPending || redirecting}
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    {error && (
                      <div style={{ padding:'9px 12px', borderRadius:10, display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#fca5a5', background:'rgba(244,63,94,0.1)', border:'1.5px solid rgba(244,63,94,0.2)', animation:'ebs-up .3s ease both' }}>
                        <AlertCircle size={13} style={{ flexShrink:0 }}/>{error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isPending || redirecting}
                      className="ebs-btn"
                      style={{ width:'100%', padding:'11px', borderRadius:12, fontSize:13, fontWeight:900, color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:2 }}
                    >
                      {(isPending || redirecting) ? (
                        <>
                          <span className="ebs-spin" style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block' }}/>
                          {redirecting ? 'Przekierowanie...' : 'Autoryzacja...'}
                        </>
                      ) : (
                        <> Zaloguj się <ArrowRight size={14} strokeWidth={3}/> </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* ── Panel diagnostyczny — widoczny po próbie logowania ── */}
          {debugLogs.length > 0 && (
            <div className="ebs-up" style={{ width:'100%', maxWidth:420, marginTop:16, animationDelay:'0s' }}>
              <div className="ebs-log">
                <div style={{ color:'rgba(134,239,172,0.5)', marginBottom:4, fontSize:9, letterSpacing:'0.15em', textTransform:'uppercase' }}>
                  LOG DIAGNOSTYCZNY
                </div>
                {debugLogs.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          )}

          <div className="ebs-up" style={{ animationDelay:'.15s', marginTop:16, textAlign:'center', maxWidth:320 }}>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, lineHeight:1.7, fontWeight:400 }}>
              Twoje <strong style={{ color:'rgba(255,255,255,0.75)', fontWeight:700 }}>benefity pracownicze</strong> w jednym miejscu. Vouchery, zdrowie, rozrywka i tysiące usług.
            </p>
            <div style={{ width:40, height:1, background:'linear-gradient(90deg,transparent,rgba(37,99,235,.6),transparent)', margin:'14px auto' }}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['500+','Benefitów'],['98%','Satysfakcji'],['10k+','Użytkowników']].map(([v,l],i)=>(
                <div key={i} style={{ textAlign:'center', padding:'10px 6px', borderRadius:14, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.1 }}>{v}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:600, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <p style={{ marginTop:16, color:'rgba(255,255,255,0.12)', fontSize:10 }}>
            &copy; {new Date().getFullYear()} Stratton Prime S.A. Wszystkie prawa zastrzeżone.
          </p>
        </div>
      </div>
    </>
  );
}
