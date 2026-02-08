import React from 'react';

const AppLogo: React.FC = () => {
    return (
        <div className="flex items-center gap-2 select-none">
            {/* Animated Logo Container */}
            <div className="relative flex items-center justify-center w-10 h-10">
                {/* Pulsing Wave Effect */}
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-20 animate-ping"></span>

                {/* Logo Body with Brighter Gradient */}
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-brand-blue to-purple-600 shadow-lg shadow-brand-blue/50 overflow-hidden transform transition-transform hover:scale-105 active:scale-95 border border-white/10">
                    {/* The "M" - stylized using SVG paths to look sharp */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] z-10">
                        <path d="M4 20V8L12 14L20 8V20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* Stronger Inner Sheen/Gloss Effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-white/60 pointer-events-none mix-blend-overlay"></div>
                </div>
            </div>

            {/* App Name */}
            <div className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-lime-400 to-green-400 drop-shadow-[0_0_10px_rgba(163,230,53,0.6)]">
                    MONSTAH!!!
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-gray-400 uppercase opacity-90 pl-0.5">
                    ECHO AI
                </span>
            </div>
        </div>
    );
};

export default AppLogo;
