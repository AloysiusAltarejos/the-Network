import { useState, useMemo } from 'react';

export default function GroupModal({ isOpen, onClose, allUsers = [] }) {
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    const filteredUsers = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        return allUsers
            .filter(u => u.name.toLowerCase().includes(lowerQuery) || u.username.toLowerCase().includes(lowerQuery))
            .slice(0, 25);
    }, [searchQuery, allUsers]);

    const handleToggleUser = (userId) => {
        const nextSet = new Set(selectedUsers);
        if (nextSet.has(userId)) nextSet.delete(userId);
        else nextSet.add(userId);
        setSelectedUsers(nextSet);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        fetch(`${baseURL}/api/messages/group/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                group_name: groupName,
                user_ids: Array.from(selectedUsers)
            }),
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            setIsSubmitting(false);
            if (data.success) {
                onClose();
                window.location.href = `/messages/${data.thread_id}`;
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', width: '450px', maxWidth: '90%', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1.1rem' }}>Create a groupchat</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Give your new groupchat a name!!!" 
                        required 
                        style={{ width: '100%', padding: '12px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', marginBottom: '10px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search your conversation" 
                        style={{ width: '100%', padding: '12px', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)', marginBottom: '15px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    
                    <div style={{ height: '200px', overflowY: 'auto', backgroundColor: 'var(--background)', border: '1px solid var(--border)', marginBottom: '20px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {filteredUsers.map(u => (
                            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedUsers.has(u.id)}
                                    onChange={() => handleToggleUser(u.id)}
                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <div style={{ width: '32px', height: '32px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', fontSize: '0.8rem' }}>
                                    {u.pic_url !== 'none' ? <img src={u.pic_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.initial}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                    <strong style={{ color: 'var(--foreground)', fontSize: '0.95rem' }}>{u.name}</strong>
                                    <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>@{u.username}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" onClick={onClose} style={{ background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--muted-foreground)', padding: '8px 18px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem' }}>Cancel</button>
                        <button type="submit" disabled={selectedUsers.size === 0 || isSubmitting} style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', border: '1px solid var(--primary)', padding: '8px 18px', cursor: selectedUsers.size === 0 ? 'not-allowed' : 'pointer', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem', opacity: selectedUsers.size === 0 ? 0.5 : 1 }}>
                            {isSubmitting ? 'Creating...' : 'Create Thread'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}