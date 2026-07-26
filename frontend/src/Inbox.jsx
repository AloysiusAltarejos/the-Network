import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Helper to format time dynamically
function formatMessageTime(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
}

export default function Inbox() {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        fetch(`${baseURL}/api/inbox/`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.chat_data) {
                    // Sort chats so newest message is at the top
                    const sortedChats = data.chat_data.sort((a, b) => {
                        const dateA = a.last_message ? new Date(a.last_message.created_at) : new Date();
                        const dateB = b.last_message ? new Date(b.last_message.created_at) : new Date();
                        return dateB - dateA;
                    });
                    setChats(sortedChats);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching inbox:", err);
                setLoading(false);
            });
    }, [baseURL]);

    if (loading) {
        return <div style={{ padding: '25px', color: 'var(--foreground)' }}>Loading Inbox...</div>;
    }

    return (
        <main style={{ 
            flexGrow: 1, 
            width: '100%', 
            borderLeft: '1px solid var(--border)', 
            borderRight: '1px solid var(--border)', 
            minHeight: 'calc(100vh - 65px)', 
            padding: '25px', 
            boxSizing: 'border-box', 
            overflowY: 'auto',
            display: 'block' 
        }}>
            <div style={{ 
                width: '100%', 
                paddingBottom: '15px', 
                borderBottom: '1px solid var(--border)', 
                marginBottom: '20px',
                display: 'block'
            }}>
                <h2 style={{ 
                    margin: 0, 
                    fontSize: '1rem', 
                    fontWeight: 'bold', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    color: 'var(--foreground)',
                    textAlign: 'left' 
                }}>
                    Your conversations
                </h2>
            </div>

            {chats.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: '50px' }}>No active chats. Start a new transmission!</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    {chats.map(chat => {
                        const isGroup = chat.thread.is_group;
                        const displayName = isGroup ? chat.thread.name : (chat.partner?.name || chat.partner?.username);
                        const displayPic = isGroup ? chat.thread.group_picture : chat.partner?.profile_picture;
                        const fallbackInitial = displayName ? displayName.charAt(0).toUpperCase() : '?';

                        return (
                            <Link 
                                to={`/messages/${chat.thread.id}`} 
                                key={chat.thread.id}
                                style={{ 
                                    display: 'flex', 
                                    width: '100%', 
                                    boxSizing: 'border-box',
                                    alignItems: 'center', 
                                    gap: '15px', 
                                    padding: '15px', 
                                    textDecoration: 'none', 
                                    backgroundColor: 'var(--background)', 
                                    border: '1px solid var(--border)', 
                                    borderRadius: '8px', 
                                    transition: 'background-color 0.2s ease', 
                                    position: 'relative' 
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--muted)'} 
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'} 
                            >
                                {/* Avatar */}
                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--background)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--foreground)', fontSize: '1.2rem', border: '1px solid var(--border)' }}>
                                    {displayPic ? (
                                        <img src={`${baseURL}${displayPic}`} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        fallbackInitial
                                    )}
                                </div>

                                {/* Chat Details */}
                                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <strong style={{ color: 'var(--foreground)', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {displayName}
                                        </strong>
                                        {chat.last_message && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: '10px' }}>
                                                {formatMessageTime(chat.last_message.created_at)}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {chat.last_message ? (
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: chat.unread_count > 0 ? 'var(--foreground)' : 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: chat.unread_count > 0 ? 'bold' : 'normal' }}>
                                            {chat.last_message.is_me ? "You: " : `${chat.last_message.sender_username}: `}
                                            {chat.last_message.content}
                                        </p>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>It's looking silent in here. Say something!!!!!</p>
                                    )}
                                </div>

                                {/* Unread Badge & Mute Indicator */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                    {chat.thread.is_muted && <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>🔇</span>}
                                    {chat.unread_count > 0 && (
                                        <div style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                                            {chat.unread_count}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </main>
    );
}