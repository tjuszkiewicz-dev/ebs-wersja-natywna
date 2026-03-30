import React from 'react';

export const MarketplaceHero = () => {
    return (
        <div className="mb-12 text-left animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
                    Marketplace Benefitowy
                </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-[1.15] mb-4">
                Katalog, który <br/>
                <span className="text-emerald-500">pracownicy faktycznie</span><br/>
                <span className="text-emerald-500">lubią.</span>
            </h1>
            
            <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
                Zamiast 1000 zniżek na pizzę, dajemy narzędzia, które realnie poprawiają jakość życia i bezpieczeństwo Twojego zespołu.
            </p>
        </div>
    );
};
