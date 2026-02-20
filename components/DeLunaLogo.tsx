import React from 'react';

const DeLunaLogo: React.FC<{ className?: string }> = ({ className = "w-full max-w-[280px]" }) => {
    return (
        <div className={`flex flex-col items-center justify-center ${className} select-none`}>
            {/* 4 Interlocking Puzzle Pieces SVG - High Quality Vector with Genuine Transparency */}
            <svg
                width="100"
                height="100"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-4 drop-shadow-xl"
            >
                <defs>
                    {/* Mask for Piece 2 Tab Hole */}
                    <mask id="mask-p2-tab">
                        <rect x="0" y="0" width="100" height="100" fill="white" />
                        <circle cx="48" cy="27" r="7" fill="black" />
                    </mask>
                    {/* Mask for Piece 3 Tab Hole */}
                    <mask id="mask-p3-tab">
                        <rect x="0" y="0" width="100" height="100" fill="white" />
                        <circle cx="27" cy="48" r="7" fill="black" />
                    </mask>
                    {/* Mask for Piece 4 Tab Holes */}
                    <mask id="mask-p4-tab">
                        <rect x="0" y="0" width="100" height="100" fill="white" />
                        <circle cx="69" cy="48" r="7" fill="black" />
                        <circle cx="48" cy="69" r="7" fill="black" />
                    </mask>
                </defs>

                <g transform="translate(10, 10)">
                    {/* Piece 1: Top Left - Base + 2 Tabs */}
                    <g>
                        <rect x="8" y="8" width="31" height="31" rx="3" fill="white" />
                        <circle cx="39" cy="23.5" r="7" fill="white" />
                        <circle cx="23.5" cy="39" r="7" fill="white" />
                    </g>

                    {/* Piece 2: Top Right - Base + 1 Tab - 1 Hole */}
                    <g mask="url(#mask-p2-tab)">
                        <rect x="43" y="8" width="31" height="31" rx="3" fill="white" />
                        <circle cx="58.5" cy="39" r="7" fill="white" />
                    </g>

                    {/* Piece 3: Bottom Left - Base + 1 Tab - 1 Hole */}
                    <g mask="url(#mask-p3-tab)">
                        <rect x="8" y="43" width="31" height="31" rx="3" fill="white" />
                        <circle cx="39" cy="58.5" r="7" fill="white" />
                    </g>

                    {/* Piece 4: Bottom Right - Base - 2 Holes */}
                    <g mask="url(#mask-p4-tab)">
                        <rect x="43" y="43" width="31" height="31" rx="3" fill="white" />
                    </g>
                </g>
            </svg>

            {/* Divider line */}
            <div className="w-full h-[1px] bg-white/20 mb-6"></div>

            {/* DeLUNA Text - Perfected Typography */}
            <div className="flex items-baseline mb-1">
                <span className="text-white text-6xl font-light tracking-tight leading-none">De</span>
                <span className="text-white text-6xl font-black tracking-tight uppercase leading-none ml-1">Luna</span>
            </div>

            {/* Subtitle */}
            <div className="text-[14px] font-bold uppercase tracking-[0.25em] text-white/80 text-center leading-relaxed">
                Soluções em Transportes e Logística
            </div>
        </div>
    );
};

export default DeLunaLogo;
