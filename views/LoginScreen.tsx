
import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Smartphone } from 'lucide-react';
import { User, Role } from '../types';
import { TWO_FA_DEMO_CODE } from '../utils/config';



interface LoginScreenProps {
  users: User[];
  onLogin: (userId: string) => void;
  onLoginWithUser: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin, onLoginWithUser }) => {
  const [step, setStep] = useState<'CREDENTIALS' | '2FA'>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const demoLogin = (role: Role) => {
    const demoUser = users.find(u => u.role === role && u.status === 'ACTIVE');
    if (demoUser) {
      setEmail(demoUser.email);
      setPassword('password123');
      if (demoUser.isTwoFactorEnabled) {
        setUserId(demoUser.id);
        setStep('2FA');
      } else {
        onLogin(demoUser.id);
      }
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 1. Sprawdź lokalnych (wewnętrznych) użytkowników — admin, sprzedaż
    const localUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (localUser) {
        if (localUser.status === 'INACTIVE') {
            setError('To konto zostało dezaktywowane. Skontaktuj się z administratorem.');
            setIsLoading(false);
            return;
        }
        if (localUser.isTwoFactorEnabled) {
            setUserId(localUser.id);
            setStep('2FA');
            setIsLoading(false);
        } else {
            onLogin(localUser.id);
        }
        return;
    }

    // 2. Próba logowania przez Supabase — konta HR pracodawców i innych użytkowników bazy
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });

        if (res.ok) {
            const userData: User = await res.json();
            onLoginWithUser(userData);
        } else {
            const err = await res.json().catch(() => ({})) as { error?: string };
            setError(err.error ?? 'Nieprawidłowy email lub hasło.');
            setIsLoading(false);
        }
    } catch {
        setError('Błąd połączenia z serwerem. Spróbuj ponownie.');
        setIsLoading(false);
    }
  };

  const handle2FASubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      setTimeout(() => {
          if (twoFactorCode === TWO_FA_DEMO_CODE) {
              if (userId) onLogin(userId);
          } else {
              setError('Błędny kod weryfikacyjny.');
              setIsLoading(false);
          }
      }, 600);
  };




  return (
    <>
      <style>{`
        @keyframes ebs-orb {
          0%,100% { transform: translate(0,0) scale(1); opacity:.35; }
          25%     { transform: translate(40px,-30px) scale(1.12); opacity:.55; }
          50%     { transform: translate(-20px,50px) scale(.9); opacity:.25; }
          75%     { transform: translate(30px,20px) scale(1.06); opacity:.45; }
        }
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
        @keyframes ebs-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .ebs-orb  { animation: ebs-orb 13s ease-in-out infinite; }
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
        .ebs-demo-btn {
          background: rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.07);
          border-radius:10px; padding:8px 6px; font-size:11px; font-weight:700;
          color:rgba(255,255,255,0.35); transition: all .2s; width:100%;
        }
        .ebs-demo-btn:hover { background:rgba(37,99,235,0.12); border-color:rgba(37,99,235,.3); color:#93c5fd; transform:scale(1.02); }
        .ebs-2fa-input {
          width:180px; text-align:center; font-size:30px; font-weight:900;
          letter-spacing:.35em; padding:12px 10px; border-radius:13px;
          background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.1);
          color:#fff; outline:none; caret-color:#2563eb; transition:border-color .2s,box-shadow .2s;
        }
        .ebs-2fa-input:focus { border-color:rgba(37,99,235,.7); box-shadow:0 0 0 3px rgba(37,99,235,.15); }
        .ebs-card-border {
          padding: 1.5px; border-radius: 22px;
          background: linear-gradient(135deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb);
          background-size: 300% 300%;
          animation: ebs-grad 5s ease infinite;
        }
      `}</style>

      <div style={{ height:'100vh', position:'relative', background:'#030712', overflow:'hidden' }}>

        {/* ── Full-screen background ── */}
        <div style={{ position:'absolute', inset:0 }}>
          {/* BG mesh */}
          <div style={{
            position:'absolute', inset:0,
            background:'radial-gradient(ellipse at 15% 15%, rgba(37,99,235,.18) 0%,transparent 55%), radial-gradient(ellipse at 85% 80%, rgba(16,185,129,.15) 0%,transparent 55%), radial-gradient(ellipse at 55% 45%, rgba(8,145,178,.1) 0%,transparent 60%), #030712'
          }}/>
          
          <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none' }}>
            
          </div>
          {/* Orbs — corners */}
          <div className="ebs-orb" style={{ position:'absolute', width:420, height:420, borderRadius:'50%', filter:'blur(80px)', top:'-8%', left:'-8%', background:'radial-gradient(circle,rgba(37,99,235,.42) 0%,transparent 70%)', pointerEvents:'none' }}/>
          <div className="ebs-orb" style={{ position:'absolute', width:360, height:360, borderRadius:'50%', filter:'blur(70px)', bottom:'5%', right:'-8%', background:'radial-gradient(circle,rgba(16,185,129,.38) 0%,transparent 70%)', pointerEvents:'none', animationDelay:'5s' }}/>
          <div className="ebs-orb" style={{ position:'absolute', width:280, height:280, borderRadius:'50%', filter:'blur(60px)', top:'42%', right:'18%', background:'radial-gradient(circle,rgba(8,145,178,.3) 0%,transparent 70%)', pointerEvents:'none', animationDelay:'9s' }}/>

        </div>

        {/* ── Centered layout ── */}
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, padding:'16px' }}>

          {/* Login card — 40% smaller (maxWidth 264px) */}
          <div className="ebs-up" style={{ width:'100%', maxWidth:264, animationDelay:'.05s' }}>
            <div className="ebs-card-border">
              <div style={{ borderRadius:21, overflow:'hidden', background:'rgba(5,10,22,0.96)', backdropFilter:'blur(24px)', boxShadow:'0 24px 60px rgba(0,0,0,.7)' }}>

                {/* Top shimmer line */}
                <div style={{ height:2, background:'linear-gradient(90deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb)', backgroundSize:'300% 100%', animation:'ebs-grad 4s ease infinite' }}/>

                <div style={{ padding:'22px 24px 24px' }}>
                  {step === 'CREDENTIALS' && (
                    <>
                      {/* Header */}
                      <div style={{ marginBottom:18 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'ebs-ping 2s ease infinite' }}/>
                          <span style={{ color:'#6ee7b7', fontSize:9, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase' }}>Bezpieczne połączenie</span>
                        </div>
                        <h2 style={{ fontSize:20, fontWeight:900, color:'#fff', marginBottom:4, letterSpacing:'-0.3px' }}>Witaj z powrotem</h2>
                        <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12 }}>Zaloguj się, żeby sprawdzić swoje benefity.</p>
                      </div>

                      <form onSubmit={handleCredentialsSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <div>
                          <label style={{ display:'block', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:6 }}>Email służbowy</label>
                          <div style={{ position:'relative' }}>
                            <Mail size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)' }}/>
                            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="jan.kowalski@firma.pl" className="ebs-input"/>
                          </div>
                        </div>

                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <label style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.15em', textTransform:'uppercase' }}>Hasło</label>
                            <a href="#" style={{ fontSize:11, color:'#60a5fa', textDecoration:'none', fontWeight:600 }}>Zapomniałeś?</a>
                          </div>
                          <div style={{ position:'relative' }}>
                            <Lock size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)' }}/>
                            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••" className="ebs-input"/>
                          </div>
                        </div>

                        {error && (
                          <div className="ebs-up" style={{ padding:'9px 12px', borderRadius:10, display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#fca5a5', background:'rgba(244,63,94,0.1)', border:'1.5px solid rgba(244,63,94,0.2)' }}>
                            <AlertCircle size={13} style={{ flexShrink:0 }}/>{error}
                          </div>
                        )}

                        <button type="submit" disabled={isLoading} className="ebs-btn" style={{ width:'100%', padding:'11px', borderRadius:12, fontSize:13, fontWeight:900, color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:2 }}>
                          {isLoading ? (
                            <><span className="ebs-spin" style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block' }}/> Autoryzacja...</>
                          ) : (
                            <> Zaloguj się <ArrowRight size={14} strokeWidth={3}/> </>
                          )}
                        </button>
                      </form>

                      <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ textAlign:'center', fontSize:9, color:'rgba(255,255,255,0.2)', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:10 }}>Szybkie logowanie</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                          <button onClick={()=>demoLogin(Role.SUPERADMIN)} className="ebs-demo-btn">Admin (2FA)</button>
                          <button onClick={()=>demoLogin(Role.EMPLOYEE)} className="ebs-demo-btn">Pracownik</button>
                        </div>
                      </div>
                    </>
                  )}

                  {step === '2FA' && (
                    <div className="ebs-up" style={{ animationDelay:'0s', textAlign:'center' }}>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                        <div style={{ width:60, height:60, borderRadius:18, background:'linear-gradient(135deg,rgba(37,99,235,.2),rgba(8,145,178,.2))', border:'1.5px solid rgba(37,99,235,.3)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                          <Smartphone size={28} color="#60a5fa"/>
                          <div style={{ position:'absolute', top:-5, right:-5, width:18, height:18, background:'linear-gradient(135deg,#10b981,#0891b2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ color:'#fff', fontSize:7, fontWeight:900 }}>2FA</span>
                          </div>
                        </div>
                      </div>
                      <h2 style={{ fontSize:19, fontWeight:900, color:'#fff', marginBottom:6 }}>Weryfikacja 2FA</h2>
                      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginBottom:20 }}>Wpisz 6-cyfrowy kod z aplikacji Authenticator.</p>

                      <form onSubmit={handle2FASubmit} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
                        <input type="text" maxLength={6} value={twoFactorCode} onChange={e=>setTwoFactorCode(e.target.value.replace(/\D/g,''))} placeholder="000000" autoFocus className="ebs-2fa-input"/>
                        {error && (
                          <div style={{ width:'100%', padding:'9px 12px', borderRadius:10, fontSize:11, color:'#fca5a5', background:'rgba(244,63,94,0.1)', border:'1.5px solid rgba(244,63,94,0.2)' }}>{error}</div>
                        )}
                        <button type="submit" disabled={twoFactorCode.length!==6||isLoading} className="ebs-btn" style={{ width:'100%', padding:'11px', borderRadius:12, fontSize:13, fontWeight:900, color:'#fff', border:'none', cursor:'pointer' }}>
                          {isLoading?'Weryfikacja...':'Potwierdź tożsamość'}
                        </button>
                      </form>

                      <div style={{ marginTop:12, display:'inline-block', padding:'6px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', fontSize:11, color:'rgba(255,255,255,0.3)' }}>
                        Demo Code: <strong style={{ color:'rgba(255,255,255,0.7)' }}>{TWO_FA_DEMO_CODE}</strong>
                      </div>
                      <button onClick={()=>{setStep('CREDENTIALS');setTwoFactorCode('');setError('');}} style={{ display:'block', margin:'12px auto 0', fontSize:12, color:'#60a5fa', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>
                        ← Wróć do logowania
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description + stats below the card */}
          <div className="ebs-up" style={{ animationDelay:'.15s', marginTop:24, textAlign:'center', maxWidth:320 }}>
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
};
