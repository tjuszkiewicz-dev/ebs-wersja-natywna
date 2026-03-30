
import React, { useState } from 'react';
import { ServiceItem, ServiceType } from '../../../types';
import { Edit2, Trash2, Plus, X, Save, ToggleLeft, ToggleRight, ShoppingCart } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { ServiceIcon, AVAILABLE_ICONS } from '../../ui/ServiceIcon';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

interface ServiceManagerProps {
  services: ServiceItem[];
  onManage: (action: 'ADD' | 'UPDATE' | 'DELETE', service: ServiceItem) => void;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({ services, onManage }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ServiceItem>>({});

  const openAdd = () => {
      setEditingItem({
          id: `SRV-${Date.now()}`,
          name: '',
          description: '',
          price: 10,
          type: ServiceType.ONE_TIME,
          icon: 'ShoppingCart',
          isActive: true
      });
      setIsModalOpen(true);
  };

  const openEdit = (s: ServiceItem) => {
      setEditingItem({ ...s });
      setIsModalOpen(true);
  };

  const handleSave = () => {
      if (!editingItem.name || !editingItem.price) return alert("Nazwa i cena są wymagane");
      
      const isNew = !services.find(s => s.id === editingItem.id);
      onManage(isNew ? 'ADD' : 'UPDATE', editingItem as ServiceItem);
      setIsModalOpen(false);
  };

  const handleDelete = (s: ServiceItem) => {
      if (confirm(`Czy na pewno usunąć usługę: ${s.name}?`)) {
          onManage('DELETE', s);
      }
  };

  const toggleActive = (s: ServiceItem, e: React.MouseEvent) => {
      e.stopPropagation();
      onManage('UPDATE', { ...s, isActive: !s.isActive });
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
                <h3 className="font-bold text-slate-800 text-lg">Zamknięty Katalog Usług</h3>
                <p className="text-sm text-slate-500">Zarządzaj usługami widocznymi dla pracowników ({services.length} poz).</p>
            </div>
            <Button 
                onClick={openAdd}
                variant="success"
                icon={<Plus size={18}/>}
            >
                Dodaj Nową Usługę
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(s => (
                <div 
                    key={s.id} 
                    className={`bg-white rounded-xl border p-5 transition-all relative overflow-hidden group flex flex-col h-full ${
                        s.isActive ? 'border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md' : 'border-slate-100 opacity-60 grayscale'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${s.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <ServiceIcon iconName={s.icon} size={28} />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {s.type === ServiceType.SUBSCRIPTION 
                                ? <Badge variant="indigo">Subskrypcja</Badge> 
                                : <Badge variant="neutral">Jednorazowe</Badge>
                            }
                            <button onClick={(e) => toggleActive(s, e)} className="text-slate-300 hover:text-emerald-500 transition" title={s.isActive ? "Ukryj" : "Aktywuj"}>
                                {s.isActive ? <ToggleRight size={28} className="text-emerald-500"/> : <ToggleLeft size={28}/>}
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-base mb-1">{s.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{s.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="font-mono font-bold text-lg text-slate-800">{s.price} pkt</span>
                        
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(s)} className="p-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition shadow-sm" title="Edytuj">
                                <Edit2 size={16}/>
                            </button>
                            <button onClick={() => handleDelete(s)} className="p-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 transition shadow-sm" title="Usuń">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            
            {/* Empty State / Add New Placeholder */}
            <button 
                onClick={openAdd}
                className="rounded-xl border-2 border-dashed border-slate-200 p-5 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/10 transition-all min-h-[200px]"
            >
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                    <Plus size={24} />
                </div>
                <span className="text-sm font-bold">Dodaj kolejną usługę</span>
            </button>
        </div>

        {/* EDIT MODAL */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                    <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-lg">Konfiguracja Usługi</h3>
                        <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div>
                            <Input 
                                label="Nazwa usługi *" 
                                value={editingItem.name} 
                                onChange={e => setEditingItem({...editingItem, name: e.target.value})} 
                                placeholder="np. Spotify Premium"
                            />
                        </div>
                        <div>
                            <label className="label-text">Opis (Dla pracownika)</label>
                            <textarea 
                                value={editingItem.description} 
                                onChange={e => setEditingItem({...editingItem, description: e.target.value})} 
                                className="input-field h-24 resize-none"
                                placeholder="Krótki opis benefitu..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Input 
                                    label="Cena (pkt) *" 
                                    type="number" 
                                    value={editingItem.price} 
                                    onChange={e => setEditingItem({...editingItem, price: parseInt(e.target.value)})} 
                                />
                            </div>
                            <div>
                                <Select 
                                    label="Typ Rozliczenia"
                                    value={editingItem.type} 
                                    onChange={e => setEditingItem({...editingItem, type: e.target.value as ServiceType})} 
                                    options={[
                                        { value: ServiceType.ONE_TIME, label: 'Jednorazowa' },
                                        { value: ServiceType.SUBSCRIPTION, label: 'Subskrypcja (Cykliczna)' }
                                    ]}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label-text mb-2 block">Ikona</label>
                            <div className="grid grid-cols-6 gap-2">
                                {AVAILABLE_ICONS.map(icon => (
                                    <button 
                                        key={icon}
                                        onClick={() => setEditingItem({...editingItem, icon})}
                                        className={`aspect-square rounded-lg border flex items-center justify-center transition ${editingItem.icon === icon ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-200' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <ServiceIcon iconName={icon} size={20} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200 cursor-pointer" onClick={() => setEditingItem({...editingItem, isActive: !editingItem.isActive})}>
                            <span className="text-sm font-bold text-slate-700">Widoczność w katalogu</span>
                            {editingItem.isActive ? <ToggleRight size={32} className="text-emerald-500"/> : <ToggleLeft size={32} className="text-slate-300"/>}
                        </div>
                    </div>
                    <div className="p-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Anuluj</Button>
                        <Button variant="primary" onClick={handleSave} icon={<Save size={18}/>}>Zapisz Zmiany</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
