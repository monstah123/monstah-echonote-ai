
import React from 'react';
import { Home, Folder, Compass, User, Plus } from 'lucide-react';
import { AppView } from '../types';

interface BottomNavProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onNewNote: () => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 transition-colors touch-manipulation ${isActive ? 'text-brand-blue' : 'text-dark-text-secondary'}`}>
    {icon}
    <span className="text-[10px]">{label}</span>
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setCurrentView, onNewNote }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-14 bg-light-card dark:bg-dark-card flex justify-around items-center border-t border-gray-200/50 dark:border-slate-800 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_15px_rgba(0,0,0,0.2)]">
      <NavItem
        icon={<Home size={20} />}
        label="Home"
        isActive={currentView === AppView.Home}
        onClick={() => setCurrentView(AppView.Home)}
      />
      <NavItem
        icon={<Folder size={20} />}
        label="My Files"
        isActive={currentView === AppView.MyFiles || currentView === AppView.Notes || currentView === AppView.Chat}
        onClick={() => setCurrentView(AppView.MyFiles)}
      />

      <button
        onClick={onNewNote}
        className="bg-brand-blue text-white rounded-full p-3 shadow-lg shadow-brand-blue/40 -translate-y-4 touch-manipulation"
        aria-label="New Note"
      >
        <Plus size={24} />
      </button>

      <NavItem
        icon={<Compass size={20} />}
        label="Explore"
        isActive={currentView === AppView.Explore}
        onClick={() => setCurrentView(AppView.Explore)}
      />
      <NavItem
        icon={<User size={20} />}
        label="Profile"
        isActive={currentView === AppView.Profile}
        onClick={() => setCurrentView(AppView.Profile)}
      />
    </div>
  );
};

export default BottomNav;