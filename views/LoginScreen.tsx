
import React, { useState, useRef, useEffect } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Smartphone } from 'lucide-react';
import { User, Role } from '../types';
import { TWO_FA_DEMO_CODE } from '../utils/config';

interface LoginScreenProps {
  users: User[];
  onLogin: (userId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin }) => {
  const [step, setStep] = useState<'CREDENTIALS' | '2FA'>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulation delay
    setTimeout(() => {
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (user) {
            if (user.status === 'INACTIVE') {
                setError('To konto zostało dezaktywowane. Skontaktuj się z HR.');
                setIsLoading(false);
                return;
            }

            // Check for 2FA
            if (user.isTwoFactorEnabled) {
                setUserId(user.id);
                setStep('2FA');
                setIsLoading(false);
            } else {
                onLogin(user.id);
            }
        } else {
            setError('Nieprawidłowy email lub hasło.');
            setIsLoading(false);
        }
    }, 800);
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

  const demoLogin = (role: Role) => {
      const demoUser = users.find(u => u.role === role && u.status === 'ACTIVE');
      if (demoUser) {
          setEmail(demoUser.email);
          setPassword('password123');
      }
  };

  const computeCardSize = () => Math.max(100, Math.min(200, Math.round(window.innerWidth * 0.09)));
  const [cardSize, setCardSize] = useState(172);
  const LOGO_CARDS = [
    { file:'/Allianz.png',       name:'Allianz'      },
    { file:'/luxmed.png',        name:'LuxMed'       },
    { file:'/orange.png',        name:'Orange'       },
    { file:'/generali.png',      name:'Generali'     },
    { file:'/PZU.png',           name:'PZU'          },
    { file:'/warta.png',         name:'Warta'        },
    { file:'/hestia.png',        name:'Hestia'       },
    { file:'/Signal.png',        name:'Signal'       },
    { file:'/unum.png',          name:'Unum'         },
    { file:'/vienna%20life.png', name:'Vienna Life'  },
  ];
  const TICKER = ['🎁 Vouchery','💪 Siłownia','🎬 Kino','✈️ Podróże','🛒 Zakupy','☕ Kawiarnie','🏥 Zdrowie','🎵 Muzyka','🎮 Gaming','🌿 Wellness','💆 Masaże','🚴 Rower'];

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const physRef = useRef<{
    balls: { x:number; y:number; vx:number; vy:number; rot:number; rotV:number }[];
    W:number; H:number;
  } | null>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef<{ x:number; y:number; vx:number; vy:number; px:number; py:number; t:number }>(
    { x:-9999, y:-9999, vx:0, vy:0, px:-9999, py:-9999, t:0 }
  );
  const waterCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waterStateRef = useRef<{
    cur: Float32Array; prev: Float32Array; W: number; H: number; SCALE: number;
  } | null>(null);

  useEffect(() => {
    const onResize = () => setCardSize(computeCardSize());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      const now = performance.now();
      const m = mouseRef.current;
      const dt = Math.max(1, now - m.t);
      m.vx = (e.clientX - m.px) / dt * 16;
      m.vy = (e.clientY - m.py) / dt * 16;
      m.px = m.x;
      m.py = m.y;
      m.x = e.clientX;
      m.y = e.clientY;
      m.t = now;
    };
    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, []);

  useEffect(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (W === 0 || H === 0) return;
    const HW = cardSize / 2, HH = cardSize / 2;
    const CARD_R = Math.round(cardSize * 0.61);

    const balls = Array.from({ length: LOGO_CARDS.length }, (_, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const xSlot = (W - cardSize - 40) / 1;
      const ySlot = (H - cardSize - 60) / 4;
      const speed = 0.55 + Math.random() * 0.85;
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.max(HW, Math.min(W - HW, HW + 20 + col * xSlot + (Math.random() - 0.5) * 60)),
        y: Math.max(HH, Math.min(H - HH, HH + 30 + row * ySlot + (Math.random() - 0.5) * 60)),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: (Math.random() - 0.5) * 10,
        rotV: (Math.random() - 0.5) * 0.12,
      };
    });

    physRef.current = { balls, W, H };

    balls.forEach((b, i) => {
      const el = cardRefs.current[i];
      if (el) {
        el.style.transform = `translate(${b.x - HW}px,${b.y - HH}px) rotate(${b.rot}deg)`;
        el.style.opacity = '1';
      }
    });

    function playSlotTick() {
      try {
        if (!audioCtxRef.current)
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ac = audioCtxRef.current;
        if (ac.state === 'suspended') { ac.resume(); return; }
        const now = ac.currentTime;

        // 1. Mechanical reel "tick" — short filtered noise pop
        const bufLen = Math.ceil(ac.sampleRate * 0.018);
        const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
        const nd = buf.getChannelData(0);
        for (let k = 0; k < bufLen; k++) nd[k] = Math.random() * 2 - 1;
        const filt = ac.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 2200;
        filt.Q.value = 2.2;
        const gPop = ac.createGain();
        gPop.gain.setValueAtTime(0.28, now);
        gPop.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(filt); filt.connect(gPop); gPop.connect(ac.destination);
        src.start(now); src.stop(now + 0.02);

        // 2. Coin-bell ding — two harmonics, bright and satisfying
        const freqs = [1480, 2220];
        freqs.forEach((freq, idx) => {
          const o = ac.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + idx * 0.012);
          o.frequency.exponentialRampToValueAtTime(freq * 0.72, now + idx * 0.012 + 0.18);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.18, now + idx * 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.012 + 0.22);
          o.connect(g); g.connect(ac.destination);
          o.start(now + idx * 0.012); o.stop(now + idx * 0.012 + 0.24);
        });

        // 3. Low resonant thump — gives weight like a real machine
        const thump = ac.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(120, now);
        thump.frequency.exponentialRampToValueAtTime(48, now + 0.09);
        const gThump = ac.createGain();
        gThump.gain.setValueAtTime(0.22, now);
        gThump.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        thump.connect(gThump); gThump.connect(ac.destination);
        thump.start(now); thump.stop(now + 0.11);
      } catch (_) {}
    }

    // Slot machine tick — once every 2 seconds, not spam
    const slotTimer = 0; // sound disabled

    let soundsThisFrame = 0;

    function step() {
      soundsThisFrame = 0;
      const state = physRef.current;
      if (!state) return;
      const { balls, W, H } = state;

      for (const b of balls) {
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.rotV;
        // per-frame friction — reduced for livelier sliding
        b.vx *= 0.988;
        b.vy *= 0.988;
        b.rotV *= 0.972;
        // wall bounce — use CARD_R as uniform margin so rotated cards
        // always bounce at the same visual distance from every edge
        const R = CARD_R;
        if (b.x < R)       { b.x = R;       b.vx =  Math.abs(b.vx) * 0.221; b.rotV *= 0.35; }
        if (b.x > W - R)   { b.x = W - R;   b.vx = -Math.abs(b.vx) * 0.221; b.rotV *= 0.35; }
        if (b.y < R)       { b.y = R;        b.vy =  Math.abs(b.vy) * 0.221; b.rotV *= 0.35; }
        if (b.y > H - R)   { b.y = H - R;   b.vy = -Math.abs(b.vy) * 0.221; b.rotV *= 0.35; }
      }

      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CARD_R * 2 && dist > 0.01) {
            const nx = dx / dist, ny = dy / dist;
            const ov = (CARD_R * 2 - dist) * 0.5;
            a.x -= nx * ov; a.y -= ny * ov;
            b.x += nx * ov; b.y += ny * ov;
            const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              // restitution 0.55 — elastic-like, strong bounce response
              const restitution = 0.55;
              a.vx -= dot * nx * restitution; a.vy -= dot * ny * restitution;
              b.vx += dot * nx * restitution; b.vy += dot * ny * restitution;
              // minimal post-collision damping — preserve energy
              a.vx *= 0.88; a.vy *= 0.88;
              b.vx *= 0.88; b.vy *= 0.88;
              a.rotV *= 0.70;
              b.rotV *= 0.70;
            }
          }
        }
      }

      // Mouse-ball collisions
      const mouse = mouseRef.current;
      const MOUSE_R = 28;
      for (const b of balls) {
        const dx = b.x - mouse.x;
        const dy = b.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = CARD_R + MOUSE_R;
        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist, ny = dy / dist;
          const ov = (minDist - dist) * 0.5;
          b.x += nx * ov;
          b.y += ny * ov;
          const mvx = Math.max(-6, Math.min(6, mouse.vx));
          const mvy = Math.max(-6, Math.min(6, mouse.vy));
          const speed = Math.sqrt(mvx * mvx + mvy * mvy);
          const relVn = (b.vx - mvx) * nx + (b.vy - mvy) * ny;
          if (relVn < 0) {
            const impulse = -0.30 * relVn;
            b.vx += impulse * nx;
            b.vy += impulse * ny;

            const cx = -nx * CARD_R;
            const cy = -ny * CARD_R;
            const mvt_x = mvx - (mvx * nx + mvy * ny) * nx;
            const mvt_y = mvy - (mvx * nx + mvy * ny) * ny;
            const torque = (cx * mvt_y - cy * mvt_x) / (CARD_R * CARD_R);
            const edgeFactor = Math.min(1, (minDist - dist) < CARD_R * 0.5 ? 1.0 : 0.4);
            b.rotV += torque * speed * 0.147 * edgeFactor;
            b.rotV = Math.max(-2.5, Math.min(2.5, b.rotV));
          }
        }
      }

      balls.forEach((b, i) => {
        const el = cardRefs.current[i];
        if (el) el.style.transform = `translate(${b.x - HW}px,${b.y - HH}px) rotate(${b.rot}deg)`;
      });

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(rafRef.current); clearInterval(slotTimer); };
  }, [cardSize]);

  // ── Water ripple simulation ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = waterCanvasRef.current;
    if (!canvas) return;

    // Output canvas at FULL native screen resolution — no CSS upscaling artefacts
    const OW = window.innerWidth;
    const OH = window.innerHeight;
    canvas.width  = OW;
    canvas.height = OH;

    // Simulation runs at 1/2 resolution — 4× more grid points than before
    const SCALE = 2;
    const W = Math.ceil(OW / SCALE);
    const H = Math.ceil(OH / SCALE);

    // Scratch canvas for high-quality bilinear upscaling via drawImage
    const scratch = document.createElement('canvas');
    scratch.width  = W;
    scratch.height = H;
    const sCtx = scratch.getContext('2d')!;

    // Pre-computed environment map — richer deep-ocean palette visible through refraction
    const env = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i4 = (y * W + x) * 4;
        const t  = y / H;
        const n1 = Math.sin(x * 0.08 + y * 0.05) * Math.cos(x * 0.04 - y * 0.07);
        const n2 = Math.cos(x * 0.12 - y * 0.09) * Math.sin(x * 0.05 + y * 0.11);
        const n3 = Math.sin(x * 0.031 - y * 0.022) * 0.5 + 0.5;
        const n  = (n1 + n2) * 0.25 + 0.5;
        // Bright enough to be visible via screen blend when refracted
        env[i4]   = ( 10 + n *  22 + n3 *  8 + t *  14) | 0;
        env[i4+1] = ( 30 + n *  38 + n3 * 14 + t *  22) | 0;
        env[i4+2] = ( 95 + n *  62 + n3 * 28 + t *  45) | 0;
        env[i4+3] = 255;
      }
    }

    const cur  = new Float32Array(W * H);
    const prev = new Float32Array(W * H);
    waterStateRef.current = { cur, prev, W, H, SCALE };

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';

    const imgData = sCtx.createImageData(W, H);
    const px = imgData.data;
    let raf: number;

    function tick() {
      const st = waterStateRef.current;
      if (!st) return;
      const { W, H } = st;
      let { cur, prev } = st;

      // Two-buffer wave propagation — slightly longer damping for smoother surface
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          prev[i] = (cur[i-1] + cur[i+1] + cur[i-W] + cur[i+W]) * 0.5 - prev[i];
          prev[i] *= 0.982;
        }
      }
      const tmp = st.cur; st.cur = st.prev; st.prev = tmp;
      cur = st.cur;

      // ── Full water surface render: refraction + caustics + specular ──────
      // screen blend = additive light; black pixels = transparent, no effect.
      //   1. Refraction — sample env at gradient-displaced coords → water tint
      //   2. Caustics   — positive Laplacian → focused golden-white light bands
      //   3. Specular   — large gradient magnitude → Fresnel-like bright sparkles
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i  = y * W + x;
          const pi = i << 2;

          // Surface gradient — proportional to refraction normal
          const gradX = (cur[i + 1] - cur[i - 1]) * 0.5;
          const gradY = (cur[i + W] - cur[i - W]) * 0.5;
          const gradMag = Math.sqrt(gradX * gradX + gradY * gradY);
          const waveH = Math.abs(cur[i]);

          // Skip truly calm pixels to preserve dark background
          if (waveH < 0.15 && gradMag < 0.12) {
            px[pi] = 0; px[pi+1] = 0; px[pi+2] = 0; px[pi+3] = 0;
            continue;
          }

          // ── 1. Refraction: sample env at normal-displaced position ──
          const REFR = 4.2;
          const sx = Math.max(0, Math.min(W - 1, (x + gradX * REFR + 0.5) | 0));
          const sy = Math.max(0, Math.min(H - 1, (y + gradY * REFR + 0.5) | 0));
          const si = (sy * W + sx) << 2;

          const refA = Math.min(0.92, waveH * 0.026 + gradMag * 0.13);
          let r = env[si]     * refA;
          let g = env[si + 1] * refA;
          let b = env[si + 2] * refA;

          // screen blend reads color value; alpha=255 keeps compositing clean
          px[pi]   = Math.min(255, r) | 0;
          px[pi+1] = Math.min(255, g) | 0;
          px[pi+2] = Math.min(255, b) | 0;
          px[pi+3] = 255;
        }
      }

      // Upload sim result to scratch, then scale up with high-quality bilinear to full-res canvas
      sCtx.putImageData(imgData, 0, 0);
      ctx.clearRect(0, 0, OW, OH);
      ctx.drawImage(scratch, 0, 0, OW, OH);

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    // Sparse rain — recursive setTimeout so every interval is truly random
    let dripActive = true;
    const scheduleDrip = () => {
      if (!dripActive) return;
      const st = waterStateRef.current;
      if (st) {
        const cx = (1 + Math.random() * (st.W - 2)) | 0;
        const cy = (1 + Math.random() * (st.H - 2)) | 0;
        const r  = (4 + Math.random() * 8) | 0;
        const strength = 55 + Math.random() * 70;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = cx+dx, ny = cy+dy;
            if (nx > 0 && nx < st.W-1 && ny > 0 && ny < st.H-1) {
              const d2 = Math.sqrt(dx*dx+dy*dy);
              if (d2 <= r) st.cur[ny*st.W+nx] += strength*(1-d2/r);
            }
          }
        }
        // sound disabled
      }
      setTimeout(scheduleDrip, 400 + Math.random() * 500);
    };
    setTimeout(scheduleDrip, 400 + Math.random() * 500);

    return () => { dripActive = false; cancelAnimationFrame(raf); };
  }, []);



  // Mouse → water disturbance
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      const st = waterStateRef.current;
      if (!st) return;
      const m = mouseRef.current;
      const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (speed < 0.35) return;
      // Normalise via current viewport so coords are correct in any window size / F11 fullscreen
      const cx = Math.floor(e.clientX * st.W / window.innerWidth);
      const cy = Math.floor(e.clientY * st.H / window.innerHeight);
      const r = Math.max(3, Math.min(18, speed * 0.9)) | 0;
      const strength = Math.min(35, speed * 3.75);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx > 0 && nx < st.W - 1 && ny > 0 && ny < st.H - 1) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= r) st.cur[ny * st.W + nx] += strength * (1 - d / r);
          }
        }
      }
    };
    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, []);

  // Click → splash: sharp central spike surrounded by a depressed ring (realistic water impact)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const st = waterStateRef.current;
      if (!st) return;
      // Normalise via current viewport so coords are correct in any window size / F11 fullscreen
      const cx = Math.floor(e.clientX * st.W / window.innerWidth);
      const cy = Math.floor(e.clientY * st.H / window.innerHeight);
      if (cx <= 0 || cx >= st.W - 1 || cy <= 0 || cy >= st.H - 1) return;

      const spikeR   = 5;   // sharp central peak
      const ringR    = 18;  // outward depression ring
      const spikeStr = 300;
      const ringStr  = 130;

      for (let dy = -ringR; dy <= ringR; dy++) {
        for (let dx = -ringR; dx <= ringR; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx <= 0 || nx >= st.W - 1 || ny <= 0 || ny >= st.H - 1) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= spikeR) {
            // central spike — pushes water upward
            st.cur[ny * st.W + nx] += spikeStr * (1 - d / spikeR);
          } else if (d <= ringR) {
            // surrounding trough — pulls water down (creates the classic crown shape)
            const t = (d - spikeR) / (ringR - spikeR);
            st.cur[ny * st.W + nx] -= ringStr * Math.sin(t * Math.PI);
          }
        }
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

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
          from { opacity:0; transform: translateY(32px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes ebs-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
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
        .ebs-orb       { animation: ebs-orb       13s ease-in-out infinite; }
        .ebs-ticker    { animation: ebs-ticker     28s linear infinite; }
        .ebs-up        { animation: ebs-up 0.7s cubic-bezier(.22,1,.36,1) both; }
        .ebs-spin      { animation: ebs-spin 0.9s linear infinite; }
        .ebs-input {
          width:100%; padding:14px 16px 14px 44px;
          border-radius:14px; font-size:14px; color:#fff; outline:none;
          background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.08);
          transition: border-color .2s, box-shadow .2s;
        }
        .ebs-input::placeholder { color: rgba(255,255,255,0.2); }
        .ebs-input:focus {
          border-color: rgba(37,99,235,0.7);
          box-shadow: 0 0 0 4px rgba(37,99,235,0.15);
        }
        .ebs-btn {
          background: linear-gradient(135deg,#1d4ed8 0%,#0891b2 50%,#1d4ed8 100%);
          background-size: 200% auto;
          animation: ebs-grad 3s ease infinite;
          box-shadow: 0 8px 32px rgba(37,99,235,.4);
          transition: transform .2s, box-shadow .2s;
        }
        .ebs-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 12px 40px rgba(37,99,235,.55); }
        .ebs-btn:active:not(:disabled){ transform: scale(.98); }
        .ebs-btn:disabled { opacity:.5; cursor:not-allowed; }
        .ebs-demo-btn {
          background: rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.07);
          border-radius:14px; padding:11px 8px; font-size:12px; font-weight:700;
          color:rgba(255,255,255,0.35); transition: all .2s; width:100%;
        }
        .ebs-demo-btn:hover { background:rgba(37,99,235,0.12); border-color:rgba(37,99,235,.3); color:#93c5fd; transform:scale(1.02); }
        .ebs-2fa-input {
          width:220px; text-align:center; font-size:36px; font-weight:900;
          letter-spacing:.4em; padding:16px 12px; border-radius:16px;
          background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.1);
          color:#fff; outline:none; caret-color:#2563eb; transition:border-color .2s,box-shadow .2s;
        }
        .ebs-2fa-input:focus { border-color:rgba(37,99,235,.7); box-shadow:0 0 0 4px rgba(37,99,235,.15); }
        .ebs-card-border {
          padding: 1.5px; border-radius: 28px;
          background: linear-gradient(135deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb);
          background-size: 300% 300%;
          animation: ebs-grad 5s ease infinite;
        }
        .ebs-logo-card {
          position:absolute; top:0; left:0;
          will-change: transform;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display:flex; flex-direction:column; align-items:center;
          gap:0; padding:12px;
          border-radius:24px;
          background:rgba(255,255,255,0.05);
          border:1.5px solid rgba(255,255,255,0.13);
          backdrop-filter:blur(22px);
          -webkit-backdrop-filter:blur(22px);
          box-shadow:0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12);
          opacity:0;
          transition: opacity 0.5s ease;
          cursor: default;
        }
      `}</style>

      <div style={{ height:'100vh', position:'relative', background:'#030712', overflow:'hidden' }}>

        {/* ═══════════════════════════════ FULL-SCREEN BRANDING BACKGROUND ═══════════════════════════════ */}
        <div ref={leftPanelRef} className="hidden lg:flex" style={{ position:'absolute', inset:0, overflow:'hidden', flexDirection:'column' }}>

          {/* BG mesh */}
          <div style={{
            position:'absolute', inset:0,
            background:'radial-gradient(ellipse at 15% 15%, rgba(37,99,235,.18) 0%,transparent 55%), radial-gradient(ellipse at 85% 80%, rgba(16,185,129,.15) 0%,transparent 55%), radial-gradient(ellipse at 55% 45%, rgba(8,145,178,.1) 0%,transparent 60%), #030712'
          }}/>

          {/* Grid */}
          <div style={{
            position:'absolute', inset:0, opacity:.035,
            backgroundImage:'linear-gradient(rgba(255,255,255,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.9) 1px,transparent 1px)',
            backgroundSize:'60px 60px'
          }}/>

          {/* Orbs */}
          <div className="ebs-orb" style={{ position:'absolute', width:420, height:420, borderRadius:'50%', filter:'blur(80px)', top:'-8%', left:'-8%', background:'radial-gradient(circle,rgba(37,99,235,.42) 0%,transparent 70%)', pointerEvents:'none' }}/>
          <div className="ebs-orb" style={{ position:'absolute', width:360, height:360, borderRadius:'50%', filter:'blur(70px)', bottom:'5%', right:'-8%', background:'radial-gradient(circle,rgba(16,185,129,.38) 0%,transparent 70%)', pointerEvents:'none', animationDelay:'5s' }}/>
          <div className="ebs-orb" style={{ position:'absolute', width:280, height:280, borderRadius:'50%', filter:'blur(60px)', top:'42%', right:'18%', background:'radial-gradient(circle,rgba(8,145,178,.3) 0%,transparent 70%)', pointerEvents:'none', animationDelay:'9s' }}/>

          {/* Physics-driven bouncing logo cards */}
          {LOGO_CARDS.map((c, i) => (
            <div
              key={i}
              ref={el => { cardRefs.current[i] = el; }}
              className="ebs-logo-card"
              style={{ width: cardSize, zIndex: 10 }}
            >
              <div style={{
                width: cardSize - 20, height: cardSize - 20,
                background:'#ffffff', borderRadius:16,
                padding:'12px',
                border:'2px solid rgba(255,255,255,1)',
                boxShadow:'0 4px 24px rgba(0,0,0,0.55)',
                display:'flex', alignItems:'center', justifyContent:'center',
                overflow:'hidden',
              }}>
                <img
                  src={c.file}
                  alt={c.name}
                  style={{ width:'100%', height:'100%', objectFit:'contain', mixBlendMode:'multiply', display:'block' }}
                />
              </div>
            </div>
          ))}
          {/* Water shimmer canvas — screen blend = pure additive light on background */}
          <canvas
            ref={waterCanvasRef}
            style={{
              position:'absolute', inset:0,
              width:'100%', height:'100%',
              zIndex:14,
              pointerEvents:'none',
              mixBlendMode:'screen',
              filter:'blur(1.2px)',
            }}
          />
          {/* Center content */}
          <div style={{ position:'absolute', left:0, top:0, width:'58%', bottom:46, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'64px 48px', zIndex:20 }}>

            {/* Logo */}
            <div className="ebs-up" style={{ animationDelay:'.1s', marginBottom:24 }}>
              <img src="/logo.jpeg" alt="Logo" style={{ width:120, height:120, objectFit:'contain', borderRadius:24, filter:'drop-shadow(0 0 36px rgba(37,99,235,.5)) drop-shadow(0 8px 24px rgba(0,0,0,.5))' }}/>
            </div>

            {/* Headline */}
            <div className="ebs-up" style={{ animationDelay:'.2s', textAlign:'center', marginBottom:10 }}>
              <h1 style={{ fontSize:52, fontWeight:900, lineHeight:1, letterSpacing:'-1px', background:'linear-gradient(135deg,#fff 0%,#bfdbfe 40%,#93c5fd 65%,#60a5fa 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                ELITON<br/>BENEFITS
              </h1>
            </div>

            {/* Badge */}
            <div className="ebs-up" style={{ animationDelay:'.3s', marginBottom:28 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:100, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'ebs-ping 2s ease infinite' }}/>
                <span style={{ color:'#6ee7b7', fontSize:11, fontWeight:700, letterSpacing:'0.25em', textTransform:'uppercase' }}>Stratton Prime · System Aktywny</span>
              </div>
            </div>

            {/* Description */}
            <div className="ebs-up" style={{ animationDelay:'.4s', marginBottom:40, maxWidth:380, textAlign:'center' }}>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:16, lineHeight:1.7, fontWeight:400 }}>
                Twoje <strong style={{ color:'rgba(255,255,255,0.8)', fontWeight:700 }}>benefity pracownicze</strong> w jednym miejscu. Vouchery, zdrowie, rozrywka i tysiące usług.
              </p>
            </div>

            {/* Separator */}
            <div className="ebs-up" style={{ animationDelay:'.45s', width:60, height:1, background:'linear-gradient(90deg,transparent,rgba(37,99,235,.7),transparent)', marginBottom:36 }}/>

            {/* Stats row */}
            <div className="ebs-up" style={{ animationDelay:'.55s', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, width:'100%', maxWidth:360 }}>
              {[['500+','Benefitów'],['98%','Satysfakcji'],['10k+','Użytkowników']].map(([v,l],i)=>(
                <div key={i} style={{ textAlign:'center', padding:'14px 8px', borderRadius:18, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:'#fff', lineHeight:1.1 }}>{v}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontWeight:600, marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticker bar */}
          <div style={{ position:'relative', zIndex:20, borderTop:'1px solid rgba(255,255,255,0.05)', padding:'10px 0', overflow:'hidden' }}>
            <div className="ebs-ticker" style={{ display:'flex', whiteSpace:'nowrap', width:'max-content' }}>
              {[...TICKER, ...TICKER].map((item, i) => (
                <span key={i} style={{ color:'rgba(255,255,255,0.2)', fontSize:12, fontWeight:600, padding:'0 20px', display:'inline-block' }}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════ RIGHT — FORM OVERLAY ═══════════════════════════════ */}
        <div style={{ position:'absolute', right:0, top:0, height:'100vh', width:'42%', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 24px', background:'linear-gradient(160deg,rgba(3,7,18,0.55) 0%,rgba(3,7,18,0.6) 100%)', backdropFilter:'blur(6px)', overflow:'hidden', zIndex:30 }}>

          {/* BG glow */}
          <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', filter:'blur(100px)', top:'-20%', left:'-30%', background:'radial-gradient(circle,rgba(37,99,235,.22) 0%,transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', filter:'blur(70px)', bottom:'-10%', right:'-10%', background:'radial-gradient(circle,rgba(16,185,129,.18) 0%,transparent 70%)', pointerEvents:'none' }}/>

          <div style={{ width:'100%', maxWidth:440, position:'relative', zIndex:10 }}>

            {/* Mobile logo */}
            <div className="flex lg:hidden justify-center" style={{ marginBottom:28 }}>
              <img src="/logo.jpeg" alt="Logo" style={{ width:72, height:72, objectFit:'contain', borderRadius:16 }}/>
            </div>

            {/* Card with animated gradient border */}
            <div className="ebs-card-border">
              <div style={{ borderRadius:26, overflow:'hidden', background:'rgba(5,10,22,0.97)', backdropFilter:'blur(24px)', boxShadow:'0 32px 80px rgba(0,0,0,.7), 0 0 120px rgba(37,99,235,.06)' }}>

                {/* Top shimmer line */}
                <div style={{ height:2, background:'linear-gradient(90deg,#2563eb,#0891b2,#10b981,#059669,#0284c7,#2563eb)', backgroundSize:'300% 100%', animation:'ebs-grad 4s ease infinite' }}/>

                <div style={{ padding:'36px 40px 40px' }}>
                  {step === 'CREDENTIALS' && (
                    <div className="ebs-up" style={{ animationDelay:'0s' }}>

                      {/* Header */}
                      <div style={{ marginBottom:28 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', animation:'ebs-ping 2s ease infinite' }}/>
                          <span style={{ color:'#6ee7b7', fontSize:11, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase' }}>Bezpieczne połączenie</span>
                        </div>
                        <h2 style={{ fontSize:30, fontWeight:900, color:'#fff', marginBottom:6, letterSpacing:'-0.5px' }}>Witaj z powrotem 👋</h2>
                        <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14 }}>Zaloguj się, żeby sprawdzić swoje benefity.</p>
                      </div>

                      <form onSubmit={handleCredentialsSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                        {/* Email */}
                        <div>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>Email służbowy</label>
                          <div style={{ position:'relative' }}>
                            <Mail size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)' }}/>
                            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="jan.kowalski@firma.pl" className="ebs-input"/>
                          </div>
                        </div>

                        {/* Password */}
                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                            <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.15em', textTransform:'uppercase' }}>Hasło</label>
                            <a href="#" style={{ fontSize:12, color:'#60a5fa', textDecoration:'none', fontWeight:600 }}>Zapomniałeś?</a>
                          </div>
                          <div style={{ position:'relative' }}>
                            <Lock size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)' }}/>
                            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••" className="ebs-input"/>
                          </div>
                        </div>

                        {/* Error */}
                        {error && (
                          <div className="ebs-up" style={{ padding:'12px 16px', borderRadius:14, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#fca5a5', background:'rgba(244,63,94,0.1)', border:'1.5px solid rgba(244,63,94,0.2)' }}>
                            <AlertCircle size={16} style={{ flexShrink:0 }}/>
                            {error}
                          </div>
                        )}

                        {/* Submit */}
                        <button type="submit" disabled={isLoading} className="ebs-btn" style={{ width:'100%', padding:'15px', borderRadius:16, fontSize:15, fontWeight:900, color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, letterSpacing:'0.02em', marginTop:4 }}>
                          {isLoading ? (
                            <><span className="ebs-spin" style={{ width:18, height:18, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block' }}/> Autoryzacja...</>
                          ) : (
                            <> Zaloguj się <ArrowRight size={18} strokeWidth={3}/> </>
                          )}
                        </button>
                      </form>

                      {/* Demo shortcuts */}
                      <div style={{ marginTop:28, paddingTop:24, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.2)', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:14 }}>Szybkie logowanie (Demo)</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          {[{label:'Admin (2FA)',role:Role.SUPERADMIN},{label:'HR Manager',role:Role.HR},{label:'Pracownik',role:Role.EMPLOYEE},{label:'Sprzedaż',role:Role.ADVISOR}].map(b=>(
                            <button key={b.label} onClick={()=>demoLogin(b.role)} className="ebs-demo-btn">{b.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === '2FA' && (
                    <div className="ebs-up" style={{ animationDelay:'0s', textAlign:'center' }}>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
                        <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,rgba(37,99,235,.2),rgba(8,145,178,.2))', border:'1.5px solid rgba(37,99,235,.3)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                          <Smartphone size={36} color="#60a5fa"/>
                          <div style={{ position:'absolute', top:-6, right:-6, width:22, height:22, background:'linear-gradient(135deg,#10b981,#0891b2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ color:'#fff', fontSize:8, fontWeight:900 }}>2FA</span>
                          </div>
                        </div>
                      </div>
                      <h2 style={{ fontSize:26, fontWeight:900, color:'#fff', marginBottom:8 }}>Weryfikacja 2FA</h2>
                      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginBottom:28 }}>Wpisz 6-cyfrowy kod z aplikacji Authenticator.</p>

                      <form onSubmit={handle2FASubmit} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                        <input type="text" maxLength={6} value={twoFactorCode} onChange={e=>setTwoFactorCode(e.target.value.replace(/\D/g,''))} placeholder="000000" autoFocus className="ebs-2fa-input"/>
                        {error && (
                          <div style={{ width:'100%', padding:'12px 16px', borderRadius:14, fontSize:13, color:'#fca5a5', background:'rgba(244,63,94,0.1)', border:'1.5px solid rgba(244,63,94,0.2)' }}>{error}</div>
                        )}
                        <button type="submit" disabled={twoFactorCode.length!==6||isLoading} className="ebs-btn" style={{ width:'100%', padding:'15px', borderRadius:16, fontSize:15, fontWeight:900, color:'#fff', border:'none', cursor:'pointer' }}>
                          {isLoading?'Weryfikacja...':'Potwierdź tożsamość'}
                        </button>
                      </form>

                      <div style={{ marginTop:16, display:'inline-block', padding:'8px 16px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', fontSize:12, color:'rgba(255,255,255,0.3)' }}>
                        Demo Code: <strong style={{ color:'rgba(255,255,255,0.7)' }}>{TWO_FA_DEMO_CODE}</strong>
                      </div>
                      <button onClick={()=>{setStep('CREDENTIALS');setTwoFactorCode('');setError('');}} style={{ display:'block', margin:'16px auto 0', fontSize:13, color:'#60a5fa', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>
                        ← Wróć do logowania
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p style={{ textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:11, marginTop:20 }}>
              &copy; {new Date().getFullYear()} Stratton Prime S.A. Wszystkie prawa zastrzeżone.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
