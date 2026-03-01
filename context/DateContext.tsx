import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSaoPauloDateString } from '../utils/dateUtils';

interface DateContextValue {
    brToday: string; // YYYY-MM-DD
    brMonth: string; // YYYY-MM
    brYear: string;  // YYYY
    isSameDay: (dateString: string | Date | null | undefined) => boolean;
}

const DateContext = createContext<DateContextValue>({} as DateContextValue);

export const useDate = () => useContext(DateContext);

export const DateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [brToday, setBrToday] = useState(getSaoPauloDateString(new Date()));

    useEffect(() => {
        const interval = setInterval(() => {
            const current = getSaoPauloDateString(new Date());
            if (current !== brToday) {
                setBrToday(current);
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [brToday]);

    const brMonth = brToday.substring(0, 7);
    const brYear = brToday.substring(0, 4);

    const isSameDay = (dateString: string | Date | null | undefined) => {
        if (!dateString) return false;
        const spDate = getSaoPauloDateString(dateString);
        return spDate === brToday;
    };

    return (
        <DateContext.Provider value={{ brToday, brMonth, brYear, isSameDay }}>
            {children}
        </DateContext.Provider>
    );
};
