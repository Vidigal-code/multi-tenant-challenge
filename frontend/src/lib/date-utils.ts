export function formatDate(dateString: string | Date | null | undefined): string {
    if (!dateString) return '-';
    try {
        const date = dateString instanceof Date ? dateString : new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    } catch {
        return 'Data inválida';
    }
}

export function formatDateOnly(dateString: string | Date | null | undefined): string {
    if (!dateString) return '-';
    try {
        const date = dateString instanceof Date ? dateString : new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    } catch {
        return 'Data inválida';
    }
}

