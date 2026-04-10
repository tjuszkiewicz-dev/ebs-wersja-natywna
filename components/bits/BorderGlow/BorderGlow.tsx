'use client';

import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';

interface BorderGlowProps {
  children: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
}

const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#060010',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#818cf8', '#38bdf8'],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, opacity: 0 });
  const [animProgress, setAnimProgress] = useState(animated ? 0 : 1);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Intro sweep animation
  useEffect(() => {
    if (!animated) return;
    const duration = 1200;
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      setAnimProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [animated]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const distLeft = x;
      const distRight = rect.width - x;
      const distTop = y;
      const distBottom = rect.height - y;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      // edgeSensitivity 0-100 maps to 0-50% of shorter dimension
      const threshold = (edgeSensitivity / 100) * Math.min(rect.width, rect.height) * 0.8;
      const rawOpacity = Math.max(0, Math.min(1, 1 - minDist / Math.max(threshold, 1)));
      const opacity = rawOpacity * animProgress;

      setMouse({ x, y, opacity });
    },
    [edgeSensitivity, animProgress]
  );

  const handleMouseLeave = useCallback(() => {
    setMouse((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  // Gradient mesh border (3 color stops spread across gradient)
  const gradientBorder = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;

  // Dynamic directional glow on border using box-shadow
  const alpha1 = Math.round(mouse.opacity * glowIntensity * 120)
    .toString(16)
    .padStart(2, '0');
  const alpha2 = Math.round(mouse.opacity * glowIntensity * 70)
    .toString(16)
    .padStart(2, '0');
  const alpha3 = Math.round(mouse.opacity * glowIntensity * 40)
    .toString(16)
    .padStart(2, '0');

  const boxShadow =
    mouse.opacity > 0.01
      ? `0 0 ${glowRadius * 0.4}px ${colors[0]}${alpha1}, 0 0 ${glowRadius * 0.7}px ${colors[1]}${alpha2}, 0 0 ${glowRadius}px ${colors[2]}${alpha3}`
      : 'none';

  return (
    <div
      ref={containerRef}
      className={`relative block ${className}`}
      style={{
        borderRadius,
        padding: '2px',
        background: gradientBorder,
        boxShadow,
        transition: 'box-shadow 0.12s ease',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Directional cone glow overlay on the border itself */}
      {mouse.opacity > 0.01 && (
        <div
          style={{
            position: 'absolute',
            inset: `-${glowRadius}px`,
            borderRadius: borderRadius + glowRadius,
            background: `radial-gradient(ellipse ${coneSpread * 3}% ${coneSpread * 2}% at ${mouse.x + glowRadius}px ${mouse.y + glowRadius}px, hsla(${glowColor}, ${(mouse.opacity * glowIntensity * 0.55).toFixed(2)}) 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}

      {/* Inner content container */}
      <div
        style={{
          borderRadius: Math.max(borderRadius - 2, 0),
          overflow: 'hidden',
          position: 'relative',
          background: backgroundColor,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
