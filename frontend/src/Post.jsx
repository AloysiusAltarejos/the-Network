import { useState } from 'react';
import { Link } from 'react-router-dom'; 

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

export default function Post({ postData }) {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    // Report state
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportText, setReportText] = useState("");

    // Interaction State
    const [likes, setLikes] = useState(postData.likes);
    const [dislikes, setDislikes] = useState(postData.dislikes);
    const [hasLiked, setHasLiked] = useState(postData.has_liked);
    const [hasDisliked, setHasDisliked] = useState(postData.has_disliked);
    
    // Animation & UI State
    const [isDeleted, setIsDeleted] = useState(false);
    const [popAction, setPopAction] = useState(null); 
    const [showOptions, setShowOptions] = useState(false);

    const handleAction = (action) => {
        setPopAction(action);
        setTimeout(() => setPopAction(null), 200);

        // UI updates
        if (action === 'like') {
            setHasLiked(!hasLiked);
            setLikes(prev => hasLiked ? prev - 1 : prev + 1);
            if (hasDisliked) {
                setHasDisliked(false);
                setDislikes(prev => prev - 1);
            }
        } else if (action === 'dislike') {
            setHasDisliked(!hasDisliked);
            setDislikes(prev => hasDisliked ? prev - 1 : prev + 1);
            if (hasLiked) {
                setHasLiked(false);
                setLikes(prev => prev - 1);
            }
        }

        // Fetch request mirroring togglePostInteraction logic
        fetch(`${baseURL}/api/posts/${postData.id}/${action}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (action === 'delete') {
                setIsDeleted(true);
            } else if (data.status) {
                // Assuming backend returns status like liked or unliked
                setLikes(data.likes);
                setDislikes(data.dislikes);
            }
        })
        .catch(err => console.error(`Error performing ${action}:`, err));
    };

    if (isDeleted) return null;

    return (
        <div className="post-card" style={{ display: 'flex', gap: '15px', borderBottom: '1px solid var(--border)', padding: '25px', width: '100%', boxSizing: 'border-box' }}>
            
            {/* Profile Avatar */}
            <div style={{ width: '56px', height: '56px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', fontSize: '1.4rem' }}>
                <Link to={`/profile/${postData.author_username}`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {postData.profile_picture_url ? (
                        <img src={`${baseURL}${postData.profile_picture_url}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        postData.author_username.charAt(0).toUpperCase()
                    )}
                </Link>
            </div>
                
            <div style={{ flexGrow: 1, minWidth: 0 }}>
                {/* Header (Author & Options) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Link to={`/profile/${postData.author_username}`} className="author-link" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <strong style={{ color: 'var(--foreground)', fontSize: '1.1rem' }}>
                                {postData.author_name || postData.author_username}
                            </strong>
                        </Link>

                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Link to={`/profile/${postData.author_username}`} style={{ textDecoration: 'none', color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                                @{postData.author_username}
                            </Link>
                            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                                &bull; {postData.smart_date}
                            </span>

                            {postData.followers_only && (
                                <span style={{ fontSize: '0.7rem', color: '#eab308', border: '1px solid #eab308', padding: '2px 6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    🔒︎ Posted for followers only
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Options Menu (⋯) ported from your comment HTML */}
                    <div className="relative-container">
                        <button 
                            onClick={() => setShowOptions(!showOptions)}
                            style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px', lineHeight: 1 }}
                            onMouseOver={(e) => e.target.style.color = 'var(--foreground)'}
                            onMouseOut={(e) => e.target.style.color = 'var(--muted-foreground)'}
                        >
                            ⋯
                        </button>
                    
                        {showOptions && (
                            <div className="options-dropdown" style={{ display: 'block' }}>
                                {postData.is_author ? (
                                    <button onClick={() => handleAction('delete')} className="delete-btn">
                                        Delete
                                    </button>
                                ) : (
                                    <button onClick={() => setShowReportModal(true)} className="report-btn">
                                        Report
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Content */}
                <p style={{ margin: '0 0 20px 0', fontSize: '1.2rem', lineHeight: '1.6', color: 'var(--foreground)', wordWrap: 'break-word' }}>
                    {postData.content}
                </p>

                {/* Optional Image Rendering */}
                {postData.image_url && (
                    <div style={{ 
                        marginBottom: '20px', 
                        border: '1px solid var(--border)', 
                        maxHeight: '500px', 
                        backgroundColor: '#000',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden' 
                    }}>
                        <img 
                            src={`${baseURL}${postData.image_url}`} 
                            alt="Post" 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '500px', 
                                objectFit: 'contain', 
                                display: 'block' 
                            }} 
                        />
                    </div>
                )}
                
                {/* Interactions Footer */}
                <div style={{ display: 'flex', gap: '30px', color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '10px' }}>
                    <button 
                        onClick={() => handleAction('like')} 
                        className={`interact-btn like-btn ${hasLiked ? 'active' : ''} ${popAction === 'like' ? 'pop-animate' : ''}`}
                    >
                        ❤︎⁠ <span>{likes}</span>
                    </button>
                    
                    <button 
                        onClick={() => handleAction('dislike')} 
                        className={`interact-btn dislike-btn ${hasDisliked ? 'active' : ''} ${popAction === 'dislike' ? 'pop-animate' : ''}`}
                    >
                        🛇 <span>{dislikes}</span>
                    </button>
                    <Link to={`/post/${postData.id}`} className="reply-hover-link" style={{ textDecoration: 'none', color: 'var(--muted-foreground)' }}>
                        💬 Replies {postData.comments_count || 0}
                    </Link>
                </div>
            </div>
            {showReportModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: '#000', border: '1px solid #333', width: '450px', maxWidth: '90%', padding: '30px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 15px 0', textTransform: 'uppercase', color: '#fff', letterSpacing: '1px' }}>
                            Report Post
                        </h3>
                        <textarea
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            placeholder="Provide details here..."
                            maxLength={255}
                            style={{ 
                                width: '100%', 
                                height: '120px', 
                                backgroundColor: '#111', 
                                color: '#fff', 
                                border: '1px solid #333', 
                                padding: '15px', 
                                marginBottom: '20px', 
                                resize: 'none', 
                                outline: 'none',
                                boxSizing: 'border-box',
                                borderRadius: '4px',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#555'}
                            onBlur={(e) => e.target.style.borderColor = '#333'}
                        />
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                            <button 
                                onClick={() => {
                                    setShowReportModal(false);
                                    setReportText(""); 
                                }} 
                                onMouseEnter={(e) => { e.target.style.backgroundColor = '#222'; e.target.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.transform = 'translateY(0)'; }}
                                style={{ padding: '10px 24px', backgroundColor: 'transparent', border: '1px solid #555', color: '#fff', cursor: 'pointer', transition: 'all 0.2s ease', borderRadius: '4px', fontWeight: 'bold' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    fetch(`${baseURL}/api/report/`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                                        body: JSON.stringify({ type: 'post', id: postData.id, reason: reportText }),
                                        credentials: 'include'
                                    })
                                    .then(async (res) => {
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.error);
                                        setShowReportModal(false);
                                        setReportText("");
                                        alert("Post reported.");
                                    })
                                    .catch(err => alert(err.message));
                                }} 
                                disabled={!reportText.trim()}
                                onMouseEnter={(e) => { if(!e.target.disabled) { e.target.style.filter = 'brightness(1.15)'; e.target.style.transform = 'translateY(-2px)'; } }}
                                onMouseLeave={(e) => { if(!e.target.disabled) { e.target.style.filter = 'none'; e.target.style.transform = 'translateY(0)'; } }}
                                style={{ padding: '10px 24px', backgroundColor: '#ef4444', border: 'none', color: '#fff', cursor: !reportText.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', borderRadius: '4px', opacity: !reportText.trim() ? 0.5 : 1, fontWeight: 'bold' }}
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}