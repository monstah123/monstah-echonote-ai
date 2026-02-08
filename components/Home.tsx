
import React from 'react';
import AppLogo from './AppLogo';
import { Note } from '../types';
import { Sun, Moon, File, Scan, Type, Link, Plus, Headphones, PauseCircle, User, Droplet, PlayCircle } from 'lucide-react';

interface HomeProps {
    isDarkMode: boolean;
    onNewNote: () => void;
    toggleTheme: () => void;
    onFileImport: (file: File) => void;
    onStartScan: () => void;
    recentNote?: Note;
    onOpenNote?: (note: Note) => void;
}



const ImportIcon: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex flex-col items-center space-y-2 text-light-text-secondary dark:dark-text-secondary">
        <div className="bg-light-bg dark:bg-black/20 p-3 rounded-full">{icon}</div>
        <span className="text-xs font-medium">{label}</span>
    </div>
);

const DisabledIcon: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex flex-col items-center space-y-2 text-light-text-secondary/50 dark:dark-text-secondary/50 cursor-not-allowed" title="Coming Soon">
        <div className="bg-light-bg dark:bg-black/20 p-3 rounded-full opacity-50 relative">
            {icon}
            <span className="absolute -top-1 -right-1 bg-brand-blue text-white text-[8px] px-1 rounded-full">Soon</span>
        </div>
        <span className="text-xs font-medium opacity-50">{label}</span>
    </div>
);

const FileInputIcon: React.FC<{ icon: React.ReactNode; label: string; onFileSelect: (file: File) => void; accept?: string }> = ({ icon, label, onFileSelect, accept = "audio/*,video/*,.txt,.md,.pdf,.doc,.docx" }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const handleIconClick = () => inputRef.current?.click();
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onFileSelect(event.target.files[0]);
            // Reset the input value to allow selecting the same file again
            event.target.value = '';
        }
    };
    return (
        <div onClick={handleIconClick} className="flex flex-col items-center space-y-2 text-light-text-secondary dark:dark-text-secondary cursor-pointer" title="Import file for transcription">
            <input type="file" ref={inputRef} onChange={handleFileChange} className="hidden" accept={accept} />
            <div className="bg-light-bg dark:bg-black/20 p-3 rounded-full">{icon}</div>
            <span className="text-xs font-medium">{label}</span>
        </div>
    );
};


// Dummy icons for GDrive, Kindle, Gmail for visual representation
const GDriveIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24"><path fill="#fbbc05" d="M10.32,8.85,15.6,17.42,19.35,11.2,12,0Z" /><path fill="#34a853" d="M5.65,17.42,12,24,15.6,17.42Z" /><path fill="#4285f4" d="M0,8.85,5.65,17.42,8.47,12.7,2.82,4.12Z" /></svg>;
const KindleIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24"><path fill="currentColor" d="M17.25,18H11.5V6H17.25M15.5,7.75H13.25V16.25H15.5M6.5,6H9.75V18H6.5Z" /></svg>;
const GmailIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24"><path fill="#ea4335" d="M5,20.5V11L12,5.5L19,11V20.5H5Z" /><path fill="#c5221f" d="M19,20.5V11L12,16.5L5,11V20.5H19Z" /><path fill="#4285f4" d="M5,9,12,3.5,19,9,12,14.5Z" /></svg>;


const Home: React.FC<HomeProps> = ({ isDarkMode, onNewNote, toggleTheme, onFileImport, onStartScan, recentNote, onOpenNote }) => {
    return (
        <div className="flex flex-col space-y-6 h-full overflow-y-auto pb-16 px-4">
            <header className="flex justify-between items-center pt-2 pb-2">
                <AppLogo />
                <button onClick={toggleTheme} className="p-2 rounded-full bg-light-card dark:bg-dark-card shadow-sm">
                    {isDarkMode ? <Moon size={20} className="text-white" /> : <Sun size={20} className="text-yellow-500" />}
                </button>
            </header>

            <section className="flex gap-4">
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-3xl shadow-sm flex-1">
                    <p className="text-3xl font-bold text-light-text dark:text-dark-text">5.6h</p>
                    <p className="text-sm text-light-text-secondary dark:dark-text-secondary mt-1">Time Saved</p>
                    <p className="text-xs text-light-text-secondary dark:dark-text-secondary mt-2">
                        You're saving time thanks to <span className="text-green-400 font-semibold">1.4x average speed</span>
                    </p>
                </div>
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-3xl shadow-sm flex-1">
                    <div className="flex justify-between items-start">
                        <p className="text-3xl font-bold text-light-text dark:text-dark-text">2h 32m</p>
                        <Droplet className="text-blue-500" size={20} />
                    </div>
                    <p className="text-sm text-light-text-secondary dark:dark-text-secondary mt-1">Daily goal: 40m</p>
                    <p className="text-xs text-light-text-secondary dark:dark-text-secondary mt-2">Yesterday: 1h 12m</p>
                </div>
            </section>

            <section className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 p-5 rounded-3xl text-white flex items-center justify-between min-h-[140px] relative">
                <div className="z-10 flex-1">
                    <h2 className="font-bold text-lg max-w-[180px] leading-tight">Listen with the most advanced AI voices available</h2>
                    <button className="bg-white/20 backdrop-blur-sm text-white font-semibold py-1.5 px-4 rounded-lg text-sm mt-3 transition-transform hover:scale-105">Try Now &rarr;</button>
                </div>
                <div className="relative w-28 h-28 flex-shrink-0">
                    <div className="absolute top-0 right-6 w-12 h-12 rounded-full border-2 border-white/30 bg-cover bg-center" style={{ backgroundImage: "url('https://randomuser.me/api/portraits/women/75.jpg')" }}></div>
                    <div className="absolute top-6 right-0 w-14 h-14 rounded-full border-2 border-white/30 bg-cover bg-center" style={{ backgroundImage: "url('https://randomuser.me/api/portraits/men/75.jpg')" }}>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-pink-500 rounded-full flex items-center justify-center border-2 border-purple-700">
                            <Headphones size={14} className="text-white" />
                        </div>
                    </div>
                    <div className="absolute top-16 right-8 w-10 h-10 rounded-full border-2 border-white/30 bg-cover bg-center" style={{ backgroundImage: "url('https://randomuser.me/api/portraits/women/76.jpg')" }}></div>
                </div>
            </section>

            <section>
                <h3 className="font-bold mb-4 text-light-text dark:text-dark-text-secondary">Import & Listen</h3>
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-3xl shadow-sm">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <FileInputIcon icon={<File size={20} className="text-blue-400" />} label="Files" onFileSelect={onFileImport} />
                        <DisabledIcon icon={<GDriveIcon size={20} />} label="GDrive" />
                        <DisabledIcon icon={<KindleIcon size={20} className="text-light-text-secondary dark:dark-text-secondary" />} label="Kindle" />
                        <DisabledIcon icon={<GmailIcon size={20} />} label="Gmail" />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div onClick={onStartScan} className="cursor-pointer">
                            <ImportIcon icon={<Scan size={20} className="text-brand-blue" />} label="Scan" />
                        </div>
                        <div onClick={onNewNote} className="cursor-pointer">
                            <ImportIcon icon={<Type size={20} className="text-light-text-secondary dark:dark-text-secondary" />} label="Type" />
                        </div>
                        <ImportIcon icon={<Link size={20} className="text-light-text-secondary dark:dark-text-secondary" />} label="Link" />
                        <ImportIcon icon={<Plus size={20} className="text-light-text-secondary dark:dark-text-secondary" />} label="More" />
                    </div>
                </div>
            </section>

            {recentNote ? (
                <section>
                    <h3 className="font-bold mb-4 text-light-text dark:text-dark-text-secondary">Continue Listening</h3>
                    <div onClick={() => onOpenNote && onOpenNote(recentNote)} className="bg-light-card dark:bg-dark-card p-3 rounded-3xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                        <div className="w-12 h-12 bg-brand-blue/10 dark:bg-slate-700 rounded-xl flex-shrink-0 flex items-center justify-center">
                            <PlayCircle size={24} className="text-brand-blue" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold text-sm truncate text-light-text dark:text-dark-text">{recentNote.title}</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {recentNote.createdAt ? new Date(recentNote.createdAt).toLocaleDateString() : 'Recent'} • Tap to resume
                            </p>
                        </div>
                    </div>
                </section>
            ) : (
                <section>
                    <h3 className="font-bold mb-4 text-light-text dark:text-dark-text-secondary">Get Started</h3>
                    <div onClick={onNewNote} className="bg-light-card dark:bg-dark-card p-3 rounded-3xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                        <div className="w-12 h-12 bg-gray-200 dark:bg-slate-700 rounded-xl flex-shrink-0 flex items-center justify-center">
                            <Plus size={24} className="text-light-text-secondary dark:text-dark-text-secondary" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold text-sm truncate text-light-text dark:text-dark-text">Start your first note</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Create text to listen to</p>
                        </div>
                    </div>
                </section>
            )}

            <section className="mt-8 pb-4">
                <h3 className="font-bold mb-4 text-light-text dark:text-dark-text-secondary">Explore</h3>
                <div className="space-y-3">
                    <div onClick={() => onOpenNote && onOpenNote({ id: -1, title: 'Welcome to Monstah EchoAI!', transcript: 'Welcome to Monstah EchoAI! 🚀\n\nThis app transforms your text into lifelike speech.\n\nTry highlighting text to see the karaoke effect, or use the Scan feature to read physical documents.\n\nEnjoy the journey!', summary: 'A quick intro to the app.', createdAt: new Date() })} className="bg-light-card dark:bg-dark-card p-3 rounded-3xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                        <div className="w-12 h-12 bg-lime-400/20 dark:bg-lime-900/40 rounded-xl flex-shrink-0 flex items-center justify-center">
                            <span className="text-xl">👋</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold text-sm truncate text-light-text dark:text-dark-text">Welcome to EchoAI</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Get started smoothly</p>
                        </div>
                    </div>

                    <div onClick={() => onOpenNote && onOpenNote({ id: -2, title: 'Atomic Habits (Excerpt)', transcript: 'Changes that seem small and unimportant at first will compound into remarkable results if you act on them consistently.\n\nWe all deal with setbacks, but in the long run, the quality of our lives often depends on the quality of our habits.', summary: 'The power of small habits.', createdAt: new Date() })} className="bg-light-card dark:bg-dark-card p-3 rounded-3xl shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                        <div className="w-12 h-12 bg-purple-400/20 dark:bg-purple-900/40 rounded-xl flex-shrink-0 flex items-center justify-center">
                            <span className="text-xl">📚</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold text-sm truncate text-light-text dark:text-dark-text">Atomic Habits (Excerpt)</p>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Productivity & Growth</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
