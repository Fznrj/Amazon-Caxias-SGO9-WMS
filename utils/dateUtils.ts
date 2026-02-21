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

            if (parts[1]) {
                const [h, min, s] = parts[1].split(':');
                return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min) || 0, Number(s) || 0);
            }

            return new Date(Number(y), Number(m) - 1, Number(d));
        }
    } catch (e) {
        console.error('dateUtils: Error parsing date', dateStr, e);
    }

    return new Date(dateStr);
};

/**
 * Checks if a date string refers to the same day as the reference date (usually Today),
 * correctly handling local timezone comparison.
 */
export const isSameDay = (dateStr: string, referenceDate: Date = new Date()): boolean => {
    const date = parseToDate(dateStr);

    return (
        date.getDate() === referenceDate.getDate() &&
        date.getMonth() === referenceDate.getMonth() &&
        date.getFullYear() === referenceDate.getFullYear()
    );
};

/**
 * Formats an ISO string or localized string to HH:mm (Local Time)
 */
export const formatToLocalTime = (dateStr: string): string => {
    const date = parseToDate(dateStr);
    if (isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Formats an ISO string or localized string to DD/MM/YYYY
 */
export const formatToLocalDate = (dateStr: string): string => {
    const date = parseToDate(dateStr);
    if (isNaN(date.getTime())) return '--/--/----';

    return date.toLocaleDateString('pt-BR');
};

/**
 * Normalizes any date string into a pt-BR date key for grouping (e.g. "21/02/2026")
 */
export const getDateKey = (dateStr: string): string => {
    const date = parseToDate(dateStr);
    if (isNaN(date.getTime())) return 'invalid';

    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();

    return `${d}/${m}/${y}`;
};
