import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ServiceCarouselProps {
  children: React.ReactNode;
}

export function ServiceCarousel({ children }: ServiceCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false, // dragFree disables snapping to slides
    slidesToScroll: 1, // scroll 1 slide at a time
  });

  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi && emblaApi.scrollTo(index), [emblaApi]);

  const onInit = useCallback((emblaApi: any) => {
    setScrollSnaps(emblaApi.scrollSnapList());
  }, []);

  const onSelect = useCallback((emblaApi: any) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setPrevBtnEnabled(emblaApi.canScrollPrev());
    setNextBtnEnabled(emblaApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    
    onInit(emblaApi);
    onSelect(emblaApi);
    
    emblaApi.on('reInit', onInit);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);
  }, [emblaApi, onInit, onSelect]);

  return (
    <div className="relative group w-full mb-6">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex backface-hidden touch-pan-y" style={{ touchAction: 'pan-y', marginLeft: '-1rem' }}>
          {React.Children.map(children, (child, i) => (
            <div
              key={i}
              className="flex-[0_0_100%] sm:flex-[0_0_50%] md:flex-[0_0_25%] pl-4"
              style={{ minWidth: 0 }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {prevBtnEnabled && (
        <button
          onClick={scrollPrev}
          className="absolute top-[40%] -left-5 -translate-y-1/2 w-10 h-10 shadow-lg rounded-full bg-slate-800/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-slate-700"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {nextBtnEnabled && (
        <button
          onClick={scrollNext}
          className="absolute top-[40%] -right-5 -translate-y-1/2 w-10 h-10 shadow-lg rounded-full bg-slate-800/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-slate-700"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Pagination / Slides to scroll */}
      {scrollSnaps.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === selectedIndex ? 'bg-indigo-500 w-6' : 'bg-slate-600 w-1.5 hover:bg-slate-500'
              }`}
              aria-label={`Przejdź do slajdu ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
