import React, { useEffect } from 'react';

type StarBorderProps<T extends React.ElementType> = React.ComponentPropsWithoutRef<T> & {
  as?: T;
  className?: string;
  children?: React.ReactNode;
  color?: string;
  speed?: string;
  thickness?: number;
};

const STYLE_ID = 'star-border-keyframes';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes star-movement-bottom {
      0%   { transform: translate(0%, 0%);    opacity: 1; }
      100% { transform: translate(-100%, 0%); opacity: 0; }
    }
    @keyframes star-movement-top {
      0%   { transform: translate(0%, 0%);   opacity: 1; }
      100% { transform: translate(100%, 0%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

const StarBorder = <T extends React.ElementType = 'button'>({
  as,
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  children,
  ...rest
}: StarBorderProps<T>) => {
  const Component = as || 'button';

  useEffect(() => { injectKeyframes(); }, []);

  return (
    <Component
      className={`relative inline-block overflow-hidden ${className}`}
      {...(rest as any)}
      style={{
        borderRadius: 20,
        padding: `${thickness}px`,
        ...(rest as any).style,
      }}
    >
      {/* Bottom star */}
      <div
        style={{
          position: 'absolute',
          width: '120%',
          height: '40%',
          bottom: -8,
          right: '-100%',
          borderRadius: '50%',
          opacity: 0.9,
          background: `radial-gradient(circle, ${color}, transparent 6%)`,
          animation: `star-movement-bottom ${speed} linear infinite alternate`,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Top star */}
      <div
        style={{
          position: 'absolute',
          width: '120%',
          height: '40%',
          top: -8,
          left: '-100%',
          borderRadius: '50%',
          opacity: 0.9,
          background: `radial-gradient(circle, ${color}, transparent 6%)`,
          animation: `star-movement-top ${speed} linear infinite alternate`,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Inner content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: 19,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.25)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </div>
    </Component>
  );
};

export default StarBorder;
