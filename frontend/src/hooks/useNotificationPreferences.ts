"use client";

import { useMemo } from 'react';
import { useProfile } from '../services/api';

export interface NotificationPreferences {
    realtimeEnabled?: boolean;
    realtimePopups?: boolean;
    realtimeIconBadge?: boolean;
    companyInvitations?: boolean;
    friendRequests?: boolean;
    companyMessages?: boolean;
    membershipChanges?: boolean;
    roleChanges?: boolean;
}


export function useNotificationPreferences() {
    const { data: profile } = useProfile();

    const preferences: NotificationPreferences = useMemo(() => {
        return profile?.notificationPreferences || {};
    }, [profile?.notificationPreferences]);

    const derived = useMemo(() => {
        return {
            realtimeEnabled: preferences.realtimeEnabled !== false,
            realtimePopups: preferences.realtimePopups !== false,
            realtimeIconBadge: preferences.realtimeIconBadge === true,
            companyInvitations: preferences.companyInvitations !== false,
            friendRequests: preferences.friendRequests !== false,
            companyMessages: preferences.companyMessages !== false,
            membershipChanges: preferences.membershipChanges !== false,
            roleChanges: preferences.roleChanges !== false,
        };
    }, [preferences]);

    return {
        preferences,
        derived,
        isLoading: !profile,
    };
}

