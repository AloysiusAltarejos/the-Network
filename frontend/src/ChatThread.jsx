import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import SettingsModal from './SettingsModal'; 
import GroupModal from './GroupModal';

// Reusing your getCookie function for CSRF
function getCookie(name) { 
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export default function ChatThread({ currentUserId }) {
    const { threadId } = useParams();
    const [thread, setThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const chatLogRef = useRef(null);
    const baseURL = import.meta.env.VITE_API_BASE_URL;
    
    // Modal & Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [chatSearchQuery, setChatSearchQuery] = useState('');

    // 1. Fetch initial thread data & user directory
    useEffect(() => {
        fetch(`${baseURL}/api/messages/thread/${threadId}/`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setThread(data.thread);
                setMessages(data.messages);
                scrollToBottom(true); // Force scroll on initial load
            })
            .catch(err => console.error("Error fetching thread:", err));
         fetch(`${baseURL}/api/users/`, { credentials: 'include' }) // Ensure this endpoint exists in Django!
            .then(res => res.json())
            .then(data => setAllUsers(data))
            .catch(err => console.error("Error fetching users:", err));
            
    }, [threadId, baseURL]);

    // 2. Real-Time Polling (Runs every 3 seconds)
    useEffect(() => {
        const pollMessages = () => {
            fetch(`${baseURL}/api/messages/thread/${threadId}/`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    setMessages(prevMessages => {
                        if (prevMessages.length === 0) return data.messages;
                        
                        const prevLastMsg = prevMessages[prevMessages.length - 1];
                        const fetchedLastMsg = data.messages[data.messages.length - 1];

                        // Only update state if the last message ID changed OR the total count changed
                        // This prevents React from re-rendering the DOM every 3 seconds
                        if (!fetchedLastMsg || prevLastMsg.id !== fetchedLastMsg.id || prevMessages.length !== data.messages.length) {
                            return data.messages;
                        }
                        return prevMessages; // No changes, return exact previous state
                    });
                })
                .catch(err => console.error("Polling error:", err));
        };

        const intervalId = setInterval(pollMessages, 3000); // 3000ms = 3 seconds

        // Cleanup function: clears the interval when the component unmounts or threadId changes
        return () => clearInterval(intervalId);
    }, [threadId, baseURL]);

    // 3. Smart Auto-Scroll Logic
    const scrollToBottom = useCallback((force = false) => {
        if (!chatLogRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = chatLogRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100; 

        if (force || isNearBottom) {
            chatLogRef.current.scrollTop = scrollHeight;
        }
    }, []);

    // Trigger smart scroll whenever messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // 2. Handle sending a message
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Optimistic UI update
        const tempMsg = { id: Date.now(), content: newMessage, is_me: true, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, tempMsg]);
        setNewMessage('');

        fetch(`${baseURL}/api/messages/thread/${threadId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ content: newMessage }),
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) console.error("Message failed");
        });
    };

    // Filter messages if a search query is active from the settings modal
    const displayedMessages = chatSearchQuery 
        ? messages.filter(m => m.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
        : messages;

    if (!thread) return <div style={{ padding: '25px', color: 'var(--foreground)' }}>Loading Thread...</div>;

    return (
        <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', height: 'calc(100vh - 65px)', padding: '25px', boxSizing: 'border-box' }}>
            
            {/* Modals rendered completely outside the flow of the layout */}
            <SettingsModal 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
                thread={thread}
                currentUserId={currentUserId}
                allUsers={allUsers}
                onSearchChat={setChatSearchQuery}
            />

            <GroupModal 
                isOpen={showGroupModal} 
                onClose={() => setShowGroupModal(false)}
                allUsers={allUsers}
            />

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* Header Area */}
                <div style={{ paddingBottom: '15px', borderBottom: '1px solid var(--border)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    
                    {/* Back Button */}
                    <div style={{ width: '80px' }}>
                        <Link to="/inbox" className="chat-back-link" style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>← Inbox</Link>
                    </div>
                    
                    {/* Dynamic User/Group Profile Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'inherit' }}>
                        
                        {/* Dynamic Avatar */}
                        {thread.is_group ? (
                            <div style={{ width: '44px', height: '44px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)' }}>
                                {thread.group_picture ? <img src={`${baseURL}${thread.group_picture}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : '👥'}
                            </div>
                        ) : (
                            <Link to={`/profile/${thread.partner_username}`} style={{ display: 'block', textDecoration: 'none' }}>
                                <div style={{ width: '44px', height: '44px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)' }}>
                                    {thread.partner_pic ? <img src={`${baseURL}${thread.partner_pic}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : (thread.partner_name ? thread.partner_name.charAt(0).toUpperCase() : 'A')}
                                </div>
                            </Link>
                        )}
                        
                        {/* Dynamic Title & Subtitle */}
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                            {thread.is_group ? (
                                <>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--foreground)', lineHeight: '1.2' }}>{thread.name}</strong>
                                    <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: '1.2', marginTop: '2px' }}>{thread.participant_count} Members</span>
                                </>
                            ) : (
                                <Link to={`/profile/${thread.partner_username}`} style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--foreground)', lineHeight: '1.2' }}>{thread.partner_name}</strong>
                                    <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: '1.2', marginTop: '2px' }}>@{thread.partner_username}</span>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Chat Action Buttons */}
                    <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
                        <button onClick={() => setShowGroupModal(true)} className="chat-icon-btn" style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '1.6rem', cursor: 'pointer', padding: 0, lineHeight: 1 }} title="New Groupchat">+</button>
                        <button onClick={() => setShowSettings(true)} className="chat-icon-btn" style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '1.3rem', cursor: 'pointer', padding: 0, lineHeight: 1 }} title="Chat Settings">⚙</button>
                    </div>
                </div>

                {/* Chat Log Area */}
                <div ref={chatLogRef} style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px', marginBottom: '20px' }}>
                    {displayedMessages.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: '50px' }}>
                            {chatSearchQuery ? "No messages match your search." : "No messages yet. Say hello!"}
                        </p>
                    ) : (
                        displayedMessages.map((msg, idx) => {
                            if (msg.is_system) {
                                return (
                                    <div key={idx} style={{ textAlign: 'center', margin: '15px 0' }}>
                                        <span style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                            {msg.content}
                                        </span>
                                    </div>
                                );
                            }

                            if (msg.is_me) {
                                return (
                                    <div key={idx} className="message-bubble" style={{ alignSelf: 'flex-end', maxWidth: '60%', display: 'flex', flexDirection: 'column' }}>
                                        {msg.created_at && (
                                            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', marginBottom: '4px', alignSelf: 'flex-start' }}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                        )}
                                        <div style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', padding: '12px 16px', border: '1px solid var(--primary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={idx} className="message-bubble" style={{ alignSelf: 'flex-start', maxWidth: '75%', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                                    <Link to={`/profile/${msg.sender_username}`} style={{ textDecoration: 'none', flexShrink: 0, display: 'block' }}>
                                        <div style={{ width: '36px', height: '36px', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', fontSize: '0.9rem' }}>
                                            {msg.sender_pic ? <img src={`${baseURL}${msg.sender_pic}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : msg.sender_username.charAt(0).toUpperCase()}
                                        </div>
                                    </Link>
                                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                        {msg.created_at && (
                                            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.7rem', marginBottom: '4px', alignSelf: 'flex-end' }}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                        )}
                                        <div style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', padding: '12px 16px', border: '1px solid var(--border)', fontSize: '0.95rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
                                            <Link to={`/profile/${msg.sender_username}`} style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '4px' }}>
                                                {msg.sender_display_name}
                                            </Link>
                                            <span style={{ marginBottom: '6px' }}>{msg.content}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Input Area */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type something" 
                            required 
                            autoComplete="off" 
                            autoFocus 
                            style={{ flexGrow: 1, padding: '12px 15px', backgroundColor: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)', outline: 'none', fontSize: '0.95rem', fontFamily: 'inherit' }} 
                        />
                        <button type="submit" className="chat-action-btn" style={{ backgroundColor: 'transparent', color: 'var(--foreground)', border: '1px solid var(--foreground)', padding: '10px 24px', fontWeight: 'bold', letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}