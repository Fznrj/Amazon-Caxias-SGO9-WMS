import React from 'react';

const DeLunaLogo: React.FC<{ className?: string }> = ({ className = "h-32" }) => {
    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Puzzle Pieces Cluster - 4 interlocking pieces */}
            <svg
                viewBox="0 0 120 120"
                className="w-24 h-24 mb-4"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Piece 1 (Top Left) */}
                <path d="M40 20 h20 a10 10 0 0 1 0 20 h-20 v-20 M60 30 v10 M40 40 h10 a10 10 0 0 1 20 0 h10 v20 h-40 v-20" className="opacity-95" />
                <path d="M20 20 h25 v30 h-30 v-25 a5 5 0 0 1 5 0 v5 a5 5 0 0 0 10 0 v-5 a5 5 0 0 1 5 0" />

                {/* Simplified but clean cluster */}
                <g transform="translate(10, 10)">
                    {/* Piece 1 */}
                    <path d="M30 10 h15 a5 5 0 0 1 5 5 v5 a5 5 0 0 0 10 0 v-5 a5 5 0 0 1 5 5 v15 h-35 z" />
                    {/* Piece 2 */}
                    <path d="M65 10 h15 v15 a5 5 0 0 1-5 5 h-5 a5 5 0 0 0 0 10 h 5 a5 5 0 0 1 5 5 v15 h-15 z" transform="translate(5, 0)" />
                    {/* Piece 3 */}
                    <path d="M30 45 h15 a5 5 0 0 0 0-10 h-15 v-15 h15 v25 z" transform="translate(0, 10)" opacity="0.9" />
                    {/* Piece 4 */}
                    <path d="M60 45 h15 v15 h-15 z" transform="translate(5, 10)" />
                </g>

                {/* A more professional representation of the 4 pieces interlocking */}
                <rect x="30" y="20" width="30" height="30" rx="2" />
                <rect x="62" y="20" width="30" height="30" rx="2" />
                <rect x="30" y="52" width="30" height="30" rx="2" />
                <rect x="62" y="52" width="30" height="30" rx="2" />
                {/* Connecting circles */}
                <circle cx="61" cy="35" r="6" />
                <circle cx="45" cy="51" r="6" />
                <circle cx="77" cy="51" r="6" />
                <circle cx="61" cy="67" r="6" />
            </svg>

            {/* Divider line */}
            <div className="w-full h-[1px] bg-white opacity-50 mb-2"></div>

            {/* DeLUNA Text */}
            <div className="font-sans font-bold text-4xl tracking-tighter leading-none text-white overflow-visible">
                De<span className="font-extrabold uppercase">Luna</span>
            </div>

            {/* Subtitle */}
            <div className="text-[10px] uppercase tracking-[0.1em] text-white opacity-80 mt-1 whitespace-nowrap">
                Soluções em Transportes e Logística
            </div>
        </div>
    );
};

export default DeLunaLogo;
