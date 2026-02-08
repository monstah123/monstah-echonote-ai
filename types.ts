
export enum AppView {
  Home = 'Home',
  MyFiles = 'MyFiles',
  Notes = 'Notes',
  Chat = 'Chat',
  Explore = 'Explore',
  Profile = 'Profile',
  Scanner = 'Scanner',
}

export interface Note {
  id: number;
  title: string;
  transcript: string;
  summary: string;
  createdAt: Date;
}

export enum MessageSender {
  User = 'user',
  AI = 'ai',
}

export interface ChatMessage {
  sender: MessageSender;
  text: string;
}

export interface UserStats {
  totalTimeSavedMs: number;
  dailyListeningTimeMs: number;
  averageSpeed: number;
  dailyGoalMs: number;
  lastUpdatedDate: string; // to reset daily stats
}
