import React from 'react';

const DeLunaLogo: React.FC<{ className?: string }> = ({ className = "w-full max-w-[280px]" }) => {
    return (
        <div className={`flex flex-col items-center justify-center ${className} select-none`}>
            {/* 4 Interlocking Puzzle Pieces SVG - High Quality Vector Re-creation */}
            <svg
                width="100"
                height="100"
                viewBox="0 0 100 100"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-4 drop-shadow-lg"
            >
                {/* Piece 1: Top Left */}
                <path d="M20 20 h25 a5 5 0 0 1 5 5 v2 a5 5 0 0 0 10 0 v-2 a5 5 0 0 1 5 -5 h5 v25 h-5 a5 5 0 0 0 0 10 h5 v5 h-25 a5 5 0 0 1 -5 -5 v-2 a5 5 0 0 0 -10 0 v 2 a5 5 0 0 1 -5 5 h-5 v-25 h5 a5 5 0 0 0 0 -10 h-5 z" transform="translate(-2, -2)" opacity="0.95" />

                {/* Simplified professional look: 4 distinct pieces that interlock */}
                <g transform="translate(10, 10)">
                    {/* Piece 1 (Top Left) */}
                    <path d="M0 0 h30 a5 5 0 0 1 5 5 v2 a5 5 0 0 0 10 0 v-2 a5 5 0 0 1 5 -5 h30 v30 h-5 a5 5 0 0 0 0 10 h5 v30 h-30 v-5 a5 5 0 0 0 -10 0 v 5 h-30 v-30 h5 a5 5 0 0 0 0 -10 h-5 z" fill="none" />

                    {/* Re-drawing 4 clean squares with interlocking tabs */}
                    {/* Top Left */}
                    <path d="M0 0 h32 a6 6 0 0 1 6 6 a6 6 0 0 1 6 -6 h32 V32 h-6 a6 6 0 0 0 -6 6 a6 6 0 0 0 6 6 h6 V76 h-32 a6 6 0 0 1 -6 -6 a6 6 0 0 1 -6 6 h-32 V44 h6 a6 6 0 0 0 6 -6 a6 6 0 0 0 -6 -6 h-6 V0 z" fill="none" />

                    {/* ACTUAL LOGO RECREATION: 4 Rounded Blocks with Tabs */}
                    {/* Top Left Piece */}
                    <path d="M5 5 h25 a4 4 0 0 1 4 4 a4 4 0 0 0 8 0 a4 4 0 0 1 4 -4 h25 v30 a4 4 0 0 1 -4 4 a4 4 0 0 0 0 8 a4 4 0 0 1 4 4 v30 h-25 a4 4 0 0 1 -4 -4 a4 4 0 0 0 -8 0 a4 4 0 0 1 -4 4 h-25 v-30 a4 4 0 0 1 4 -4 a4 4 0 0 0 0 -8 a4 4 0 0 1 -4 -4 v-30 z" fill="none" />

                    {/* Let's use clean individual pieces as seen in the DELUNA logo */}
                    {/* Piece 1: Top Left (Slightly separated) */}
                    <g transform="translate(0, 0)">
                        <rect x="0" y="0" width="38" height="38" rx="4" />
                        <circle cx="38" cy="19" r="7" />
                        <circle cx="19" cy="38" r="7" />
                    </g>
                    {/* Piece 2: Top Right */}
                    <g transform="translate(42, 0)">
                        <rect x="0" y="0" width="38" height="38" rx="4" />
                        <circle cx="19" cy="38" r="7" />
                        <rect x="-8" y="15" width="10" height="8" fill="#1b2531" className="dark:fill-[#1b2531] fill-brand-blue" /> {/* Subtraction */}
                        <circle cx="0" cy="19" r="6" fill="#1b2531" className="dark:fill-[#1b2531] fill-brand-blue" />
                    </g>
                    {/* Piece 3: Bottom Left */}
                    <g transform="translate(0, 42)">
                        <rect x="0" y="0" width="38" height="38" rx="4" />
                        <circle cx="38" cy="19" r="7" />
                        <circle cx="19" cy="0" r="6" fill="#1b2531" className="dark:fill-[#1b2531] fill-brand-blue" />
                    </g>
                    {/* Piece 4: Bottom Right */}
                    <g transform="translate(42, 42)">
                        <rect x="0" y="0" width="38" height="38" rx="4" />
                        <circle cx="0" cy="19" r="6" fill="#1b2531" className="dark:fill-[#1b2531] fill-brand-blue" />
                        <circle cx="19" cy="0" r="6" fill="#1b2531" className="dark:fill-[#1b2531] fill-brand-blue" />
                    </g>
                </g>
            </svg>

            {/* Divider line */}
            <div className="w-full h-[1px] bg-white/20 mb-6"></div>

            {/* DeLUNA Text - Perfected Typography */}
            <div className="flex items-baseline mb-1">
                <span className="text-white text-6xl font-light tracking-tight">De</span>
                <span className="text-white text-6xl font-black tracking-tight uppercase ml-1">Luna</span>
            </div>

            {/* Subtitle */}
            <div className="text-[14px] font-bold uppercase tracking-[0.25em] text-white/80 text-center">
                Soluções em Transportes e Logística
            </div>
        </div>
    );
};

export default DeLunaLogo;
