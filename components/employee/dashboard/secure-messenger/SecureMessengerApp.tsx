import React, { useState } from 'react';
import { MessengerMenu } from './views/MessengerMenu';
import { ChatRoom } from './views/ChatRoom';
import { NoteCreator } from './views/NoteCreator';
import { NoteReader } from './views/NoteReader';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type AppView = 'MENU' | 'CHAT' | 'NOTE_CREATE' | 'NOTE_READ';

export const SecureMessengerApp: React.FC<Props> = ({ onClose }) => {
  const [currentView, setCurrentView] = useState<AppView>('MENU');
  const [readLink, setReadLink] = useState<string | null>(null);

  const handleSimulateRead = (link: string) => {
    setReadLink(link);
    setCurrentView('NOTE_READ');
  };

  const renderView = () => {
    switch (currentView) {
      case 'MENU':
        return (
          <MessengerMenu 
            onSelectChat={() => setCurrentView('CHAT')}
            onSelectNote={() => setCurrentView('NOTE_CREATE')}
            onClose={onClose}
          />
        );
      case 'CHAT':
        return <ChatRoom onBack={() => setCurrentView('MENU')} />;
      case 'NOTE_CREATE':
        return (
          <NoteCreator 
            onBack={() => setCurrentView('MENU')} 
            onSimulateRead={handleSimulateRead}
          />
        );
      case 'NOTE_READ':
        return (
          <NoteReader 
            link={readLink || ''} 
            onClose={() => setCurrentView('MENU')} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col md:flex-row">
        
        {/* Mobile/Tablet Sidebar Helper (optional, could be full width on mobile) */}
        {/* We make it full width responsive */}
        <div className="flex-1 h-full relative overflow-hidden">
            {renderView()}
        </div>

      </div>
    </div>
  );
};
