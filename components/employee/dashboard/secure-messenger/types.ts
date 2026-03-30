export interface EncryptedMessage {
    id: string;
    content: string; // Encrypted content
    sender: 'me' | 'other';
    timestamp: number;
    ttl: number; // Time to live in seconds
    iv: string;
  }
  
  export interface SecureNote {
    id: string;
    content: string; // Encrypted
    iv: string;
    createdAt: number;
    destroyed: boolean;
  }
  
  export type MessengerView = 'MENU' | 'CHAT_LOBBY' | 'CHAT_ROOM' | 'NOTE_CREATE' | 'NOTE_READ_模拟' | 'NOTE_RESULT';
  
  // Simulated backend storage for demo purposes
  export const MOCK_STORAGE_KEY = 'ebs_secure_notes_demo';
