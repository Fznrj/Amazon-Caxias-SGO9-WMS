export const isValidTbr = (id: string): { isValid: boolean; message?: string } => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId.startsWith('TBR')) {
        return { isValid: false, message: 'ERRO: O código deve começar com TBR.' };
    }
    if (cleanId.length < 12 || cleanId.length > 15) {
        return { isValid: false, message: 'ERRO: O código TBR deve ter entre 12 e 15 caracteres.' };
    }
    return { isValid: true };
};
