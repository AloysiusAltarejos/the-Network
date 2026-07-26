import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import './App.css';

// CSRF Helper for secure POST requests
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

// Custom Time Formatter
function formatNotificationTime(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Helper to determine the icon based on action text
function getNotifIcon(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('dislike')) return '🛇'; 
    if (lowerText.includes('like')) return '❤';
    if (lowerText.includes('repl')) return '💬';
    if (lowerText.includes('follow')) return '👤';
    return '•';
}

export default function Layout() {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    const navigate = useNavigate();
    const location = useLocation(); 
    
    // Desktop states
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
    
    // Mobile states
    const [leftMobileOpen, setLeftMobileOpen] = useState(false);
    const [rightMobileOpen, setRightMobileOpen] = useState(false);
    
    const [notifications, setNotifications] = useState([]);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    useEffect(() => {
        fetch(`${baseURL}/api/notifications/`, {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.notifications) {
                setNotifications(data.notifications);
            }
            if (data.unread_message_count !== undefined) {
                setUnreadMessageCount(data.unread_message_count);
            }
        })
        .catch(err => console.error("Failed to load notifications", err));
    }, [baseURL]);

    useEffect(() => {
        fetch(`${baseURL}/api/notifications/`, {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.notifications) {
                setNotifications(data.notifications);
            }
        })
        .catch(err => console.error("Failed to load notifications", err));
    }, [baseURL]);

    // Calculate unread count for the Bell Icon
    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleDeleteNotif = (id) => {
        fetch(`${baseURL}/api/notifications/${id}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }
        }).catch(err => console.error("Error deleting notification:", err));
    };

    const handleClearAll = () => {
        fetch(`${baseURL}/api/notifications/clear/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                setNotifications([]);
            }
        }).catch(err => console.error("Error clearing notifications:", err));
    };

    // Routing Logic based on notification type and read status updates
    const handleNotificationClick = (notif) => {
        if (!notif.is_read) {
            setNotifications(prev => prev.map(n => 
                n.id === notif.id ? { ...n, is_read: true, justClicked: true } : n
            ));

            fetch(`${baseURL}/api/notifications/${notif.id}/read/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include'
            }).catch(err => console.error("Error marking notification as read:", err));
        }

        const text = notif.action_text.toLowerCase();
        
        if (text.includes('story') && notif.story_id) {
            navigate(`/home?story=${notif.story_id}`);
        } else if (text.includes('repl') && notif.post_id && notif.comment_id) {
            navigate(`/post/${notif.post_id}#comment-${notif.comment_id}`);
        } else if (notif.post_id) {
            navigate(`/post/${notif.post_id}`);
        } else if (text.includes('follow')) {
            navigate(`/profile/${notif.sender_username}`);
        }
    };

    return (
        <div style={{ fontFamily: "'Solway', 'Share Tech Mono'" }}>
            <style>{`
                .notif-badge { border-radius: 50% !important; }
            `}</style>

            <nav className="top-navbar">
                <button 
                    className="nav-toggle-btn" 
                    onClick={() => {
                        if (window.innerWidth <= 768) {
                            setLeftMobileOpen(!leftMobileOpen);
                            setRightMobileOpen(false);
                        } else {
                            setLeftSidebarCollapsed(!leftSidebarCollapsed);
                        }
                    }}
                    style={{ justifySelf: 'start', flexShrink: 0, padding: '0 10px' }}
                >
                    𖤓
                </button>
                
                <h1 className="neon-title" style={{ justifySelf: 'center', margin: 0 }}>
                    <Link to="/home" style={{ textDecoration: 'none', color: 'inherit' }}>The 67th Network</Link>
                </h1>
                
                <button 
                    className="nav-toggle-btn" 
                    onClick={() => {
                        if (window.innerWidth <= 768) {
                            setRightMobileOpen(!rightMobileOpen);
                            setLeftMobileOpen(false);
                        } else {
                            setRightSidebarCollapsed(!rightSidebarCollapsed);
                        }
                    }}
                    style={{ justifySelf: 'end', flexShrink: 0, position: 'relative', padding: '0 10px' }}
                >
                    🔔
                    {unreadCount > 0 && (
                        <span className="notif-badge" style={{ 
                            position: 'absolute', top: '4px', right: '4px',     
                            backgroundColor: '#ef4444', color: 'white', fontSize: '10px', 
                            width: '16px', height: '16px', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center' 
                        }}>
                            {unreadCount}
                        </span>
                    )}
                </button>
            </nav>

            <div className="app-layout">
                <div 
                    className={`sidebar-backdrop ${(leftMobileOpen || rightMobileOpen) ? 'active' : ''}`}
                    onClick={() => { setLeftMobileOpen(false); setRightMobileOpen(false); }}
                ></div>

                <aside 
                    className={`sidebar ${leftSidebarCollapsed ? 'collapsed' : ''} ${leftMobileOpen ? 'mobile-open' : ''}`}
                    style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', top: '65px' }}
                >
                    <h1 className="logo-title">The Network</h1>
                    
                    <nav className="sidebar-nav">
                        <Link to="/home" className={`nav-item ${location.pathname.startsWith('/home') ? 'active' : ''}`}> 🏠︎ home</Link>   
                        <Link to="/profile" className={`nav-item ${location.pathname.startsWith('/profile') ? 'active' : ''}`}> 𖨆 Profile</Link>
                        
                        <Link to="/inbox" className={`nav-item ${location.pathname.startsWith('/inbox') ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>✉︎ Messages</span>
                            {unreadMessageCount > 0 && (
                                <span className="notif-badge" style={{
                                    backgroundColor: 'var(--primary)', 
                                    color: 'var(--primary-foreground)', 
                                    fontSize: '12px', 
                                    width: '24px', 
                                    height: '24px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontFamily: 'inherit' 
                                }}>
                                    {unreadMessageCount}
                                </span>
                            )}
                        </Link>
                        
                        <Link to="/search" className={`nav-item ${location.pathname.startsWith('/search') ? 'active' : ''}`}>🔍︎ Search</Link>
                        
                        <div className="logout-btn" style={{ margin: 0 }}>
                            <button 
                                type="submit" 
                                className="nav-item logout-hover" 
                                onClick={() => {
                                    localStorage.removeItem('isAuthenticated');
                                    navigate('/auth'); 
                                }}
                            >
                                𓉞 Log out
                            </button>
                        </div>
                    </nav>

                    <div className="sidebar-footer">
                        <p>Made by: Aloysius Altarejos</p>
                        <p>Pulished in 2026</p>
                        <p>Copyright 2026 The Network</p>
                        <p>All rights reserved</p>
                        <p>For any debugging, suggestions, and questionnaires please email: altzaloy15@gmail.com</p>
                    </div>
                </aside>

                <main>
                    <Outlet /> 
                </main>

                <aside 
                    className={`right-sidebar ${rightSidebarCollapsed ? 'collapsed' : ''} ${rightMobileOpen ? 'mobile-open' : ''}`}
                    style={{ height: 'calc(100vh - 65px)', position: 'sticky', top: '65px', overflowY: 'auto', boxSizing: 'border-box' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '15px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--foreground)' }}>
                            Activity
                        </h2>
                        {notifications.length > 0 && (
                            <button 
                                onClick={handleClearAll}
                                style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', transition: 'color 0.2s ease' }}
                                onMouseOver={(e) => e.target.style.color = '#ef4444'}
                                onMouseOut={(e) => e.target.style.color = 'var(--muted-foreground)'}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {notifications.length === 0 ? (
                            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', textAlign: 'center', fontStyle: 'italic' }}>No new notifications.</p>
                        ) : (
                            notifications.map(notif => (
                                <div key={notif.id} 
                                     className={`notif-box ${notif.is_read ? 'read' : 'unread'} ${notif.justClicked ? 'grey-out-animation' : ''}`} 
                                     style={{ 
                                        padding: '16px', 
                                        backgroundColor: 'transparent', 
                                        border: '1px solid var(--border)', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'flex-start',
                                        gap: '10px' 
                                }}>
                                    <div 
                                        style={{ 
                                            cursor: 'pointer', 
                                            flexGrow: 1, 
                                            minWidth: 0 
                                        }} 
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px',maxWidth: '100%' }}>
                                            <span style={{ flexShrink: 0, fontSize: '0.9rem' }}>{getNotifIcon(notif.action_text)}</span>
                                            <strong style={{ 
                                                fontSize: '0.9rem', 
                                                color: 'var(--foreground)',
                                                whiteSpace: 'nowrap',       
                                                overflow: 'hidden',        
                                                textOverflow: 'ellipsis',  
                                                minWidth: 0 
                                            }}>
                                                @{notif.sender_username}
                                            </strong>
                                        </div>

                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--foreground)', textAlign: 'left', wordBreak: 'break-word' }}>
                                            {notif.action_text}
                                        </p>
                                        
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '8px', textAlign: 'left' }}>
                                            {formatNotificationTime(notif.date)}
                                        </div>
                                    </div>
                                        
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px', 
                                        flexShrink: 0, 
                                        marginTop: '2px'
                                    }}>
                                        {!notif.is_read && (
                                            <span className="unread-dot" style={{ margin: 0 }}></span>
                                        )}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                handleDeleteNotif(notif.id);
                                            }}
                                            title="Delete notification"
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: 'var(--muted-foreground)', 
                                                fontSize: '1.2rem', 
                                                cursor: 'pointer', 
                                                padding: '0', 
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                outline: 'none'
                                            }}
                                            onMouseOver={(e) => { e.target.style.color = '#ef4444'; }}
                                            onMouseOut={(e) => { e.target.style.color = 'var(--muted-foreground)'; }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}