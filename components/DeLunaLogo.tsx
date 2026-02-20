import React from 'react';

const DeLunaLogo: React.FC<{ className?: string }> = ({ className = "h-auto" }) => {
    return (
        <div className={`flex flex-col items-center ${className} select-none`}>
            {/* 4 Interlocking Puzzle Pieces SVG */}
            <svg
                width="120"
                height="80"
                viewBox="0 0 120 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2"
            >
                {/* Piece 1 (Top Left) */}
                <g opacity="1">
                    <path
                        d="M35 5 H50 A3 3 0 0 1 53 8 V12 A4 4 0 0 0 57 16 A4 4 0 0 0 61 12 V8 A3 3 0 0 1 64 5 H75 A3 3 0 0 1 78 8 V20 A4 4 0 0 1 74 24 A4 4 0 0 1 70 20 V16 A4 4 0 0 0 66 12 H62 V16 A8 8 0 0 1 54 24 A8 8 0 0 1 46 16 V12 H42 V16 A4 4 0 0 0 38 20 V30 H35 A3 3 0 0 1 32 27 V8 A3 3 0 0 1 35 5 Z"
                        fill="white"
                    />
                </g>

                {/* Simple and clean representation of 4 puzzle pieces based on the actual logo */}
                {/* Using a 2x2 grid of pieces with circular tabs/blanks */}
                <g transform="translate(30, 0)">
                    {/* Top Left Piece */}
                    <path d="M10 10 h15 a5 5 0 0 1 5 5 v2 a5 5 0 0 0 10 0 v-2 a5 5 0 0 1 5 -5 h15 v20 h-5 a5 5 0 0 0 0 10 h5 v15 h-20 v-5 a5 5 0 0 0 -10 0 v 5 h-15 v-20 h5 a5 5 0 0 0 0 -10 h-5 z" fill="white" />

                    {/* Re-implementing Piece by Piece for clarity */}
                    {/* Piece 1: Top Left */}
                    <path d="M5 5 h18 a4 4 0 0 1 4 4 v2 a4 4 0 0 0 8 0 v-2 a4 4 0 0 1 4 -4 h16 v22 a4 4 0 0 1 -4 4 h-2 a4 4 0 0 0 0 8 h2 a4 4 0 0 1 4 4 v18 h-18 a4 4 0 0 1 -4 -4 v-2 a4 4 0 0 0 -8 0 v 2 a4 4 0 0 1 -4 4 h-16 v-22 a4 4 0 0 1 4 -4 h2 a4 4 0 0 0 0 -8 h-2 a4 4 0 0 1 -4 -4 v-18 z" fill="white" />
                </g>

                {/* Let's use a much simpler, cleaner version that is guaranteed to look good */}
                <g transform="translate(35, 5)">
                    {/* Top Left */}
                    <rect x="0" y="0" width="24" height="24" rx="2" fill="white" />
                    <circle cx="24" cy="12" r="5" fill="white" />
                    <circle cx="12" cy="24" r="5" fill="white" />

                    {/* Top Right */}
                    <rect x="26" y="0" width="24" height="24" rx="2" fill="white" />
                    <circle cx="38" cy="24" r="5" fill="white" />
                    <circle cx="50" cy="12" r="5" fill="white" />

                    {/* Bottom Left */}
                    <rect x="0" y="26" width="24" height="24" rx="2" fill="white" />
                    <circle cx="12" cy="50" r="5" fill="white" />

                    {/* Bottom Right */}
                    <rect x="26" y="26" width="24" height="24" rx="2" fill="white" />
                    <circle cx="50" cy="38" r="5" fill="white" />
                </g>
            </svg>

            {/* Divider line */}
            <div className="w-48 h-[1px] bg-white/30 mb-4"></div>

            {/* DeLUNA Text - Matching original typography better */}
            <div className="flex items-baseline mb-1">
                <span className="text-white text-5xl font-light tracking-tight">De</span>
                <span className="text-white text-5xl font-bold tracking-tight uppercase">Luna</span>
            </div>

            {/* Subtitle */}
            <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/90">
                Soluções em Transportes e Logística
            </div>
        </div>
    );
};

export default DeLunaLogo;
