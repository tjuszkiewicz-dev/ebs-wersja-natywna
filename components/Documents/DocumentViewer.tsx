
import React, { useLayoutEffect, useRef, useState, forwardRef } from 'react';
import { PDF_LAYOUT } from './PDF_LAYOUT';

interface DocumentViewerProps {
  children: React.ReactNode;
  className?: string;
}

// We use forwardRef to allow the parent (Modal) to access the actual A4 DOM element for PDF generation
export const DocumentViewer = forwardRef<HTMLDivElement, DocumentViewerProps>(({ children, className }, contentRef) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const calculateScale = () => {
      if (scrollContainerRef.current) {
        const availableWidth = scrollContainerRef.current.clientWidth;
        const PADDING_PX = 32; // UI Padding around the document
        const targetWidth = availableWidth - PADDING_PX;
        
        // Calculate scale to fit width based on the defined pixel width in layout
        let newScale = Math.min(1, targetWidth / PDF_LAYOUT.widthPx);
        
        // Ensure it's not too small on mobile
        newScale = Math.max(0.4, newScale);
        
        setScale(newScale);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  return (
    <div 
        className={`overflow-y-auto bg-slate-400/50 flex-1 flex flex-col items-center py-8 px-4 w-full ${className || ''}`} 
        ref={scrollContainerRef}
    >
      {/* SCALING WRAPPER */}
      <div 
         style={{ 
           width: PDF_LAYOUT.cssWidth, 
           height: PDF_LAYOUT.cssHeight,
           transform: `scale(${scale})`,
           transformOrigin: 'top center',
           transition: 'transform 0.2s ease-out',
           marginBottom: '2rem' // Extra space at bottom for scrolling
         }}
         ref={scaleWrapperRef}
         data-scale-wrapper // Marker for PDF generator to reset scale if needed
      >
          {/* THE ACTUAL A4 DOCUMENT */}
          <div ref={contentRef}>
            {children}
          </div>
      </div>
    </div>
  );
});

DocumentViewer.displayName = 'DocumentViewer';