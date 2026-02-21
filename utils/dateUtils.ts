/**
 * Returns the current date (YYYY-MM-DD) in America/Sao_Paulo timezone.
 */
export const getSaoPauloDate = (date: Date = new Date()): string => {
    return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Robustly parses a date string that might be in ISO format or a localized pt-BR string.
 */
export const parseToDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();

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
    } catch (e) {
        console.error('dateUtils: Error parsing date', dateStr, e);
    }

    return new Date(dateStr);
};

/**
 * Checks if a date string refers to the same day as the reference date (Today in SP),
 * correctly forcing America/Sao_Paulo comparison.
 */
export const isSameDay = (dateStr: string, referenceDate: Date = new Date()): boolean => {
    const date = parseToDate(dateStr);
    const spDate = getSaoPauloDate(date);
    const spRef = getSaoPauloDate(referenceDate);
    return spDate === spRef;
};

/**
 * Formats an ISO string or localized string to HH:mm (America/Sao_Paulo Time)
 */
export const formatToLocalTime = (dateStr: string): string => {
    const date = parseToDate(dateStr);
    if (isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Formats an ISO string or localized string to DD/MM/YYYY (America/Sao_Paulo Time)
 */
export const formatToLocalDate = (dateStr: string): string => {
    const date = parseToDate(dateStr);
    if (isNaN(date.getTime())) return '--/--/----';

    return date.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    });
};

/**
 * Normalizes any date string into a pt-BR date key for grouping (e.g. "21/02/2026")
 * always relative to America/Sao_Paulo.
 */
export const getDateKey = (dateStr: string): string => {
    const date = parseToDate(dateStr);
    if (isNaN(date.getTime())) return 'invalid';

    const spDate = getSaoPauloDate(date); // YYYY-MM-DD
    const [y, m, d] = spDate.split('-');

    return `${d}/${m}/${y}`;
};
