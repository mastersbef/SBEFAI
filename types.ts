export enum Sender {
  USER = 'user',
  BOT = 'model'
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: Date;
  isError?: boolean;
  attachment?: string; // Base64 string for images
}

export interface VoiceSettings {
  pitch: number;
  rate: number;
  voiceURI: string | null;
  autoRead: boolean; // New: Auto-read setting
}

export interface Project {
  id: string;
  name: string;
  code: string;
  thumbnail?: string;
  createdAt: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}