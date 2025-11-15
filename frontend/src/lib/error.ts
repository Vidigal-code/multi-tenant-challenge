import { getErrorMessage as getErrorMessageByCode, getSuccessMessage, getMessage, isSuccessCode, isErrorCode } from './messages';

export function getErrorMessage(err: any, fallback = 'Ocorreu um erro'): string {
    if (!err) return fallback;
    const code = err?.response?.data?.code as string | undefined;
    if (code) {
        if (isErrorCode(code)) {
            return getErrorMessageByCode(code);
        }
        if (isSuccessCode(code)) {
            return getSuccessMessage(code);
        }
        return getMessage(code);
    }
    const generic = err?.response?.data?.message || err?.message || err?.toString?.();
    return typeof generic === 'string' ? generic : fallback;
}

export { getSuccessMessage, getMessage, isSuccessCode, isErrorCode };

export type EventMessage = { eventId: string; [k: string]: any };
export function getEventMessage(evt: EventMessage): string | null {
    switch (evt?.eventId) {
        case 'INVITE_CREATED':
            return getSuccessMessage('INVITE_CREATED');
        case 'INVITE_ACCEPTED':
            return getSuccessMessage('INVITE_ACCEPTED');
        case 'INVITE_REJECTED':
            if (evt.invitedName && evt.invitedEmail) {
                return getErrorMessageByCode('INVITE_REJECTED_BY_USER', { name: evt.invitedName, email: evt.invitedEmail });
            }
            return getErrorMessageByCode('INVITE_REJECTED');
        case 'USER_REMOVED':
            return getErrorMessageByCode('USER_REMOVED_FROM_COMPANY');
        case 'USER_STATUS_UPDATED':
            return getSuccessMessage('USER_STATUS_UPDATED');
        default:
            return null;
    }
}