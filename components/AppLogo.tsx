import React from 'react';

const AppLogo: React.FC = () => {
    return (
        <div className="flex items-center gap-2 select-none">
            {/* Animated Logo Container */}
            <div className="relative flex items-center justify-center w-10 h-10">
                {/* Pulsing Wave Effect */}
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-20 animate-ping"></span>

                {/* Logo Body */}
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-purple-600 shadow-lg shadow-brand-blue/30 overflow-hidden transform transition-transform hover:scale-105 active:scale-95">
                    {/* The "M" - stylized using SVG paths to look sharp */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-md">
                        <path d="M4 20V8L12 14L20 8V20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* Inner sheen/gloss effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/20 pointer-events-none"></div>
                </div>
            </div>

            {/* App Name */}
            <div className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]">
                    MONSTAH
                </span>
                <span className="text-xs font-bold tracking-widest text-light-text-secondary dark:text-gray-400 uppercase opacity-90">
                    ECHO AI
                </span>
            </div>
        </div>
    );
};

export default AppLogo;
