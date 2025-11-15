'use client';
import React, { useState } from 'react';
import { formatDateOnly } from '../lib/date-utils';

interface Member { id: string; userId: string; role: string; name?: string; email?: string; joinedAt?: string; }

type Props = {
    members: Member[];
    currentRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
    currentUserId?: string | null;
    primaryOwnerUserId?: string | null;
    onDelete: (member: Member) => Promise<void> | void;
    onChangeRole: (member: Member, role: 'OWNER'|'ADMIN'|'MEMBER') => Promise<void> | void;
    loadingIds?: string[];
};

export const MemberList = React.memo(function MemberList({ members, currentRole, currentUserId, primaryOwnerUserId, onDelete, onChangeRole, loadingIds = [] }: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newRole, setNewRole] = useState<'OWNER'|'ADMIN'|'MEMBER'|''>('');

    if (!members.length) return <p className="text-sm text-gray-600">No members yet.</p>;

    function canDelete(targetRole: string, targetUserId: string) {
        if (targetUserId === currentUserId) return false;
        if (currentRole === 'OWNER') return targetRole !== 'OWNER';
        if (currentRole === 'ADMIN') return targetRole === 'MEMBER';
        return false;
    }
    function canEdit(targetRole: string, targetUserId: string) {
        if (targetUserId === currentUserId) return false;
        if (currentRole === 'OWNER') return true;
        if (currentRole === 'ADMIN') return targetRole !== 'OWNER';
        return false;
    }

    const showDetails = currentRole === 'OWNER' || currentRole === 'ADMIN';
    const isPrimaryOwner = (userId: string) => primaryOwnerUserId === userId;

    return (
        <table className="w-full text-sm border">
            <thead>
                <tr className="bg-gray-100">
                    <th className="text-left p-2">Name</th>
                    {showDetails && <th className="text-left p-2">Email</th>}
                    {showDetails && <th className="text-left p-2">User ID</th>}
                    <th className="text-left p-2">Role</th>
                    {showDetails && <th className="text-left p-2">Joined</th>}
                    <th className="text-left p-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                {members.map((m) => (
                    <tr key={m.id} className="border-t">
                        <td className="p-2">
                            <div className="flex items-center gap-1">
                                {isPrimaryOwner(m.userId) && (
                                    <span className="text-yellow-500" title="Primary Owner (Creator)">⭐</span>
                                )}
                                <span>{m.name || 'Unknown'}</span>
                            </div>
                        </td>
                        {showDetails && (
                            <td className="p-2 text-gray-600">{m.email || '-'}</td>
                        )}
                        {showDetails && (
                            <td className="p-2 font-mono text-xs">{m.userId}</td>
                        )}
                        <td className="p-2">{m.role}</td>
                        {showDetails && (
                            <td className="p-2 text-xs text-gray-500">
                                {m.joinedAt ? formatDateOnly(m.joinedAt) : '-'}
                            </td>
                        )}
                        <td className="p-2 space-x-2">
                            {canDelete(m.role, m.userId) && !isPrimaryOwner(m.userId) && (
                                <button
                                    disabled={loadingIds.includes(m.id)}
                                    onClick={() => onDelete(m)}
                                    className="px-2 py-0.5 border rounded text-xs border-red-600 text-red-700 disabled:opacity-50"
                                >Remove</button>
                            )}
                            {canEdit(m.role, m.userId) && !isPrimaryOwner(m.userId) && (
                                editingId === m.id ? (
                                    <span className="inline-flex items-center gap-1">
                                        <select
                                            value={newRole}
                                            onChange={(e)=>setNewRole(e.target.value as any)}
                                            className="border px-1 py-0.5 text-xs"
                                        >
                                            <option value="">Select</option>
                                            {['OWNER','ADMIN','MEMBER'].filter(r => currentRole === 'OWNER' ? true : r !== 'OWNER').map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                            disabled={!newRole || newRole === m.role || loadingIds.includes(m.id)}
                                            onClick={async ()=>{ if(newRole) { await onChangeRole(m, newRole as any); setEditingId(null); setNewRole(''); }} }
                                        >Save</button>
                                        <button
                                            className="px-2 py-0.5 border rounded text-xs"
                                            onClick={()=>{ setEditingId(null); setNewRole(''); }}
                                        >Cancel</button>
                                    </span>
                                ) : (
                                    <button
                                        onClick={()=>{ setEditingId(m.id); setNewRole(m.role as any); }}
                                        className="px-2 py-0.5 border rounded text-xs"
                                    >Edit</button>
                                )
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
});
