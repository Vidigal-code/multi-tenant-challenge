'use client';
import React, {useState} from 'react';
import {http} from '../lib/http';
import {getErrorMessage} from '../lib/error';

export function InviteForm({companyId, onInvited}: { companyId: string; onInvited: (tokenOrUrl: string) => void }) {

    const [email, setEmail] = useState('');
    const [role, setRole] = useState('MEMBER');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    return (
        <form className="space-y-2" onSubmit={async e => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
                const {data} = await http.post(`/company/${companyId}/invite`, {email, role});
                onInvited(data.inviteUrl || data.token);
                setEmail('');
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }}>
            <div className="flex gap-2">
                <input value={email} onChange={e =>
                    setEmail(e.target.value)} placeholder="Email"
                       className="border px-2 py-1 flex-1"/>
                <select value={role} onChange={e =>
                    setRole(e.target.value)} className="border px-2 py-1">
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OWNER">OWNER</option>
                </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button disabled={loading} className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                {loading ? 'Sending...' : 'Invite'}
            </button>
        </form>
    );
}
