import React from 'react';
import {
    MdMail,
    MdSend,
    MdInbox,
    MdPerson,
    MdBusiness,
    MdBadge,
    MdDescription,
    MdPersonPin,
    MdEvent,
    MdGroup,
    MdConfirmationNumber,
    MdEmail,
    MdLink,
    MdWork,
    MdSwapHoriz,
    MdChat,
    MdTitle
} from 'react-icons/md';
import { extractEventCode } from './notification-messages';
import { translateGenericMessage, translateRole } from './messages';

export interface FormattedLine {
    icon: React.ReactNode;
    label: string;
    value: string;
    isDate?: boolean;
    isUrl?: boolean;
    url?: string;
}

function normalizeInviteUrl(rawUrl: string | undefined | null): string {
    if (!rawUrl) return '';
    try {
        const url = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
        if (typeof window !== 'undefined' && window.location?.origin) {
            return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
        }
        return url.toString();
    } catch {
        if (typeof window !== 'undefined' && rawUrl.startsWith('/')) {
            return `${window.location.origin}${rawUrl}`;
        }
        return rawUrl;
    }
}

export function formatNotificationBody(body: string, title?: string): FormattedLine[] {
    if (!body) return [];
    
    const eventCode = extractEventCode(title || '');
    let formattedBody = body;
    
    if (eventCode) {
        formattedBody = formattedBody.replace(new RegExp(`${eventCode}:`, 'gi'), '').trim();
        formattedBody = formattedBody.replace(new RegExp(`\\[${eventCode}\\]`, 'gi'), '').trim();
    }
    
    const lines = formattedBody.split('\n').filter(line => line.trim());
    const formattedLines: FormattedLine[] = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.match(/^[A-Z_]+:\[.*\]$/) || line.match(/^\[.*\]$/)) {
            const translated = translateGenericMessage(line);
            if (translated !== line) {
                formattedLines.push({
                    icon: <MdMail className="inline mr-1" />,
                    label: '',
                    value: translated
                });
                continue;
            }
        }
        
        const genericMessageMatch = line.match(/\[([^\]]+)\]/);
        if (genericMessageMatch) {
            const extractedMessage = `[${genericMessageMatch[1]}]`;
            const translated = translateGenericMessage(extractedMessage);
            if (translated !== extractedMessage) {
                const translatedLine = line.replace(extractedMessage, translated);
                formattedLines.push({
                    icon: <MdMail className="inline mr-1" />,
                    label: '',
                    value: translatedLine
                });
                continue;
            }
        }
        
        if (line.match(/^[A-Z_]+:\[.*\]$/)) {
            const genericMatch = line.match(/\[([^\]]+)\]/);
            if (genericMatch) {
                const extractedMessage = `[${genericMatch[1]}]`;
                const translated = translateGenericMessage(extractedMessage);
                if (translated !== extractedMessage) {
                    formattedLines.push({
                        icon: <MdMail className="inline mr-1" />,
                        label: '',
                        value: translated
                    });
                    continue;
                }
            }
            continue;
        }
        
        if (line.match(/^[A-Z_]+:$/)) {
            continue;
        }
        
        if (line.startsWith('Sender:')) {
            formattedLines.push({
                icon: <MdSend className="inline mr-1" />,
                label: 'Remetente:',
                value: line.replace('Sender:', '').trim()
            });
        } else if (line.startsWith('Recipient:')) {
            formattedLines.push({
                icon: <MdInbox className="inline mr-1" />,
                label: 'Destinatário:',
                value: line.replace('Recipient:', '').trim()
            });
        } else if (line.startsWith('Friend Email:')) {
            formattedLines.push({
                icon: <MdPerson className="inline mr-1" />,
                label: 'Email do Amigo:',
                value: line.replace('Friend Email:', '').trim()
            });
        } else if (line.startsWith('Company:')) {
            formattedLines.push({
                icon: <MdBusiness className="inline mr-1" />,
                label: 'Empresa:',
                value: line.replace('Company:', '').trim()
            });
        } else if (line.startsWith('Company ID:')) {
            formattedLines.push({
                icon: <MdBadge className="inline mr-1" />,
                label: 'ID da Empresa:',
                value: line.replace('Company ID:', '').trim()
            });
        } else if (line.startsWith('Description:')) {
            formattedLines.push({
                icon: <MdDescription className="inline mr-1" />,
                label: 'Descrição:',
                value: line.replace('Description:', '').trim()
            });
        } else if (line.startsWith('Primary Owner:')) {
            formattedLines.push({
                icon: <MdPersonPin className="inline mr-1" />,
                label: 'Proprietário Principal:',
                value: line.replace('Primary Owner:', '').trim()
            });
        } else if (line.startsWith('Created At:')) {
            const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}T[\d:.-]+Z?)/);
            if (dateMatch) {
                try {
                    const date = new Date(dateMatch[1]);
                    formattedLines.push({
                        icon: <MdEvent className="inline mr-1" />,
                        label: 'Empresa criada em: ',
                        value: date.toLocaleDateString('pt-BR', 
                            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        isDate: true
                    });
                } catch {
                    formattedLines.push({
                        icon: <MdEvent className="inline mr-1" />,
                        label: 'Empresa criada em: ',
                        value: line.replace('Created At:', '').trim(),
                        isDate: true
                    });
                }
            } else {
                formattedLines.push({
                    icon: <MdEvent className="inline mr-1" />,
                    label: 'Data de Criação:',
                    value: line.replace('Created At:', '').trim(),
                    isDate: true
                });
            }
        } else if (line.startsWith('Members:')) {
            formattedLines.push({
                icon: <MdGroup className="inline mr-1" />,
                label: 'Membros:',
                value: line.replace('Members:', '').trim()
            });
        }  else if (line.startsWith('Invite ID:')) {
            formattedLines.push({
                icon: <MdConfirmationNumber className="inline mr-1" />,
                label: 'ID do Convite:',
                value: line.replace('Invite ID:', '').trim()
            });
        } else if (line.startsWith('Invite Email:')) {
            formattedLines.push({
                icon: <MdEmail className="inline mr-1" />,
                label: 'Email do Convite:',
                value: line.replace('Invite Email:', '').trim()
            });
        } else if (line.startsWith('Invite URL:')) {
            const urlMatch = line.match(/(https?:\/\/[^\s]+|www\.[^\s]+|\/[^\s]+)/);
            const rawUrl = urlMatch ? urlMatch[1] : line.replace('Invite URL:', '').trim();
            const url = normalizeInviteUrl(rawUrl);
            formattedLines.push({
                icon: <MdLink className="inline mr-1" />,
                label: 'Link do Convite:',
                value: url,
                isUrl: true,
                url: url
            });
        } else if (line.startsWith('Role:')) {
            const roleValue = line.replace('Role:', '').trim();
            formattedLines.push({
                icon: <MdWork className="inline mr-1" />,
                label: 'Cargo:',
                value: translateRole(roleValue)
            });
        } else if (line.startsWith('Previous Role:')) {
            const previousRoleValue = line.replace('Previous Role:', '').trim();
            formattedLines.push({
                icon: <MdSwapHoriz className="inline mr-1" />,
                label: 'Cargo Anterior:',
                value: translateRole(previousRoleValue)
            });
        } else if (line.startsWith('Message:')) {
            formattedLines.push({
                icon: <MdChat className="inline mr-1" />,
                label: 'Mensagem:',
                value: line.replace('Message:', '').trim()
            });
        } else if (line.startsWith('Title:')) {
            formattedLines.push({
                icon: <MdTitle className="inline mr-1" />,
                label: 'Título:',
                value: line.replace('Title:', '').trim()
            });
        } else {
            formattedLines.push({
                icon: null,
                label: '',
                value: line
            });
        }
    }
    
    return formattedLines;
}

