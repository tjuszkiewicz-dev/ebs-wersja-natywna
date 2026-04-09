'use client';

import { useEffect, useRef } from 'react';

interface SoftAuroraProps {
  /** Kolory aury – domyślnie zielono-szmaragdowe dla EBS */
  colors?: string[];
  /** Prędkość animacji (1 = normalna) */
  speed?: number;
  /** Intensywność rozmycia */
  blur?: number;
  /** Krycie warstwy aury (0–1) */
  opacity?: number;
  className?: string;
}

export default function SoftAurora({
  colors = ['#00ff41', '#00cc33', '#003d1a', '#00ff88', '#004d00'],
  speed = 1,
  blur = 80,
  opacity = 0.6,
  className = '',
}: SoftAuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Każda "plama" aury
    const blobs = colors.map((color, i) => ({
      color,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 400 + 200,
      vx: (Math.random() - 0.5) * 0.4 * speed,
      vy: (Math.random() - 0.5) * 0.4 * speed,
      phase: (i / colors.length) * Math.PI * 2,
    }));

    const draw = (time: number) => {
      timeRef.current = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      blobs.forEach((blob) => {
        // Sinusoidalny ruch
        blob.x += blob.vx + Math.sin(time * 0.0005 * speed + blob.phase) * 0.5;
        blob.y += blob.vy + Math.cos(time * 0.0004 * speed + blob.phase) * 0.5;

        // Odbijanie od krawędzi
        if (blob.x < -blob.radius) blob.x = canvas.width + blob.radius;
        if (blob.x > canvas.width + blob.radius) blob.x = -blob.radius;
        if (blob.y < -blob.radius) blob.y = canvas.height + blob.radius;
        if (blob.y > canvas.height + blob.radius) blob.y = -blob.radius;

        const gradient = ctx.createRadialGradient(
          blob.x, blob.y, 0,
          blob.x, blob.y, blob.radius
        );
        gradient.addColorStop(0, blob.color + 'cc');
        gradient.addColorStop(0.5, blob.color + '44');
        gradient.addColorStop(1, blob.color + '00');

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [colors, speed, blur, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none ${className}`}
      style={{
        filter: `blur(${blur}px)`,
        opacity,
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
