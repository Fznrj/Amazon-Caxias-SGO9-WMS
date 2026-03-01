import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSaoPauloDateString } from '../utils/dateUtils';

interface DateContextValue {
    brToday: string; // YYYY-MM-DD
    brMonth: string; // YYYY-MM
    brYear: string;  // YYYY
    isSameDay: (dateString: string | Date | null | undefined) => boolean;
    getIsoNow: () => string;
    getBrTimeFromDate: (dateString: string | Date | null | undefined) => string;
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

    const getIsoNow = () => {
        const d = new Date();
        d.setUTCHours(d.getUTCHours() - 3);
        return d.toISOString().replace('Z', '-03:00');
    };

    const getBrTimeFromDate = (dateString: string | Date | null | undefined) => {
        return getSaoPauloDateString(dateString);
    };

    return (
        <DateContext.Provider value={{ brToday, brMonth, brYear, isSameDay, getIsoNow, getBrTimeFromDate }}>
            {children}
        </DateContext.Provider>
    );
};
