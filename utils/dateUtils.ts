/**
 * Utility to get the "current" date, supporting an optional offset for debugging/testing.
 * Set localStorage.setItem('debug_date_offset', '1') for tomorrow, '-1' for yesterday, etc.
 */
export const getTodayDate = (): Date => {
    const now = new Date();
    try {
        const offset = localStorage.getItem('debug_date_offset');
        if (offset) {
            const days = parseInt(offset, 10);
            if (!isNaN(days)) {
                const target = new Date(now);
                target.setDate(now.getDate() + days);
                return target;
            }
        }

        const fixed = localStorage.getItem('debug_fixed_date');
        if (fixed) {
            return new Date(fixed);
        }
    } catch (e) {
        // Silently fail if localStorage is not accessible
    }
    return now;
};

/**
 * Returns the date (YYYY-MM-DD) in America/Sao_Paulo timezone.
 */
export const getSaoPauloDate = (date: Date = getTodayDate()): string => {
    try {
        if (!date || isNaN(date.getTime())) return '';
        return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
        console.error('dateUtils: Error in getSaoPauloDate', e);
        return '';
    }
};

/**
 * Convenience alias for getting a strict YYYY-MM-DD string in SP timezone
 * Accepts either a Date object or a string to parse.
 */
export const getSaoPauloDateString = (dateVal: Date | string | null | undefined): string => {
    try {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        d.setHours(d.getHours() - 3); // Força o recuo para o dia civil de Brasília
        return d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

/**
 * Robustly parses a date string that might be in ISO format or a localized pt-BR string.
 */
export const parseToDate = (dateStr: string): Date => {
    if (!dateStr) return getTodayDate();

    try {
        // Case 1: ISO String (YYYY-MM-DDTHH:mm:ss...)
        if (dateStr.includes('T')) {
            return new Date(dateStr);
        }

        // Case 2: Local string "DD/MM/YYYY, HH:MM:SS" or "DD/MM/YYYY HH:MM:SS"
        if (dateStr.includes('/')) {
            const parts = dateStr.split(/[\s,]+/);
            const [d, m, y] = parts[0].split('/');

            // We assume these local strings were created in America/Sao_Paulo
            // So we reconstruct them and then adjust for the offset to get a correct Date object
            if (parts[1]) {
                const [h, min, s] = parts[1].split(':');
                return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${(s || '00').padStart(2, '0')}-03:00`);
            }

            return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00-03:00`);
        }
        // Case 3: YYYY-MM-DD format (often from DB views) - Force to SP timezone
        if (dateStr.length === 10 && dateStr.charAt(4) === '-' && dateStr.charAt(7) === '-') {
            return new Date(`${dateStr}T12:00:00-03:00`);
        }
    } catch (e) {
        console.error('dateUtils: Error parsing date', dateStr, e);
    }

    return new Date(dateStr);
};

/**
 * Checks if a date string refers to the same day as the reference date (Today in SP),
 * correctly forcing America/Sao_Paulo comparison.
 */
export const isSameDay = (dateStr: string, referenceDate: Date = getTodayDate()): boolean => {
    try {
        if (!dateStr) return false;
        const date = parseToDate(dateStr);
        if (!date || isNaN(date.getTime()) || !referenceDate || isNaN(referenceDate.getTime())) return false;
        
        const spDate = getSaoPauloDate(date);
        const spRef = getSaoPauloDate(referenceDate);
        return spDate === spRef && spDate !== '';
    } catch (e) {
        return false;
    }
};

/**
 * Formats an ISO string or localized string to HH:mm (America/Sao_Paulo Time)
 */
export const formatToLocalTime = (dateStr: string): string => {
    try {
        if (!dateStr) return '--:--';
        const date = parseToDate(dateStr);
        if (!date || isNaN(date.getTime())) return '--:--';

        return date.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return '--:--';
    }
};

/**
 * Formats an ISO string or localized string to DD/MM/YYYY (America/Sao_Paulo Time)
 */
export const formatToLocalDate = (dateStr: string): string => {
    try {
        if (!dateStr) return '--/--/----';
        const date = parseToDate(dateStr);
        if (!date || isNaN(date.getTime())) return '--/--/----';

        return date.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo'
        });
    } catch (e) {
        return '--/--/----';
    }
};

/**
 * Normalizes any date string into a pt-BR date key for grouping (e.g. "21/02/2026")
 * always relative to America/Sao_Paulo.
 */
export const getDateKey = (dateStr: string): string => {
    try {
        if (!dateStr) return 'invalid';
        const date = parseToDate(dateStr);
        if (!date || isNaN(date.getTime())) return 'invalid';

        const spDate = getSaoPauloDate(date); // YYYY-MM-DD
        if (!spDate) return 'invalid';
        
        const [y, m, d] = spDate.split('-');
        return `${d}/${m}/${y}`;
    } catch (e) {
        return 'invalid';
    }
};

/**
 * Returns a full ISO-like string forced to America/Sao_Paulo (UTC-3)
 * Example: "2026-02-21T19:30:00-03:00"
 */
export const getSaoPauloIso = (date: Date = getTodayDate()): string => {
    try {
        if (!date || isNaN(date.getTime())) return '';
        
        // We use a trick to get the parts in SP timezone
        const formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';

        const y = getPart('year');
        const m = getPart('month');
        const d = getPart('day');
        const h = getPart('hour');
        const min = getPart('minute');
        const s = getPart('second');

        return `${y}-${m}-${d}T${h}:${min}:${s}-03:00`;
    } catch (e) {
        console.error('dateUtils: Error in getSaoPauloIso', e);
        return '';
    }
};
