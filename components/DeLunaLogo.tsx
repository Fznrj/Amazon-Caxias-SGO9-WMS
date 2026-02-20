import React from 'react';

const DeLunaLogo: React.FC<{ className?: string }> = ({ className = "w-full max-w-[280px]" }) => {
    return (
        <div className={`flex flex-col items-center justify-center ${className} select-none`}>
            {/* 4 Interlocking Puzzle Pieces SVG - Pixel-Perfect Recreation */}
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
                    {/* Piece 1: Top Left - Tilted ~15 degrees clockwise */}
                    <g transform="translate(23.5, 23.5) rotate(-15) translate(-23.5, -23.5)">
                        <rect x="8" y="8" width="31" height="31" rx="3" fill="white" />
                        <circle cx="39" cy="23.5" r="7" fill="white" />
                        <circle cx="23.5" cy="39" r="7" fill="white" />
                    </g>

                    {/* Piece 2: Top Right */}
                    <g mask="url(#mask-p2-tab)">
                        <rect x="43" y="8" width="31" height="31" rx="3" fill="white" />
                        <circle cx="58.5" cy="39" r="7" fill="white" />
                    </g>

                    {/* Piece 3: Bottom Left */}
                    <g mask="url(#mask-p3-tab)">
                        <rect x="8" y="43" width="31" height="31" rx="3" fill="white" />
                        <circle cx="39" cy="58.5" r="7" fill="white" />
                    </g>

                    {/* Piece 4: Bottom Right */}
                    <g mask="url(#mask-p4-tab)">
                        <rect x="43" y="43" width="31" height="31" rx="3" fill="white" />
                    </g>
                </g>
            </svg>

            {/* Horizontal Divider Line */}
            <div className="w-full h-[1.5px] bg-white mb-6"></div>

            {/* DeLUNA Text - Typography Precision */}
            <div className="flex items-baseline mb-1">
                {/* font-extralight/thin for "De" */}
                <span className="text-white text-7xl font-light tracking-tighter leading-none">De</span>
                {/* font-black for "LUNA" with stylized 'Λ' */}
                <div className="flex items-baseline ml-1">
                    <span className="text-white text-7xl font-black tracking-tight uppercase leading-none">L</span>
                    <span className="text-white text-7xl font-black tracking-tight uppercase leading-none">U</span>
                    <span className="text-white text-7xl font-black tracking-tight uppercase leading-none">N</span>
                    {/* Stylized 'A' as '^' (caret) shape */}
                    <span className="text-white text-7xl font-black tracking-tight uppercase leading-none relative -top-[2px]">
                        <svg width="48" height="64" viewBox="0 0 48 64" fill="white" className="inline-block transform translate-y-[12px]">
                            <path d="M4 60 L24 4 L44 60 L32 60 L24 36 L16 60 Z" fill="none" /> {/* Standard A for reference in thought */}
                            <path d="M4 60 L24 4 L44 60" stroke="white" strokeWidth="10" fill="none" strokeLinecap="square" />
                        </svg>
                    </span>
                </div>
            </div>

            {/* Subtitle */}
            <div className="text-[15px] font-bold uppercase tracking-[0.3em] text-white text-center leading-relaxed mt-2">
                Soluções em Transportes e Logística
            </div>
        </div>
    );
};

export default DeLunaLogo;
