import { useState, useRef, useEffect, useMemo } from 'react';

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

export default function AddStoryModal({ onClose }) {
    const [textContent, setTextContent] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [imageFile, setImageFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState(''); // New state for search bar
    
    const [limits, setLimits] = useState({ photos_left: 5, text_left: 5 }); 
    const [isLoadingLimits, setIsLoadingLimits] = useState(true);

    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    const fileInputRef = useRef(null);

    // Fetch limits cleanly using headers to bypass cache
    useEffect(() => {
        fetch(`${baseURL}/api/stories/limits/`, {
            credentials: 'include',
            cache: 'no-store'
        })
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(data => {
            setLimits(data);
            setIsLoadingLimits(false);
        })
        .catch(err => {
            console.error("Failed to fetch limits", err);
            setIsLoadingLimits(false);
        });
    }, [baseURL]);

    useEffect(() => {
        if (visibility === 'custom' && availableUsers.length === 0) {
            setIsLoadingUsers(true);
            fetch(`${baseURL}/api/users/`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    setAvailableUsers(data);
                    setIsLoadingUsers(false);
                })
                .catch(err => {
                    console.error("Failed to fetch users", err);
                    setIsLoadingUsers(false);
                });
        }
    }, [visibility, baseURL, availableUsers.length]);

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const toggleUserSelection = (userId) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    // Filter and Sort Users: Selected users always stay at the top, then filter by search query
    const filteredAndSortedUsers = useMemo(() => {
        let filtered = availableUsers.filter(user => 
            (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.username || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filtered.sort((a, b) => {
            const aSelected = selectedUserIds.has(a.id);
            const bSelected = selectedUserIds.has(b.id);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0;
        });
    }, [availableUsers, searchQuery, selectedUserIds]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('text_content', textContent);
        formData.append('visibility', visibility);
        
        if (imageFile) {
            formData.append('image', imageFile);
        }

        if (visibility === 'custom') {
            formData.append('allowed_users', JSON.stringify(Array.from(selectedUserIds)));
        }

        fetch(`${baseURL}/api/stories/add/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData,
            credentials: 'include',
        })
        .then(response => {
            if (response.ok) {
                onClose(); 
                window.location.reload(); 
            } else {
                console.error("Failed to upload story");
                setIsSubmitting(false);
            }
        })
        .catch(error => {
            console.error("Error:", error);
            setIsSubmitting(false);
        });
    };

    // Helper component for the Profile Picture
    const UserAvatar = ({ user }) => {
        if (user.profile_picture) {
            // Ensure we don't duplicate the domain if the backend already provides an absolute URL
            const imgUrl = user.profile_picture.startsWith('http') 
                ? user.profile_picture 
                : `${baseURL.replace(/\/$/, '')}${user.profile_picture}`;
                
            return (
                <img 
                    src={imgUrl} 
                    alt={user.username} 
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
                />
            );
        }
        // Fallback to a colored initial if no picture exists
        return (
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem', flexShrink: 0 }}>
                {(user.name || user.username).charAt(0).toUpperCase()}
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
            
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--background)', borderRadius: '10px', padding: '25px', position: 'relative', border: '1px solid var(--border)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                
                <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--foreground)', fontSize: '1.2rem', cursor: 'pointer' }}>
                    ✕
                </button>
                
                <h3 style={{ marginTop: 0, color: 'var(--foreground)', marginBottom: '5px' }}>Create Story</h3>
                
                {!isLoadingLimits && (
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                        <span style={{ color: limits.text_left === 0 ? '#ef4444' : 'inherit' }}>
                            📝 Text Left: <strong>{limits.text_left}/5</strong>
                        </span>
                        <span style={{ color: limits.photos_left === 0 ? '#ef4444' : 'inherit' }}>
                            📷 Photos Left: <strong>{limits.photos_left}/5</strong>
                        </span>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', paddingRight: '5px' }}>
                    
                    <textarea 
                        placeholder="What's happening?" 
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        disabled={limits.text_left === 0 && !imageFile}
                        style={{ width: '100%', padding: '15px', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: '8px', minHeight: '100px', resize: 'none', boxSizing: 'border-box' }}
                        maxLength={200}
                        required={!imageFile} 
                    />
                    
                    <select 
                        value={visibility} 
                        onChange={(e) => setVisibility(e.target.value)}
                        style={{ padding: '10px', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: '8px', outline: 'none' }}
                    >
                        <option value="public">🌍 Public (Everyone)</option>
                        <option value="followers">👁👁 Followers Only</option>
                        <option value="custom">🔒 Custom (Choose Viewers)</option>
                    </select>

                    {visibility === 'custom' && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', backgroundColor: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            
                            {/* Mini Search Bar */}
                            <input 
                                type="text"
                                placeholder="Search the users"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box', outline: 'none' }}
                            />

                            <div style={{ maxHeight: '180px', overflowY: 'auto', borderRadius: '6px' }}>
                                {isLoadingUsers ? (
                                    <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '10px' }}>Loading users...</div>
                                ) : filteredAndSortedUsers.length === 0 ? (
                                    <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '10px' }}>No users found.</div>
                                ) : (
                                    filteredAndSortedUsers.map(user => {
                                        const isSelected = selectedUserIds.has(user.id);
                                        return (
                                            <div 
                                                key={user.id} 
                                                onClick={() => toggleUserSelection(user.id)} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '12px', 
                                                    padding: '10px', 
                                                    cursor: 'pointer', 
                                                    borderBottom: '1px solid var(--border)',
                                                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent', // Light blue tint if selected
                                                    transform: isSelected ? 'scale(0.99)' : 'scale(1)',
                                                    transition: 'all 0.2s ease-in-out', // Smooth animations
                                                }}
                                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)' }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={() => toggleUserSelection(user.id)}
                                                    onClick={(e) => e.stopPropagation()} // Prevent double firing
                                                    style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                                                />
                                                
                                                <UserAvatar user={user} />

                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ color: 'var(--foreground)', fontSize: '0.95rem', fontWeight: isSelected ? 'bold' : 'normal' }}>
                                                        {user.name || user.username}
                                                    </span>
                                                    <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>
                                                        @{user.username}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    <div 
                        onClick={() => {
                            if (limits.photos_left > 0) fileInputRef.current.click();
                        }}
                        style={{ 
                            border: '2px dashed var(--border)', 
                            borderRadius: '8px', 
                            padding: '20px', 
                            textAlign: 'center', 
                            cursor: limits.photos_left > 0 ? 'pointer' : 'not-allowed',
                            color: 'var(--muted-foreground)', 
                            backgroundColor: 'var(--muted)',
                            opacity: limits.photos_left === 0 ? 0.5 : 1 
                        }}
                    >
                        {imageFile ? (
                            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓ {imageFile.name} selected</span>
                        ) : limits.photos_left === 0 ? (
                            <span style={{ color: '#ef4444' }}>❌ Photo limit reached for today</span>
                        ) : (
                            <span>📷 Click to upload an image (optional)</span>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleImageChange} 
                            style={{ display: 'none' }} 
                            disabled={limits.photos_left === 0}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={
                            isSubmitting || 
                            (!textContent && !imageFile) || 
                            (imageFile && limits.photos_left === 0) || 
                            (!imageFile && limits.text_left === 0) ||
                            (visibility === 'custom' && selectedUserIds.size === 0)
                        }
                        style={{ padding: '12px', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: '10px' }}
                    >
                        {isSubmitting ? 'Posting...' : 'Post Story'}
                    </button>

                </form>
            </div>
        </div>
    );
}