import { useState, useEffect } from 'react';

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

function getTimeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) {
        return `${diffInSeconds}s`;
    } else if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)}m`;
    } else if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)}h`;
    } else {
        return `${Math.floor(diffInSeconds / 86400)}d`;
    }
}

export default function StoryModal({ stories, initialUserIndex, targetStoryId, onClose }) {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';

    
    const [userIndex, setUserIndex] = useState(initialUserIndex || 0);
    const [itemIndex, setItemIndex] = useState(0);
    const [replyText, setReplyText] = useState('');
    
    const [showViewsModal, setShowViewsModal] = useState(false);
    const [viewFilter, setViewFilter] = useState('all'); 
    const [animateLike, setAnimateLike] = useState(false);
    
    const [dynamicViews, setDynamicViews] = useState([]);
    const [isLoadingViews, setIsLoadingViews] = useState(false);
    
    const [localLikes, setLocalLikes] = useState({});

    const STORY_DURATION = 15000;

    // FIX 1: Skips to the exact story immediately on load
    useEffect(() => {
        if (targetStoryId && stories && stories.length > 0) {
            for (let uIdx = 0; uIdx < stories.length; uIdx++) {
                const iIdx = stories[uIdx].items.findIndex(item => String(item.id) === String(targetStoryId));
                if (iIdx !== -1) {
                    setUserIndex(uIdx);
                    setItemIndex(iIdx);
                    break; 
                }
            }
        }
    }, [targetStoryId, stories]);

    const currentUser = stories[userIndex];
    const currentItem = currentUser?.items[itemIndex];

    useEffect(() => {
        if (currentItem && !currentItem.is_mine) {
            fetch(`${baseURL}/api/stories/${currentItem.id}/view/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include'
            }).catch(err => console.error("Error registering view:", err));
        }
    }, [currentItem, baseURL]);

    useEffect(() => {
        if (showViewsModal && currentItem?.is_mine) {
            setIsLoadingViews(true);
            fetch(`${baseURL}/api/stories/${currentItem.id}/viewers/`, {
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                if (data.viewers) {
                    setDynamicViews(data.viewers);
                }
                setIsLoadingViews(false);
            })
            .catch(err => {
                console.error("Error fetching viewers:", err);
                setIsLoadingViews(false);
            });
        }
    }, [showViewsModal, currentItem, baseURL]);

    useEffect(() => {
        if (!currentItem || showViewsModal) return; 
        const timer = setTimeout(() => handleNext(), STORY_DURATION);
        return () => clearTimeout(timer);
    }, [userIndex, itemIndex, currentItem, showViewsModal]);

    useEffect(() => {
        setViewFilter('all');
    }, [itemIndex, userIndex]);

    const handleNext = () => {
        setReplyText(''); 
        setShowViewsModal(false); 
        if (itemIndex < currentUser.items.length - 1) {
            setItemIndex(prev => prev + 1);
        } else if (userIndex < stories.length - 1) {
            setUserIndex(prev => prev + 1);
            setItemIndex(0);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        setReplyText('');
        setShowViewsModal(false); 
        if (itemIndex > 0) {
            setItemIndex(prev => prev - 1);
        } else if (userIndex > 0) {
            const prevUser = stories[userIndex - 1];
            setUserIndex(prev => prev - 1);
            setItemIndex(prevUser.items.length - 1);
        }
    };

    const handleBackgroundClick = (e) => {
        const screenWidth = window.innerWidth;
        if (e.clientX < screenWidth / 2) {
            handlePrev();
        } else {
            handleNext();
        }
    };

    const handleLike = () => {
        const isLiked = localLikes[currentItem.id] !== undefined ? localLikes[currentItem.id] : currentItem.is_liked;
        const newLikeStatus = !isLiked;
        
        setLocalLikes(prev => ({ ...prev, [currentItem.id]: newLikeStatus })); 
        currentItem.is_liked = newLikeStatus;

        setAnimateLike(true);
        setTimeout(() => setAnimateLike(false), 300);

        fetch(`${baseURL}/api/stories/${currentItem.id}/like/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        }).catch(err => console.error("Error liking story:", err));
    };

    const handleDelete = () => {
        fetch(`${baseURL}/api/stories/${currentItem.id}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        }).then(() => {
            window.location.reload(); 
        }).catch(err => console.error("Error deleting story:", err));
    };

    const handleReply = (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        const formData = new FormData();
        formData.append('content', replyText);

        fetch(`${baseURL}/api/stories/${currentItem.id}/reply/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData,
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                setReplyText('');
            }
        }).catch(err => console.error("Error replying to story:", err));
    };

    if (!currentUser || !currentItem) return null;

    const isCurrentlyLiked = localLikes[currentItem.id] !== undefined ? localLikes[currentItem.id] : currentItem.is_liked;

    const visibility = currentItem.visibility || 'public';
    let themeColor = 'white';
    let visibilityText = 'Public';
    let textColor = 'black'; 

    if (visibility === 'followers') {
        themeColor = '#eab308'; 
        visibilityText = 'Followers Only';
        textColor = 'black'; 
    } else if (visibility === 'custom') {
        themeColor = 'black';
        visibilityText = 'Custom Viewers';
        textColor = 'white';
    }

    const filteredViews = viewFilter === 'likes' ? dynamicViews.filter(v => v.liked) : dynamicViews;

    return (
        <div 
            onClick={handleBackgroundClick} 
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', cursor: 'pointer' }}
        >
            
            <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                style={{ position: 'absolute', top: '20px', right: '30px', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', zIndex: 10000 }}
            >
                ✕
            </button>
            
            <div 
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'relative', width: '100%', maxWidth: '450px', height: '80vh', backgroundColor: 'var(--background)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `4px solid ${themeColor}`, cursor: 'default' }}
            >
                
                <div style={{ display: 'flex', gap: '4px', padding: '10px', position: 'absolute', top: 0, width: '100%', zIndex: 5, boxSizing: 'border-box' }}>
                    {currentUser.items.map((_, idx) => (
                        <div key={idx} style={{ flex: 1, height: '3px', backgroundColor: idx < itemIndex ? 'white' : 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                            {idx === itemIndex && <div style={{ height: '100%', backgroundColor: 'white', animation: `fillBar ${STORY_DURATION}ms linear forwards`, animationPlayState: showViewsModal ? 'paused' : 'running' }} />}
                        </div>
                    ))}
                </div>
            
                <div style={{ position: 'absolute', top: '25px', left: 0, width: '100%', padding: '10px', zIndex: 6, display: 'flex', alignItems: 'center' }}>
                    <a 
                        href={`/profile/${currentUser.username}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', cursor: 'pointer' }}
                    >
                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: 'var(--muted)', backgroundImage: currentUser.pic_url ? `url('${baseURL}${currentUser.pic_url}')` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {!currentUser.pic_url && (
                                <span style={{ color: 'var(--muted-foreground)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)', lineHeight: '1.2' }}>{currentUser.name || currentUser.username}</strong>
                            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>@{currentUser.username}</span>
                        </div>
                    </a>
                </div>

                <div style={{
                    position: 'absolute',
                    top: '30px',
                    right: '15px',
                    zIndex: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span style={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                    }}>
                        {getTimeAgo(currentItem.created_at)}
                    </span>

                    <div style={{
                        backgroundColor: themeColor,
                        color: textColor,
                        border: '2px solid #22c55e', 
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                    }}>
                        {visibilityText}
                    </div>
                </div>
            
                <div onClick={handlePrev} style={{ position: 'absolute', left: 0, top: 0, width: '30%', height: '100%', zIndex: 4, cursor: 'w-resize' }}></div>
                <div onClick={handleNext} style={{ position: 'absolute', right: 0, top: 0, width: '70%', height: '100%', zIndex: 4, cursor: 'e-resize' }}></div>
            
                <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundImage: currentItem.image_url ? `url('${baseURL}${currentItem.image_url}')` : 'none', backgroundColor: currentItem.image_url ? 'transparent' : 'var(--primary)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textShadow: '0 2px 5px rgba(0,0,0,0.8)', margin: 0, zIndex: 2, pointerEvents: 'none' }}>
                        {currentItem.text_content}
                    </p>
                </div>
            
                <div style={{ padding: '15px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', position: 'absolute', bottom: 0, width: '100%', zIndex: 10, display: 'flex', gap: '10px', boxSizing: 'border-box' }}>
                    {!currentItem.is_mine ? (
                        <form onSubmit={handleReply} style={{ display: 'flex', width: '100%', gap: '10px' }}>
                            <input 
                                type="text" 
                                placeholder="Reply..." 
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onClick={(e) => e.stopPropagation()} 
                                style={{ flexGrow: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '20px', padding: '10px 15px', color: 'white', outline: 'none' }} 
                            />
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleLike(); }} 
                                className={`like-btn ${isCurrentlyLiked ? 'liked' : ''} ${animateLike ? 'pop' : ''}`}
                            >
                                ❤︎
                            </button>
                        </form>
                    ) : (
                        <>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowViewsModal(true); }}
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: 'white', padding: '10px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', flexGrow: 1, textAlign: 'left' }}
                            >
                                𓂀 Views
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                        </>
                    )}
                </div>

                {showViewsModal && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 20, display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', backdropFilter: 'blur(5px)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ color: 'white', margin: 0 }}>Story Views</h3>
                            <button onClick={(e) => { e.stopPropagation(); setShowViewsModal(false); }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setViewFilter('all'); }}
                                style={{ flex: 1, padding: '8px', background: viewFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'transparent', border: '1px solid white', color: 'white', borderRadius: '20px', cursor: 'pointer', transition: 'background 0.2s' }}
                            >
                                All Views
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setViewFilter('likes'); }}
                                style={{ flex: 1, padding: '8px', background: viewFilter === 'likes' ? 'rgba(255,255,255,0.2)' : 'transparent', border: '1px solid white', color: 'white', borderRadius: '20px', cursor: 'pointer', transition: 'background 0.2s' }}
                            >
                                ❤️ Likes
                            </button>
                        </div>
                        
                        {isLoadingViews ? (
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>Loading viewers...</p>
                            </div>
                        ) : filteredViews.length === 0 ? (
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
                                    {viewFilter === 'likes' ? "No one has liked your story yet." : "No one has viewed your story yet."}
                                </p>
                            </div>
                        ) : (
                            <div style={{ width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {filteredViews.map((viewer, idx) => (
                                    <a key={idx} href={`/profile/${viewer.username}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'white' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--muted)', backgroundImage: viewer.profile_picture_url ? `url('${baseURL}${viewer.profile_picture_url}')` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                {!viewer.profile_picture_url && (
                                                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 'bold' }}>
                                                        {(viewer.name || viewer.username).charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ fontSize: '0.95rem' }}>{viewer.name || viewer.username}</strong>
                                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>@{viewer.username}</span>
                                            </div>
                                        </div>
                                        {viewer.liked && (
                                            <span style={{ color: '#ef4444', fontSize: '1.2rem' }}>❤︎</span>
                                        )}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fillBar {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                
                .like-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    transition: color 0.2s ease, transform 0.2s ease;
                }
                
                .like-btn:hover {
                    color: #ffb3b3; 
                }
                
                .like-btn.liked {
                    color: #ef4444; 
                }
                
                .like-btn.pop {
                    animation: popOut 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                
                @keyframes popOut {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.4); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}