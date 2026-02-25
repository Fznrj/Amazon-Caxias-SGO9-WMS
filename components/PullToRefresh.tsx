import React, { useState, useEffect, useCallback, useRef } from 'react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    className?: string;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, className = "" }) => {
    const [refreshing, setRefreshing] = useState(false);
    const [startY, setStartY] = useState(0);
    const [pullDistance, setPullDistance] = useState(0);
    const REFRESH_THRESHOLD = 80;
    const MAX_PULL = 150;

    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Only trigger if we are at the top of the scroll
        const scrollNode = containerRef.current;
        if (scrollNode && scrollNode.scrollTop === 0) {
            setStartY(e.touches[0].pageY);
        } else {
            setStartY(0);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY === 0 || refreshing) return;

        const currentY = e.touches[0].pageY;
        const diff = currentY - startY;

        if (diff > 0) {
            // We are pulling down
            const cappedDiff = Math.min(diff * 0.5, MAX_PULL); // Resistência
            setPullDistance(cappedDiff);

            // Prevent scroll if pulling
            if (diff > 10 && e.cancelable) {
                e.preventDefault();
            }
        }
    };

    const handleTouchEnd = async () => {
        if (pullDistance >= REFRESH_THRESHOLD && !refreshing) {
            setRefreshing(true);
            setPullDistance(REFRESH_THRESHOLD);
            try {
                await onRefresh();
            } finally {
                setRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
        setStartY(0);
    };

    return (
        <div
            ref={containerRef}
            className={`relative overflow-y-auto h-full ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Loading Indicator */}
            {(pullDistance > 0 || refreshing) && (
                <div
                    className="absolute left-0 right-0 z-50 flex justify-center pointer-events-none"
                    style={{
                        top: refreshing ? '20px' : `${pullDistance - 40}px`,
                        opacity: Math.min(pullDistance / REFRESH_THRESHOLD, 1),
                        transition: refreshing ? 'top 0.2s ease-out' : 'none'
                    }}
                >
                    <div className="bg-white dark:bg-card-dark rounded-full p-2 shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                        <div className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
                            style={{ transform: !refreshing ? `rotate(${pullDistance * 2}deg)` : 'none' }}>
                        </div>
                    </div>
                </div>
            )}

            <div
                style={{
                    transform: pullDistance > 0 ? `translateY(${pullDistance * 0.6}px)` : 'none',
                    transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default PullToRefresh;
