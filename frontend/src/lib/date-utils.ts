const LOCALE = process.env.NEXT_PUBLIC_LOCALE || 'pt-BR';

export function formatDate(dateString: string | Date | null | undefined): string {
    if (!dateString) return '-';
    try {
        let date: Date;
        if (dateString instanceof Date) {
            date = dateString;
        } else if (typeof dateString === 'string') {
            date = new Date(dateString);
            if (isNaN(date.getTime()) && !isNaN(Number(dateString))) {
                date = new Date(Number(dateString));
            }
        } else {
            return '-';
        }
        
        if (isNaN(date.getTime())) {
            if (typeof dateString === 'string') {
                const timestamp = Number(dateString);
                if (!isNaN(timestamp) && timestamp > 0) {
                    date = new Date(timestamp);
                } else {
                    return '-';
                }
            } else {
                return '-';
            }
        }
        
        if (isNaN(date.getTime())) {
            return '-';
        }
        
        return date.toLocaleString(LOCALE, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    } catch {
        return '-';
    }
}

export function formatDateOnly(dateString: string | Date | null | undefined): string {
    if (!dateString) return '-';
    try {
        let date: Date;
        if (dateString instanceof Date) {
            date = dateString;
        } else if (typeof dateString === 'string') {
            date = new Date(dateString);
            if (isNaN(date.getTime()) && !isNaN(Number(dateString))) {
                date = new Date(Number(dateString));
            }
        } else {
            return '-';
        }
        
        if (isNaN(date.getTime())) {
            if (typeof dateString === 'string') {
                const timestamp = Number(dateString);
                if (!isNaN(timestamp) && timestamp > 0) {
                    date = new Date(timestamp);
                } else {
                    return '-';
                }
            } else {
                return '-';
            }
        }
        
        if (isNaN(date.getTime())) {
            return '-';
        }
        
        return date.toLocaleDateString(LOCALE, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    } catch {
        return '-';
    }
}

