import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StoryModal from './components/StoryModal';

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

//Reusable Animated Button
const AnimatedButton = ({ children, onClick, baseStyle, hoverStyle, isLabel, disabled, className }) => {
    const [isHovered, setIsHovered] = useState(false);
    const Component = isLabel ? 'label' : 'button';

    return (
        <Component
            className={className}
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            onMouseEnter={() => !disabled && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                ...baseStyle,
                display: 'inline-block',
                transition: 'all 0.2s ease',
                transform: isHovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered && !disabled ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                ...(isHovered && !disabled ? hoverStyle : {})
            }}
        >
            {children}
        </Component>
    );
};

// Reusable Network Stat Button
const NetworkStat = ({ count, label, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div 
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                cursor: 'pointer', 
                color: isHovered ? 'var(--primary)' : 'var(--muted-foreground)', 
                transition: 'color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
            }}
        >
            <strong style={{ color: isHovered ? 'var(--primary)' : 'var(--foreground)', fontSize: '1.1rem', transition: 'color 0.2s ease' }}>{count || 0}</strong> 
            <span>{label}</span>
        </div>
    );
};

const EditableField = ({ label, field, value, isCurrentUser, editingField, editValue, setEditValue, handleEditToggle, handleSaveEdit }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                border: '1px solid transparent',
                borderBottom: '1px solid var(--border)', 
                borderColor: isHovered ? 'var(--primary)' : 'transparent',
                borderBottomColor: isHovered ? 'var(--primary)' : 'var(--border)',
                padding: '15px',
                backgroundColor: isHovered ? 'var(--muted)' : 'transparent',
                transition: 'all 0.2s ease',
                borderRadius: '4px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</strong>
                {isCurrentUser && (
                    <button 
                        onClick={() => handleEditToggle(field, value)} 
                        style={{ background: 'none', border: 'none', color: isHovered ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', transition: 'color 0.2s ease' }}
                    >
                        {editingField === field ? 'Cancel' : 'Edit'}
                    </button>
                )}
            </div>
            
            {editingField === field ? (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <input 
                        type={field === 'email' ? 'email' : 'text'}
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus 
                        style={{ flexGrow: 1, background: 'var(--background)', padding: '8px 12px', color: 'var(--foreground)', border: '1px solid var(--border)', outline: 'none' }} 
                    />
                    <button onClick={() => handleSaveEdit(field)} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', border: '1px solid var(--primary)', padding: '6px 15px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.75rem' }}>Save</button>
                </div>
            ) : (
                <span style={{ color: 'var(--foreground)', fontSize: '1rem' }}>{value || "Not set"}</span>
            )}
        </div>
    );
};

const FeedItem = ({ item, navigate }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onClick={() => navigate(`/post/${item.post_id || item.id}`)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                border: '1px solid var(--border)', 
                borderColor: isHovered ? 'var(--primary)' : 'var(--border)',
                padding: '20px', 
                marginBottom: '15px', 
                backgroundColor: isHovered ? 'var(--muted)' : 'var(--background)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered ? '0 4px 12px rgba(29, 78, 216, 0.15)' : 'none',
                borderRadius: '8px'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                <strong style={{ color: 'var(--foreground)' }}>@{item.author_username}</strong>
                
                {item.target_username && (
                    <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                        replied to @{item.target_username}
                    </span>
                )}

                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>{item.smart_date}</span>
                {item.followers_only && (
                    <span style={{ color: '#fbbf24', border: '1px solid #fbbf24', padding: '2px 6px', fontSize: '0.75rem', marginLeft: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        🔒 Posted for followers only
                    </span>
                )}
            </div>
            
            {item.content ? (
                <p style={{ margin: '0 0 15px 0', lineHeight: 1.6, color: 'var(--foreground)' }}>{item.content}</p>
            ) : (
                <p style={{ margin: '0 0 15px 0', lineHeight: 1.6, color: 'var(--muted-foreground)', fontStyle: 'italic', fontWeight: 'bold', letterSpacing: '1px' }}>
                    [ PHOTO ONLY ]
                </p>
            )}
        </div>
    );
};

const Profile = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';

    const [profile, setProfile] = useState({});
    const [isCurrentUser, setIsCurrentUser] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState("");
    
    // Story states
    const [allStories, setAllStories] = useState([]);
    const [targetStoryId, setTargetStoryId] = useState(null);

    // Modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showNetworkModal, setShowNetworkModal] = useState(false);
    const [networkType, setNetworkType] = useState(''); 
    
    const [reportText, setReportText] = useState("");
    const [networkUsers, setNetworkUsers] = useState([]);
    const [loadingNetwork, setLoadingNetwork] = useState(false);
    const [isFollowing, setIsFollowing] = useState(profile?.is_following || false);
    
    const [activeTab, setActiveTab] = useState('posts');
    const [feedItems, setFeedItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const getImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${baseURL}${url}`;
    };

    // Fetch Base Profile
    useEffect(() => {
        const fetchProfile = async () => {
            const endpoint = username ? `/api/profile/${username}/` : `/api/profile/`;
            try {
                const response = await fetch(`${baseURL}${endpoint}`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setProfile(data.profile);
                    setIsCurrentUser(data.is_current_user);
                    setIsFollowing(data.profile.is_following || false);
                }
            } catch (error) {
                console.error("Error fetching profile", error);
            }
        };
        fetchProfile();
    }, [username, baseURL]);
    
    // Fetch stories to calculate dynamic borders and click logic
    useEffect(() => {
        fetch(`${baseURL}/api/stories/`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setAllStories(data.stories || []))
            .catch(err => console.error("Error fetching stories:", err));
    }, [baseURL]);

    // Resolved race condition for Tab switching
    useEffect(() => {
        let ignore = false; 
        
        setFeedItems([]);
        setPage(1);
        setHasMore(true);
        setIsLoading(true);
        
        const fetchInitialTab = async () => {
            const endpoint = username ? `/api/profile/${username}/feed/` : `/api/profile/feed/`;
            try {
                const response = await fetch(`${baseURL}${endpoint}?tab=${activeTab}&page=1`, { credentials: 'include' });
                const data = await response.json();
                
                if (!ignore) {
                    setFeedItems(data.items || []);
                    setHasMore(data.has_next);
                    setIsLoading(false);
                }
            } catch (err) {
                if (!ignore) {
                    console.error("Fetch error:", err);
                    setIsLoading(false);
                }
            }
        };

        fetchInitialTab();
        
        return () => { ignore = true; }; 
    }, [activeTab, username, baseURL]);

    const handleLoadMore = async () => {
        if (isLoading || !hasMore) return;
        setIsLoading(true);
        
        const nextPage = page + 1;
        setPage(nextPage);
        
        const endpoint = username ? `/api/profile/${username}/feed/` : `/api/profile/feed/`;
        
        try {
            const response = await fetch(`${baseURL}${endpoint}?tab=${activeTab}&page=${nextPage}`, { credentials: 'include' });
            const data = await response.json();
            
            setFeedItems(prevItems => {
                const existingIds = new Set(prevItems.map(item => item.id));
                const newItems = (data.items || []).filter(item => !existingIds.has(item.id));
                return [...prevItems, ...newItems];
            });
            setHasMore(data.has_next);
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const openNetworkModal = (type) => {
        setNetworkType(type);
        setShowNetworkModal(true);
        setLoadingNetwork(true);
        setNetworkUsers([]);

        fetch(`${baseURL}/api/profile/${profile.username}/${type}/`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                const usersArray = Array.isArray(data) ? data : (data.users || data.results || []);
                setNetworkUsers(usersArray);
                setLoadingNetwork(false);
            })
            .catch(err => {
                console.error(`Error fetching ${type} data`, err);
                setLoadingNetwork(false);
            });
    };

    const handleMessageUser = () => {
        fetch(`${baseURL}/api/messages/start/${profile.username}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.thread_id) {
                navigate(`/messages/${data.thread_id}`);
            }
        })
        .catch(err => console.error("Error starting chat:", err));
    };

    const handleFollowToggle = () => {
        setIsFollowing(!isFollowing);
        setProfile(prev => ({
            ...prev, 
            followers_count: isFollowing ? prev.followers_count - 1 : prev.followers_count + 1 
        }));

        fetch(`${baseURL}/api/profile/${profile.username}/follow/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            credentials: 'include'
        })
        .catch(err => {
            console.error("Error toggling follow:", err);
            setIsFollowing(isFollowing); 
        });
    };

    const handleSubmitReport = () => {
        if (!reportText.trim()) return;
        
        fetch(`${baseURL}/api/report/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ 
                type: 'user', 
                id: profile.username,
                reason: reportText 
            }),
            credentials: 'include'
        })
        .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to report');
            setShowReportModal(false);
            setReportText("");
            alert("Report submitted successfully.");
        })
        .catch(err => {
            alert(err.message);
            setShowReportModal(false);
        });
    };

    const handleEditToggle = (field, currentValue) => {
        if (editingField === field) {
            setEditingField(null);
        } else {
            setEditingField(field);
            setEditValue(currentValue || "");
        }
    };

    const handleSaveEdit = async (field) => {
        try {
            const response = await fetch(`${baseURL}/api/profile/update/`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ field: field, value: editValue }),
                credentials: 'include'
            });
            if (response.ok) {
                setProfile(prev => ({ ...prev, [field]: editValue }));
                setEditingField(null);
            }
        } catch (error) {
            console.error("Failed to update", error);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image_upload', file);
        formData.append('field', 'profile_picture');

        try {
            const response = await fetch(`${baseURL}/api/profile/update/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }, 
                body: formData,
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setProfile(prev => ({ ...prev, profile_picture: data.new_image_url }));
            }
        } catch (error) {
            console.error("Failed to upload image", error);
        }
    };

    const handleRemovePicture = async () => {
        const formData = new FormData();
        formData.append('field', 'remove_picture');

        try {
            const response = await fetch(`${baseURL}/api/profile/update/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                body: formData,
                credentials: 'include'
            });
            if (response.ok) {
                setProfile(prev => ({ ...prev, profile_picture: null }));
            }
        } catch (error) {
            console.error("Failed to remove image", error);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            const response = await fetch(`${baseURL}/account/delete/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include'
            });
            if (response.ok) {
                navigate('/login');
            }
        } catch (error) {
            console.error("Failed to delete account", error);
        }
    };

    // --- DYNAMIC STORY BORDER LOGIC ---
    const userStories = allStories.find(s => s.username === profile.username);
    let profileBorder = '1px solid var(--border)'; 
    let activeStory = null;
    let hasStories = false;
    let cursorStyle = 'default';

    if (userStories && userStories.items && userStories.items.length > 0) {
        hasStories = true;
        cursorStyle = 'pointer';
        const allViewed = userStories.items.every(item => item.viewed || item.is_viewed);
        
        activeStory = userStories.items.find(item => !(item.viewed || item.is_viewed)) || userStories.items[0];

        if (allViewed) {
            profileBorder = '4px solid var(--muted-foreground)';
        } else if (activeStory.visibility === 'followers') {
            profileBorder = '4px solid #eab308'; // Yellow
        } else if (activeStory.visibility === 'custom') {
            profileBorder = '4px solid black';
        } else {
            profileBorder = '4px solid white';
        }
    }

    const handleProfilePicClick = () => {
        if (hasStories && activeStory) {
            setTargetStoryId(activeStory.id);
        }
    };

    return (
        <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'stretch', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--foreground)' }}>
                    {profile.username}'s Profile
                </h2>
            </div>

            <div style={{ padding: '40px 25px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backgroundColor: 'var(--muted)' }}>
                
                {/* Profile Picture with Dynamic Border and Click Action */}
                <div 
                    onClick={handleProfilePicClick}
                    style={{ 
                        width: '150px', 
                        height: '150px', 
                        flexShrink: 0, 
                        backgroundColor: 'var(--background)', 
                        border: profileBorder,
                        borderRadius: '50%',
                        cursor: cursorStyle, 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        overflow: 'hidden', 
                        fontWeight: 'bold', 
                        fontFamily: 'monospace', 
                        color: 'var(--foreground)', 
                        fontSize: '4rem', 
                        marginBottom: '20px' 
                    }}
                >
                    {profile.profile_picture ? (
                        <img src={getImageUrl(profile.profile_picture)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        profile.username?.charAt(0).toUpperCase()
                    )}
                </div>

                {isCurrentUser && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', justifyContent: 'center' }}>
                        <AnimatedButton
                            isLabel={true}
                            baseStyle={{ backgroundColor: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--muted-foreground)', padding: '6px 15px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.75rem' }}
                            hoverStyle={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', borderColor: 'var(--foreground)' }}
                        >
                            {profile.profile_picture ? 'Change Picture' : 'Add Picture'}
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
                        </AnimatedButton>
                        
                        {profile.profile_picture && (
                            <AnimatedButton
                                onClick={handleRemovePicture}
                                baseStyle={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 15px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.75rem' }}
                                hoverStyle={{ backgroundColor: '#ef4444', color: '#fff' }}
                            >
                                Remove
                            </AnimatedButton>
                        )}
                    </div>
                )}

                {/* Danger Zone */}
                {isCurrentUser && (
                    <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', textAlign: 'center', marginBottom: '30px' }}>
                        <h3 style={{ color: '#ef4444', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '1rem' }}>Danger Zone</h3>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', marginBottom: '15px'}}>Press this button to delete your account.</p>
                        <button 
                            className="logout-hover" 
                            onClick={() => setShowDeleteModal(true)} 
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto' }}
                        >
                            Delete Account
                        </button>
                    </div>
                )}

                {/* Network Stats */}
                <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', marginBottom: '25px', color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                    <NetworkStat 
                        count={profile.following_count} 
                        label="Following" 
                        onClick={() => openNetworkModal('following')} 
                    />
                    <div>|</div>
                    <NetworkStat 
                        count={profile.followers_count} 
                        label="Followers" 
                        onClick={() => openNetworkModal('followers')} 
                    />
                </div>

                {/* Non-User Profile Actions */}
                {!isCurrentUser && profile.username && (
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <AnimatedButton
                            onClick={handleFollowToggle}
                            baseStyle={{ padding: '8px 24px', backgroundColor: isFollowing ? 'transparent' : 'var(--primary)', color: isFollowing ? 'var(--foreground)' : 'var(--primary-foreground)', border: isFollowing ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}
                            hoverStyle={{ backgroundColor: isFollowing ? 'var(--background)' : 'var(--primary)', filter: isFollowing ? 'none' : 'brightness(1.15)', borderColor: isFollowing ? 'var(--foreground)' : 'transparent' }}
                        >
                            {isFollowing ? 'Unfollow' : 'Follow'}
                        </AnimatedButton>

                        <AnimatedButton
                            onClick={handleMessageUser}
                            baseStyle={{ padding: '8px 24px', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}
                            hoverStyle={{ filter: 'brightness(1.15)' }}
                        >
                            ✉︎ Message
                        </AnimatedButton>

                        <AnimatedButton
                            onClick={() => setShowReportModal(true)}
                            baseStyle={{ padding: '8px 24px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}
                            hoverStyle={{ backgroundColor: '#ef4444', color: '#fff' }}
                        >
                            ⚠ Report
                        </AnimatedButton>
                    </div>
                )}
            </div>

            {/* REMOVED MAX WIDTH TO MATCH OLD FULL-WIDTH LAYOUT */}
            <div style={{ width: '100%', paddingBottom: '40px' }}>
                
                {/* Editable Fields */}
                <div style={{ padding: '20px 25px' }}>
                    <EditableField label="Nickname" field="name" value={profile.name} isCurrentUser={isCurrentUser} editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleEditToggle={handleEditToggle} handleSaveEdit={handleSaveEdit} />
                    <EditableField label="Email" field="email" value={profile.email} isCurrentUser={isCurrentUser} editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleEditToggle={handleEditToggle} handleSaveEdit={handleSaveEdit} />
                    <EditableField label="Pronouns" field="pronouns" value={profile.pronouns} isCurrentUser={isCurrentUser} editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleEditToggle={handleEditToggle} handleSaveEdit={handleSaveEdit} />
                    <EditableField label="Location" field="location" value={profile.location} isCurrentUser={isCurrentUser} editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleEditToggle={handleEditToggle} handleSaveEdit={handleSaveEdit} />
                    <EditableField label="Bio" field="bio" value={profile.bio} isCurrentUser={isCurrentUser} editingField={editingField} editValue={editValue} setEditValue={setEditValue} handleEditToggle={handleEditToggle} handleSaveEdit={handleSaveEdit} />
                </div>

                {/* Tabs */}
                <div style={{ fontFamily: 'Solway', display: 'flex', borderBottom: '1px solid var(--border)', width: 'auto', backgroundColor: 'var(--muted)', marginBottom: '20px', borderRadius: '8px', overflowX: 'auto', whiteSpace: 'nowrap', margin: '0 25px 20px 25px', scrollbarWidth: 'none' }}>
                    {['✎🗒.ᐟ Posts', '↪ Replies', '❤︎⁠ Liked', '⊘ Disliked'].map((tabName) => (
                        <button 
                            key={tabName}
                            className="feed-toggle-btn"
                            onClick={() => setActiveTab(tabName)}
                            style={{ 
                                flex: 1, 
                                textAlign: 'center', 
                                padding: '15px', 
                                background: 'transparent', 
                                cursor: 'pointer', 
                                textTransform: 'capitalize', 
                                color: activeTab === tabName ? 'var(--primary)' : 'var(--muted-foreground)', 
                                fontWeight: 'bold', 
                                border: 'none', 
                                borderBottom: activeTab === tabName ? '2px solid var(--primary)' : 'none',
                                transition: 'background-color 0.2s ease'
                            }}>
                            {tabName}
                        </button>
                    ))}
                </div>

                {/* Feed Content */}
                <div style={{ width: '100%', padding: '0 25px', boxSizing: 'border-box' }}>
                    {feedItems.map((item, index) => (
                        <FeedItem key={index} item={item} navigate={navigate} />
                    ))}
                    
                    {feedItems.length === 0 && !isLoading && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-foreground)', fontStyle: 'italic', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                            Nothing to see here yet.
                        </div>
                    )}
                </div>

                {/* Animated Load More Button */}
                {hasMore && feedItems.length > 0 && (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <AnimatedButton 
                            onClick={handleLoadMore} 
                            disabled={isLoading}
                            baseStyle={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                            hoverStyle={{ backgroundColor: 'var(--muted)', borderColor: 'var(--foreground)' }}
                        >
                            {isLoading ? 'Loading...' : 'Load More'}
                        </AnimatedButton>
                    </div>
                )}

            </div> {/* End Centering Wrapper */}

            {/* Network Modal (Followers / Following) */}
            {showNetworkModal && (
                <div 
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }} 
                    onClick={() => setShowNetworkModal(false)}
                >
                    <div 
                        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', width: '450px', maxWidth: '90%', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--foreground)', fontSize: '1rem' }}>
                                {networkType === 'followers' ? 'Followers' : 'Following'}
                            </h3>
                            <button onClick={() => setShowNetworkModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>
                        
                        <div style={{ padding: '0', overflowY: 'auto', flexGrow: 1 }}>
                            {loadingNetwork ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>
                            ) : networkUsers.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                                    No {networkType} found.
                                </div>
                            ) : (
                                networkUsers.map((user, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => {
                                            setShowNetworkModal(false);
                                            navigate(`/profile/${user.username}`);
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--muted)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', borderRadius: '50%' }}>
                                            {user.profile_picture_url || user.profile_picture ? (
                                                <img src={getImageUrl(user.profile_picture_url || user.profile_picture)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                user.username.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <strong style={{ color: 'var(--foreground)' }}>{user.name || user.username}</strong>
                                            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>@{user.username}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Report Account Modal */}
            {showReportModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', width: '450px', maxWidth: '90%', padding: '30px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--foreground)' }}>Report @{profile.username}</h3>
                        <p style={{ color: 'var(--muted-foreground)', marginBottom: '20px', fontSize: '0.9rem' }}>Please describe what this person did. Your report will be reviewed by the creator of the site himself.</p>
                        
                        <textarea
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            placeholder="Provide details here..."
                            style={{ width: '100%', height: '120px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', padding: '15px', marginBottom: '20px', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                        />

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                            <AnimatedButton 
                                onClick={() => setShowReportModal(false)} 
                                baseStyle={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 'bold' }}
                                hoverStyle={{ backgroundColor: 'var(--muted)', borderColor: 'var(--foreground)' }}
                            >
                                Cancel
                            </AnimatedButton>
                            
                            <AnimatedButton 
                                onClick={handleSubmitReport} 
                                disabled={!reportText.trim()} 
                                baseStyle={{ padding: '10px 20px', backgroundColor: '#ef4444', border: 'none', color: '#fff', cursor: !reportText.trim() ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: !reportText.trim() ? 0.5 : 1 }}
                                hoverStyle={{ filter: 'brightness(1.15)' }}
                            >
                                Send Report
                            </AnimatedButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(9, 14, 23, 0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--background)', border: '1px solid #ef4444', width: '450px', maxWidth: '90%', padding: '30px', textAlign: 'center' }}>
                        <h3 style={{ color: '#ef4444', margin: '0 0 15px 0', textTransform: 'uppercase' }}>Confirm Deletion</h3>
                        <p style={{ color: 'var(--foreground)', marginBottom: '30px' }}>This button deletes your account forever. Are you sure?</p>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                            <AnimatedButton 
                                className="cancel-delete-account-button" 
                                onClick={() => setShowDeleteModal(false)} 
                                baseStyle={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 'bold' }}
                                hoverStyle={{ backgroundColor: 'var(--muted)', borderColor: 'var(--foreground)' }}
                            >
                                Cancel
                            </AnimatedButton>

                            <AnimatedButton 
                                className="delete-account-final-button" 
                                onClick={handleDeleteAccount} 
                                baseStyle={{ padding: '10px 20px', backgroundColor: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                                hoverStyle={{ filter: 'brightness(1.15)' }}
                            >
                                Yes, Delete My Account
                            </AnimatedButton>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Conditional Story Modal Render */}
            {targetStoryId && allStories.length > 0 && (
                <StoryModal 
                    stories={allStories} 
                    initialUserIndex={allStories.findIndex(s => s.username === profile.username)} 
                    targetStoryId={targetStoryId} 
                    onClose={() => setTargetStoryId(null)} 
                />
            )}
        </main>
    );
};

export default Profile;