'use client';

import React, { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';
import MagicRings from '@/components/ui/MagicRings';

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

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
        .ebs-card-border {
          padding: 1.5px; border-radius: 22px;
          background: linear-gradient(135deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb);
          background-size: 300% 300%;
          animation: ebs-grad 5s ease infinite;
        }
      `}</style>
      <div style={{ height:'100vh', position:'relative', background:'#030712', overflow:'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          <MagicRings />
        </div>
        
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, padding:'16px' }}>
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
                    
                    <h2 style={{ fontSize:15, fontWeight:600, color:'#f8fafc', marginBottom:2 }}>Eliton Benefits</h2>
                    <p style={{ fontSize:11, color:'#94a3b8' }}>Dostęp do strefy weryfikowanej</p>
                  </div>

                  <form action={formAction} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#64748b' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <input
                        type="email"
                        name="email"
                        placeholder="Adres e-mail"
                        className="ebs-input"
                        required
                        disabled={isPending}
                        autoComplete="email"
                      />
                    </div>
                    
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#64748b' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        type="password"
                        name="password"
                        placeholder="Hasło"
                        className="ebs-input"
                        required
                        disabled={isPending}
                        autoComplete="current-password"
                      />
                    </div>

                    {error && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8 }}>
                        <svg style={{ color:'#ef4444', flexShrink:0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span style={{ fontSize:10, color:'#fca5a5' }}>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="ebs-btn"
                      disabled={isPending}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, border:'none', marginTop:4 }}
                    >
                      {isPending ? (
                        <>
                          <div style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff' }} className="ebs-spin"/>
                          <span>Weryfikacja...</span>
                        </>
                      ) : (
                        <>
                          <span>Zaloguj się</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:18, opacity:0.5 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span style={{ fontSize:9, color:'#fff', letterSpacing:'0.05em' }}>End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


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
        .ebs-card-border {
          padding: 1.5px; border-radius: 22px;
          background: linear-gradient(135deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb);
          background-size: 300% 300%;
          animation: ebs-grad 5s ease infinite;
        }
      `}</style>
      <div style={{ height:'100vh', position:'relative', background:'#030712', overflow:'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          <MagicRings />
        </div>
        
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, padding:'16px' }}>
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
                    
                    <h2 style={{ fontSize:15, fontWeight:600, color:'#f8fafc', marginBottom:2 }}>Eliton Benefits</h2>
                    <p style={{ fontSize:11, color:'#94a3b8' }}>Dostęp do strefy weryfikowanej</p>
                  </div>

                  <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#64748b' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <input 
                        type="email" 
                        placeholder="Adres e-mail" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="ebs-input" 
                        required
                        disabled={loading}
                      />
                    </div>
                    
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#64748b' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input 
                        type="password" 
                        placeholder="Hasło" 
                        className="ebs-input"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    {error && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8 }}>
                        <svg style={{ color:'#ef4444', flexShrink:0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span style={{ fontSize:10, color:'#fca5a5' }}>{error}</span>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="ebs-btn" 
                      disabled={loading || !email || !password}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, border:'none', marginTop:4 }}
                    >
                      {loading ? (
                        <>
                          <div style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff' }} className="ebs-spin"/>
                          <span>Weryfikacja...</span>
                        </>
                      ) : (
                        <>
                          <span>Zaloguj się</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:18, opacity:0.5 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span style={{ fontSize:9, color:'#fff', letterSpacing:'0.05em' }}>End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
