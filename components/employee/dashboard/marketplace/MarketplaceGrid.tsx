// Placeholder component for Marketplace Categories
import React from 'react';
import { 
    Shield, Scale, Brain, Smartphone, Users, Lock, ChevronRight 
} from 'lucide-react';

const CategoryCard = ({ icon, title, subtitle, image, color }) => {
    return (
        <div className="group relative overflow-hidden rounded-2xl aspect-[16/9] bg-slate-100 cursor-pointer shadow-sm hover:shadow-lg transition-all duration-500 hover:-translate-y-1">
            <div className={`absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105`} style={{ backgroundImage: `url(${image})` }}></div>
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-300"></div>

            <div className="absolute inset-x-0 bottom-0 p-6 flex items-end justify-between z-10">
                <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-lg mb-1">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-emerald-300 transition-colors drop-shadow-md">{title}</h3>
                        <p className="text-white/70 text-xs font-medium mt-1 leading-tight">{subtitle}</p>
                    </div>
                </div>
            </div>
            
            {/* Status Hover Overlay */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
               <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white rotate-45 group-hover:rotate-0 transition-transform duration-500">
                  <ChevronRight size={18} />
               </div>
            </div>
        </div>
    );
};

export const MarketplaceGrid = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 animate-in slide-in-from-bottom-5 duration-700">
            <CategoryCard 
                icon={<Shield size={20} />}
                title="Cyberbezpieczeństwo"
                subtitle="VPN, Antywirus, Ochrona Rodziny"
                image="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=600"
                color="emerald"
            />
            <CategoryCard 
                icon={<Scale size={20} />}
                title="Asystent Prawny"
                subtitle="Analiza umów, Porady konsumenckie"
                image="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=600"
                color="yellow"
            />
            <CategoryCard 
                icon={<Brain size={20} />}
                title="Głowa Spokojna"
                subtitle="Psycholog Online, Medytacja, Sen"
                image="https://images.unsplash.com/photo-1606275841443-34e85741369f?auto=format&fit=crop&q=80&w=600"
                color="rose"
            />
            <CategoryCard 
                icon={<Smartphone size={20} />}
                title="Cyfrowy Detoks"
                subtitle="Blokery apek, Tryb Skupienia"
                image="https://images.unsplash.com/photo-1511871893393-82e9c16b81e3?auto=format&fit=crop&q=80&w=600"
                color="cyan"
            />
            <CategoryCard 
                icon={<Users size={20} />}
                title="Rozwój Kompetencji"
                subtitle="Kursy AI, Angielski, Cyber Higiena"
                image="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=600"
                color="blue"
            />
            <CategoryCard 
                icon={<Lock size={20} />}
                title="Prywatność Danych"
                subtitle="Menedżer haseł, Szyfrowanie plików"
                image="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=600"
                color="violet"
            />
        </div>
    );
};
