import React from 'react';

const DeLunaLogo: React.FC<{ className?: string }> = ({ className = "h-24" }) => {
    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Puzzle Pieces Cluster */}
            <svg
                viewBox="0 0 100 100"
                className="w-1/2 mb-2"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Simplified Puzzle Pieces Clusters based on the logo shape */}
                <path d="M25 15h20v20H25z" /> {/* Piece 1 */}
                <path d="M50 15h20v20H50z" /> {/* Piece 2 */}
                <path d="M35 40h20v20H35z" /> {/* Piece 3 */}
                <path d="M60 40h20v20H60z" /> {/* Piece 4 */}
                {/* Adding circles to simulate puzzle interconnects */}
                <circle cx="45" cy="25" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="50" cy="25" r="5" />
                <circle cx="45" cy="50" r="5" />
                <circle cx="70" cy="50" r="5" />
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
