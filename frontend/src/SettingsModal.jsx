import { useState, useMemo } from 'react';

export default function SettingsModal({ isOpen, onClose, thread, allUsers, currentUserId, onSearchChat }) {
    const [addSearchQuery, setAddSearchQuery] = useState('');
    const [nicknames, setNicknames] = useState({});
    const [newName, setNewName] = useState('');
    const baseURL = import.meta.env.VITE_API_BASE_URL;

    // Filter users not currently in the thread
    const availableUsersToAdd = useMemo(() => {
        const threadUserIds = thread.participants?.map(p => p.id) || [];
        const lowerQuery = addSearchQuery.toLowerCase();
        return allUsers.filter(u => 
            !threadUserIds.includes(u.id) && 
            (u.name.toLowerCase().includes(lowerQuery) || u.username.toLowerCase().includes(lowerQuery))
        ).slice(0, 30);
    }, [addSearchQuery, allUsers, thread.participants]);

    // Reusable function for all settings actions
    const handleAction = (actionType, payload = {}) => {
        fetch(`${baseURL}/api/messages/thread/${thread.id}/settings/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ action: actionType, ...payload }),
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (['delete_me', 'delete_both'].includes(actionType)) {
                    window.location.href = '/messages';
                } else {
                    window.location.reload(); 
                }
            } else {
                alert('Error updating settings: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error("Settings action error:", err);
            alert("Failed to connect to the server.");
        });
    };

    const handleImageUpload = (e) => {
    e.preventDefault();
    const file = e.target.elements.group_picture.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('action', 'change_picture');
    formData.append('group_picture', file);

    fetch(`${baseURL}/api/messages/thread/${thread.id}/settings/`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.reload(); 
        } else {
            alert('Error updating picture: ' + data.error);
        }
    })
    .catch(err => {
        console.error("Upload error:", err);
        alert('Failed to process the image upload.');
    });
};

    if (!isOpen || !thread) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', width: '400px', maxWidth: '90%', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1.1rem' }}>Thread Settings</h3>
                    <button onClick={onClose} className="chat-icon-btn" style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>
            
                {/* 1. Chat Search */}
                <input 
                    type="text" 
                    onChange={(e) => onSearchChat(e.target.value)} 
                    placeholder="Search conversation" 
                    style={{ width: '100%', padding: '10px', marginBottom: '20px', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
                />
                
                {/* 2. Nicknames */}
                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 5px 0', color: 'var(--muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Set Nicknames</p>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(thread.participants || []).map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                                <span style={{ color: 'var(--foreground)', fontSize: '0.8rem', minWidth: '60px' }}>@{p.username.substring(0, 10)}</span>
                                <input 
                                    type="text" 
                                    placeholder={p.nickname || "Enter a custom nickname"} 
                                    value={nicknames[p.id] || ''}
                                    onChange={(e) => setNicknames({...nicknames, [p.id]: e.target.value})}
                                    style={{ flexGrow: 1, padding: '4px', background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: '0.8rem', outline: 'none' }} 
                                />
                                <button onClick={() => handleAction('change_nickname', { target_user_id: p.id, nickname: nicknames[p.id] })} className="chat-action-btn" style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', cursor: 'pointer', fontSize: '0.7rem', padding: '3px 8px' }}>SET</button>
                            </div>
                        ))}
                    </div>
                </div>
            
                {/* 3. Group Specific Controls */}
                {thread.is_group && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input 
                                type="text" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="New Group Name" 
                                style={{ flexGrow: 1, padding: '8px', background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none' }} 
                            />
                            <button onClick={() => handleAction('change_name', { new_name: newName })} className="chat-action-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0 10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>RENAME</button>
                        </div>
                        
                        <form onSubmit={handleImageUpload} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <input type="file" name="group_picture" accept="image/*" required style={{ flexGrow: 1, fontSize: '0.8rem', color: 'var(--muted-foreground)' }} />
                            <button type="submit" className="chat-action-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>UPLOAD PIC</button>
                        </form>
                    </div>
                )}
                
                {/* 4. Mute Notifications */}
                <button onClick={() => handleAction('mute')} className="chat-mute-btn" style={{ marginBottom: '20px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', color: thread.is_muted ? '#eab308' : 'var(--foreground)', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem' }}>
                    {thread.is_muted ? '🔊 Unmute Notifications' : '🔇 Mute Notifications'}
                </button>
            
                {/* 5. Manage & Add Members (Group Only) */}
                {thread.is_group && (
                    <>
                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 5px 0', color: 'var(--muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Add Members</p>
                            <input 
                                type="text" 
                                value={addSearchQuery}
                                onChange={(e) => setAddSearchQuery(e.target.value)}
                                placeholder="Add new people to the group" 
                                style={{ width: '100%', padding: '8px', marginBottom: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box', fontSize: '0.85rem' }} 
                            />
                            <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {availableUsersToAdd.length === 0 ? (
                                    <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic' }}>Everyone is in this group or no users found.</p>
                                ) : (
                                    availableUsersToAdd.map(u => (
                                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>@{u.username}</span>
                                            <button onClick={() => handleAction('add', { target_user_id: u.id })} className="chat-action-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.7rem', padding: '4px 10px', fontWeight: 'bold' }}>ADD</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    
                        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', marginBottom: '20px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ margin: '0 0 5px 0', color: 'var(--muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Manage Members</p>
                            {(thread.participants || []).map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>@{p.username}</span>
                                    {p.id !== currentUserId && (
                                        <button onClick={() => handleAction('kick', { target_user_id: p.id })} className="chat-danger-btn" style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: '3px 8px' }}>KICK</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            
                {/* 6. Destructive Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => handleAction('delete_me')} className="chat-danger-btn" style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {thread.is_group ? 'Leave Group' : 'Delete For Me (Clear Inbox)'}
                    </button>
                    <button onClick={() => handleAction('delete_both')} className="chat-danger-btn" style={{ width: '100%', padding: '10px', background: '#ef4444', border: '1px solid #ef4444', color: 'white', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {thread.is_group ? 'Delete Group Entirely' : 'Delete For Both (Permanent)'}
                    </button>
                </div>
            </div>
        </div>
    );
}