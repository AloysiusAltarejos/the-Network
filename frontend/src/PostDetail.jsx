import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

// CSRF Token Helper
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

// Time Formatting Helper
function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);
    const fourWeeksInSeconds = 4 * 7 * 24 * 60 * 60; 

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    
    if (diffInSeconds < fourWeeksInSeconds) {
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }

    if (past.getFullYear() < now.getFullYear()) {
        return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
        const month = past.toLocaleDateString('en-US', { month: 'long' });
        const day = past.getDate();
        return `${month}-${day}`;
    }
}

// 1. Sub-component for individual replies in the flat thread
function CommentItem({ comment, baseURL, refreshThread, highlightedReplyId, triggerHighlight, canPostReply, recordReply, openReportModal }) {
    const [likes, setLikes] = useState(comment.likes);
    const [dislikes, setDislikes] = useState(comment.dislikes);
    const [hasLiked, setHasLiked] = useState(comment.has_liked);
    const [hasDisliked, setHasDisliked] = useState(comment.has_disliked);
    const [showOptions, setShowOptions] = useState(false);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isDeleted, setIsDeleted] = useState(false);
    const [popAction, setPopAction] = useState(null);

    const handleReplySubmit = (e) => {
        e.preventDefault();
        
        if (!canPostReply()) return;

        const formData = new FormData();
        formData.append('content', replyContent);
        formData.append('parent_id', comment.id);

        fetch(`${baseURL}/api/posts/${comment.post_id}/reply/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData,
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                recordReply(); 
                setReplyContent('');
                setShowReplyForm(false);
                refreshThread(); 
            }
        });
    };

    const handleInteraction = (action) => {
        setPopAction(action);
        setTimeout(() => setPopAction(null), 200);

        if (action === 'like') {
            setHasLiked(!hasLiked);
            setLikes(prev => hasLiked ? prev - 1 : prev + 1);
            if (hasDisliked) { setHasDisliked(false); setDislikes(prev => prev - 1); }
        } else if (action === 'dislike') {
            setHasDisliked(!hasDisliked);
            setDislikes(prev => hasDisliked ? prev - 1 : prev + 1);
            if (hasLiked) { setHasLiked(false); setLikes(prev => prev - 1); }
        } else if (action === 'delete') {
            fetch(`${baseURL}/api/comments/${comment.id}/delete/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include'
            }).then(res => {
                if (res.ok) setIsDeleted(true);
            });
            return;
        }

        fetch(`${baseURL}/api/comments/${comment.id}/${action}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        }).then(res => res.json()).then(data => {
            setLikes(data.likes);
            setDislikes(data.dislikes);
        });
    };

    if (isDeleted) return null;

    return (
        <div 
            id={`comment-${comment.id}`} 
            data-index={comment.thread_index} 
            className={`post-card comment-wrapper ${highlightedReplyId === String(comment.id) ? 'highlighted-reply' : ''}`}
            style={{ display: 'flex', gap: '15px', borderBottom: '1px solid var(--border)', padding: '20px 25px' }}
        >
            <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)' }}>
                <Link to={`/profile/${comment.author_username}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    {comment.profile_picture_url ? (
                        <img src={`${baseURL}${comment.profile_picture_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                    ) : (
                        comment.author_username.charAt(0).toUpperCase()
                    )}
                </Link>
            </div>

            <div style={{ flexGrow: 1 }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--primary)' }}>REPLY {comment.thread_index}</span>
                    
                    {comment.parent_index && (
                        <button 
                            className="reply-reference-btn"
                            onClick={() => {
                                const parentEl = document.querySelector(`[data-index="${comment.parent_index}"]`);
                                if (parentEl) {
                                    const parentId = parentEl.id.replace('comment-', '');
                                    window.history.pushState(null, '', `#comment-${parentId}`);
                                    triggerHighlight(parentId);
                                }
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            ↪ replying to reply {comment.parent_index}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Link to={`/profile/${comment.author_username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <strong style={{ color: 'var(--foreground)' }}>{comment.author_name || comment.author_username}</strong>
                        </Link>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', marginLeft: '5px' }}>
                            @{comment.author_username} &bull; {formatTimeAgo(comment.smart_date)}
                        </span>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowOptions(!showOptions)} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}>
                            ⋯
                        </button>
                        {showOptions && (
                            <div className="options-dropdown" style={{ display: 'block', position: 'absolute', right: 0, zIndex: 10 }}>
                                {comment.is_author ? (
                                    <button onClick={() => handleInteraction('delete')} className="delete-btn">
                                        Delete
                                    </button>
                                ) : (
                                    <button onClick={() => openReportModal('comment', comment.id)} className="report-btn">
                                        Report
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <p style={{ margin: '10px 0', color: 'var(--foreground)', lineHeight: '1.5' }}>{comment.content}</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                    <button 
                        onClick={() => handleInteraction('like')} 
                        className={`interact-btn like-btn ${hasLiked ? 'active' : ''} ${popAction === 'like' ? 'pop-animate' : ''}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: 0, display: 'flex', alignItems: 'center', gap: '5px', color: hasLiked ? 'var(--primary)' : 'var(--muted-foreground)' }}
                    >
                        ❤︎⁠ <span>{likes}</span>
                    </button>

                    <button 
                        onClick={() => handleInteraction('dislike')} 
                        className={`interact-btn dislike-btn comment-interact-btn ${hasDisliked ? 'active' : ''} ${popAction === 'dislike' ? 'pop-animate' : ''}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: 0, display: 'flex', alignItems: 'center', gap: '5px', color: hasDisliked ? '#ef4444' : 'var(--muted-foreground)' }}
                    >
                        🛇 <span>{dislikes}</span>
                    </button>

                    <button 
                        onClick={() => setShowReplyForm(!showReplyForm)} 
                        className="comment-interact-btn"
                        style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        💬 Reply
                    </button>
                </div>

                {showReplyForm && (
                    <form onSubmit={handleReplySubmit} style={{ marginTop: '15px', border: '1px solid var(--border)', padding: '15px', backgroundColor: 'var(--muted)' }}>
                        <textarea 
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={`Reply to @${comment.author_username} (Reply ${comment.thread_index})...`} 
                            rows="1" 
                            required
                            style={{ width: '100%', padding: '10px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', resize: 'none', outline: 'none', fontFamily: 'inherit', margin: '0 0 10px 0' }} 
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="submit-reply-btn" style={{ backgroundColor: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--muted-foreground)', padding: '6px 18px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                Send
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// 2. Main Component
export default function PostDetail() {
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportText, setReportText] = useState("");
    const [reportConfig, setReportConfig] = useState({ type: 'post', id: null });
    
    const location = useLocation();
    const [highlightedReplyId, setHighlightedReplyId] = useState(null);
    const { id } = useParams();
    const baseURL = import.meta.env.VITE_API_BASE_URL;
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mainReply, setMainReply] = useState('');

    const [postLikes, setPostLikes] = useState(0);
    const [postDislikes, setPostDislikes] = useState(0);
    const [postHasLiked, setPostHasLiked] = useState(false);
    const [postHasDisliked, setPostHasDisliked] = useState(false);

    const [popAction, setPopAction] = useState(null);
    
    const replyTimestamps = useRef([]);

    const canPostReply = () => {
        const now = Date.now();
        replyTimestamps.current = replyTimestamps.current.filter(time => now - time < 60000);
        
        if (replyTimestamps.current.length >= 4) {
            alert("Rate limit exceeded: You can only post 4 replies per minute. Please wait.");
            return false;
        }
        return true;
    };

    const recordReply = () => {
        replyTimestamps.current.push(Date.now());
    };

    const triggerHighlight = (replyId) => {
        const element = document.getElementById(`comment-${replyId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setHighlightedReplyId(replyId);
        setTimeout(() => setHighlightedReplyId(null), 3000);
    };

    // Consolidated effect for handling hashes properly
    useEffect(() => {
        if (!loading && location.hash && location.hash.startsWith('#comment-')) {
            const replyId = location.hash.replace('#comment-', '');
            setTimeout(() => triggerHighlight(replyId), 100); 
        }
    }, [location.hash, loading]);

    const fetchThreadData = () => {
        fetch(`${baseURL}/api/posts/${id}/`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setPost(data.post);
                setComments(data.comments); 
                setPostLikes(data.post.likes);
                setPostDislikes(data.post.dislikes);
                setPostHasLiked(data.post.has_liked);
                setPostHasDisliked(data.post.has_disliked);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };
    
    useEffect(() => {
        fetchThreadData();
    }, [id]);

    const handleMainPostInteraction = (action) => {
        setPopAction(action);
        setTimeout(() => setPopAction(null), 200);
        if (action === 'like') {
            setPostHasLiked(!postHasLiked);
            setPostLikes(prev => postHasLiked ? prev - 1 : prev + 1);
            if (postHasDisliked) { setPostHasDisliked(false); setPostDislikes(prev => prev - 1); }
        } else if (action === 'dislike') {
            setPostHasDisliked(!postHasDisliked);
            setPostDislikes(prev => postHasDisliked ? prev - 1 : prev + 1);
            if (postHasLiked) { setPostHasLiked(false); setPostLikes(prev => prev - 1); }
        }

        fetch(`${baseURL}/api/posts/${id}/${action}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        }).then(res => res.json()).then(data => {
            setPostLikes(data.likes);
            setPostDislikes(data.dislikes);
        });
    };

    const handleMainReply = (e) => {
        e.preventDefault();
        
        if (!canPostReply()) return;

        const formData = new FormData();
        formData.append('content', mainReply);

        fetch(`${baseURL}/api/posts/${id}/reply/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData,
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                recordReply(); 
                setMainReply('');
                fetchThreadData(); 
            }
        });
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--muted-foreground)' }}>Loading Thread...</div>;
    if (!post) return <div style={{ textAlign: 'center', padding: '50px', color: 'var(--muted-foreground)' }}>Post not found.</div>;

    return (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%',  margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', minHeight: '100vh' }}>
            
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border)' }}>
                <Link to="/Home" className="back-feed-link" style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>
                    <span style={{ fontSize: '1.2rem', lineHeight: '0' }}>←</span> Back to Feed
                </Link>
            </div>

            <div style={{ display: 'flex', gap: '15px', borderBottom: '1px solid var(--border)', padding: '25px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ width: '56px', height: '56px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', fontSize: '1.4rem' }}>
                    <Link to={`/profile/${post.author_username}`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {post.profile_picture_url ? (
                            <img src={`${baseURL}${post.profile_picture_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                        ) : (
                            post.author_username.charAt(0).toUpperCase()
                        )}
                    </Link>
                </div>
                
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <Link to={`/profile/${post.author_username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <strong style={{ color: 'var(--foreground)', fontSize: '1.1rem' }}>{post.author_name || post.author_username}</strong>
                                </Link>
                                <br />
                                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>@{post.author_username} &bull; {formatTimeAgo(post.smart_date)}</span>
                            </div>
                        </div>
                        {post.followers_only && (
                            <span style={{ width: 'fit-content', color: '#fbbf24', border: '1px solid #fbbf24', padding: '2px 6px', fontSize: '0.75rem', marginTop: '5px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                🔒 Posted for followers only
                            </span>
                        )}
                    </div>
                    
                    <p style={{ margin: '0 0 20px 0', fontSize: '1.2rem', lineHeight: '1.6', color: 'var(--foreground)', wordWrap: 'break-word' }}>{post.content}</p>
                    
                    {post.image_url && (
                        <div style={{ 
                            marginBottom: '20px', 
                            border: '1px solid var(--border)', 
                            maxHeight: '50vh', 
                            backgroundColor: '#000', 
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden' 
                        }}>
                            <img 
                                src={`${baseURL}${post.image_url}`} 
                                alt="Post" 
                                style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '50vh', 
                                    objectFit: 'contain', 
                                    display: 'block' 
                                }} 
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '30px', color: 'var(--muted-foreground)', fontSize: '0.9rem', marginBottom: '10px' }}>
                        <button 
                            onClick={() => handleMainPostInteraction('like')} 
                            className={`interact-btn like-btn ${postHasLiked ? 'active' : ''} ${popAction === 'like' ? 'pop-animate' : ''}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: postHasLiked ? 'var(--primary)' : 'var(--muted-foreground)' }}
                        >
                            ❤︎⁠ <span>{postLikes}</span>
                        </button>
                        <button 
                            onClick={() => handleMainPostInteraction('dislike')} 
                            className={`interact-btn dislike-btn ${postHasDisliked ? 'active' : ''} ${popAction === 'dislike' ? 'pop-animate' : ''}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: postHasDisliked ? '#ef4444' : 'var(--muted-foreground)' }}
                        >
                            🛇 <span>{postDislikes}</span>
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Main Reply Form */}
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}>
                <form onSubmit={handleMainReply} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                        value={mainReply}
                        onChange={(e) => setMainReply(e.target.value)}
                        placeholder="Post a reply..."
                        rows="3"
                        required
                        style={{ 
                            width: '100%', 
                            padding: '15px', 
                            background: 'var(--background)', 
                            color: 'var(--foreground)', 
                            border: '1px solid var(--border)', 
                            resize: 'none', 
                            outline: 'none', 
                            fontFamily: 'inherit', 
                            boxSizing: 'border-box' 
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                            type="submit" 
                            style={{ 
                                backgroundColor: 'transparent', 
                                color: 'var(--muted-foreground)', 
                                border: '1px solid var(--muted-foreground)', 
                                padding: '8px 20px', 
                                fontWeight: 'bold', 
                                cursor: 'pointer', 
                                textTransform: 'uppercase', 
                                fontSize: '0.85rem',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.target.style.color = 'var(--foreground)'; e.target.style.borderColor = 'var(--foreground)'; }}
                            onMouseLeave={(e) => { e.target.style.color = 'var(--muted-foreground)'; e.target.style.borderColor = 'var(--muted-foreground)'; }}
                        >
                            Reply
                        </button>
                    </div>
                </form>
            </div>

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {comments.length > 0 ? (
                    comments.map((comment) => (
                        <CommentItem 
                            key={comment.id}
                            comment={comment}
                            baseURL={baseURL}
                            refreshThread={fetchThreadData}
                            highlightedReplyId={highlightedReplyId}
                            triggerHighlight={triggerHighlight}
                            canPostReply={canPostReply}
                            recordReply={recordReply}
                            openReportModal={(type, id) => { 
                                setReportConfig({ type, id }); 
                                setShowReportModal(true); 
                            }}
                        />
                    ))
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                        No replies yet.
                    </div>
                )}
            </div>

            {/* Reusable Report Modal */}
            {showReportModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: '#000', border: '1px solid #333', width: '450px', maxWidth: '90%', padding: '30px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 15px 0', textTransform: 'uppercase', color: '#fff', letterSpacing: '1px' }}>
                            Report {reportConfig.type === 'post' ? 'Post' : 'Reply'}
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
                                        body: JSON.stringify({ 
                                            type: reportConfig.type, 
                                            id: reportConfig.id, 
                                            reason: reportText 
                                        }),
                                        credentials: 'include'
                                    })
                                    .then(async (res) => {
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.error);
                                        setShowReportModal(false);
                                        setReportText(""); 
                                        alert("Report submitted successfully.");
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