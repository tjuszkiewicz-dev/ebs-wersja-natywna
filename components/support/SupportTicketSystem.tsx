
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportTicket, TicketMessage, TicketCategory, TicketPriority, TicketStatus, User, Role } from '../../types';
import { Send, Plus, MessageSquare, CheckCircle, Clock, AlertCircle, XCircle, Search, User as UserIcon, Building2, Paperclip, ChevronLeft, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';

interface SupportTicketSystemProps {
  currentUser: User;
  tickets: SupportTicket[];
  onCreateTicket: (subject: string, category: TicketCategory, priority: TicketPriority, message: string) => void;
  onReply: (ticketId: string, message: string) => void;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => void;
}

export const SupportTicketSystem: React.FC<SupportTicketSystemProps> = ({
  currentUser, tickets, onCreateTicket, onReply, onUpdateStatus
}) => {
  const [view, setView] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  // Create Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('TECHNICAL');
  const [priority, setPriority] = useState<TicketPriority>('NORMAL');
  const [initialMessage, setInitialMessage] = useState('');

  // Reply State
  const [replyMessage, setReplyMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedTicketId), [tickets, selectedTicketId]);

  // Admin sees all, User sees own
  const myTickets = useMemo(() => {
      if (currentUser.role === Role.SUPERADMIN) return tickets;
      return tickets.filter(t => t.creatorId === currentUser.id);
  }, [tickets, currentUser]);

  const sortedTickets = useMemo(() => {
      return [...myTickets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [myTickets]);

  // Scroll to bottom of chat
  useEffect(() => {
      if (view === 'DETAIL' && chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [view, selectedTicket?.messages]);

  const handleCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!subject || !initialMessage) return;
      onCreateTicket(subject, category, priority, initialMessage);
      setView('LIST');
      // Reset form
      setSubject('');
      setInitialMessage('');
      setCategory('TECHNICAL');
      setPriority('NORMAL');
  };

  const handleReplySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!replyMessage || !selectedTicketId) return;
      onReply(selectedTicketId, replyMessage);
      setReplyMessage('');
  };

  // --- RENDERERS ---

  const renderPriorityBadge = (p: TicketPriority) => {
      switch(p) {
          case 'CRITICAL': return <span className="text-red-600 font-bold text-xs uppercase">Krytyczny</span>;
          case 'HIGH': return <span className="text-orange-600 font-bold text-xs uppercase">Wysoki</span>;
          case 'NORMAL': return <span className="text-blue-600 font-bold text-xs uppercase">Normalny</span>;
          case 'LOW': return <span className="text-slate-500 font-bold text-xs uppercase">Niski</span>;
      }
  };

  const renderCreateView = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center gap-3">
              <button onClick={() => setView('LIST')} className="p-2 hover:bg-slate-100 rounded-full transition"><ChevronLeft size={20}/></button>
              <h3 className="font-bold text-slate-800">Nowe Zgłoszenie</h3>
          </div>
          <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                  <label className="label-text">Temat</label>
                  <input 
                      type="text" 
                      value={subject} 
                      onChange={e => setSubject(e.target.value)} 
                      className="input-field focus:ring-indigo-500"
                      placeholder="Krótki opis problemu..."
                      required
                  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="label-text">Kategoria</label>
                      <select 
                          value={category} 
                          onChange={e => setCategory(e.target.value as TicketCategory)}
                          className="input-field bg-white"
                      >
                          <option value="TECHNICAL">Problem Techniczny</option>
                          <option value="FINANCIAL">Finanse / Płatności</option>
                          <option value="VOUCHER">Vouchery / Kody</option>
                          <option value="OTHER">Inne</option>
                      </select>
                  </div>
                  <div>
                      <label className="label-text">Priorytet</label>
                      <select 
                          value={priority} 
                          onChange={e => setPriority(e.target.value as TicketPriority)}
                          className="input-field bg-white"
                      >
                          <option value="LOW">Niski</option>
                          <option value="NORMAL">Normalny</option>
                          <option value="HIGH">Wysoki</option>
                          <option value="CRITICAL">Krytyczny</option>
                      </select>
                  </div>
              </div>
              <div>
                  <label className="label-text">Opis Zgłoszenia</label>
                  <textarea 
                      value={initialMessage} 
                      onChange={e => setInitialMessage(e.target.value)} 
                      className="input-field h-40 resize-none focus:ring-indigo-500"
                      placeholder="Szczegółowy opis sytuacji..."
                      required
                  />
              </div>
              <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                      <Send size={18}/> Wyślij Zgłoszenie
                  </button>
              </div>
          </form>
      </div>
  );

  const renderDetailView = () => {
      if (!selectedTicket) return <div>Błąd: Zgłoszenie nie znalezione.</div>;

      const isAdmin = currentUser.role === Role.SUPERADMIN;
      const isResolved = selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED';

      return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3 overflow-hidden">
                      <button onClick={() => setView('LIST')} className="p-2 hover:bg-white rounded-full transition shrink-0"><ChevronLeft size={20}/></button>
                      <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 text-sm truncate">{selectedTicket.subject}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono">{selectedTicket.id}</span>
                              <span>•</span>
                              {renderPriorityBadge(selectedTicket.priority)}
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && !isResolved && (
                          <button 
                              onClick={() => onUpdateStatus(selectedTicket.id, 'RESOLVED')}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition"
                          >
                              Rozwiąż
                          </button>
                      )}
                      <StatusBadge status={selectedTicket.status} />
                  </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4">
                  {selectedTicket.messages.map((msg, idx) => {
                      const isMe = msg.senderId === currentUser.id;
                      const isSystem = msg.senderRole === Role.SUPERADMIN;
                      
                      return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] ${isMe ? 'bg-indigo-600 text-white' : isSystem ? 'bg-white border-l-4 border-emerald-500' : 'bg-white border border-slate-200'} p-3 rounded-xl shadow-sm relative group`}>
                                  {!isMe && (
                                      <p className="text-[10px] font-bold mb-1 opacity-70 flex items-center gap-1">
                                          {isSystem && <ShieldCheck size={10}/>} {msg.senderName}
                                      </p>
                                  )}
                                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                  <p className={`text-[9px] text-right mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                      {new Date(msg.timestamp).toLocaleString()}
                                  </p>
                              </div>
                          </div>
                      );
                  })}
                  <div ref={chatEndRef} />
              </div>

              {/* Reply Input */}
              {!isResolved ? (
                  <form onSubmit={handleReplySubmit} className="p-4 border-t border-slate-200 bg-white shrink-0">
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              value={replyMessage}
                              onChange={e => setReplyMessage(e.target.value)}
                              placeholder="Napisz odpowiedź..."
                              className="input-field focus:border-indigo-500"
                          />
                          <button type="submit" disabled={!replyMessage.trim()} className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
                              <Send size={20}/>
                          </button>
                      </div>
                  </form>
              ) : (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-bold">
                      Zgłoszenie zostało zamknięte.
                  </div>
              )}
          </div>
      );
  };

  const renderListView = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquare size={20} className="text-indigo-600"/>
                  Zgłoszenia ({myTickets.length})
              </h3>
              <button 
                  onClick={() => setView('CREATE')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
              >
                  <Plus size={16}/> Nowe Zgłoszenie
              </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
              {myTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                      <div className="bg-slate-50 p-4 rounded-full mb-3"><CheckCircle size={32} /></div>
                      <p className="font-medium text-sm">Brak aktywnych zgłoszeń.</p>
                      <p className="text-xs">Masz problem? Utwórz nowe zgłoszenie.</p>
                  </div>
              ) : (
                  <div className="divide-y divide-slate-100">
                      {sortedTickets.map(t => (
                          <div 
                              key={t.id} 
                              onClick={() => { setSelectedTicketId(t.id); setView('DETAIL'); }}
                              className="p-4 hover:bg-slate-50 cursor-pointer transition group"
                          >
                              <div className="flex justify-between items-start mb-1">
                                  <div className="flex items-center gap-2">
                                      {t.status === 'OPEN' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>}
                                      <span className={`font-bold text-sm ${t.status === 'RESOLVED' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                          {t.subject}
                                      </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">{t.id}</span>
                              </div>
                              
                              <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                                  {t.messages[t.messages.length - 1].message}
                              </p>

                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                      <StatusBadge status={t.status} />
                                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-bold">{t.category}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                      {new Date(t.updatedAt).toLocaleDateString()}
                                  </span>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="h-[600px] max-h-[80vh]">
        {view === 'LIST' && renderListView()}
        {view === 'CREATE' && renderCreateView()}
        {view === 'DETAIL' && renderDetailView()}
    </div>
  );
};
