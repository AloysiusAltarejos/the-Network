import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StoryModal from './StoryModal';
import AddStoryModal from './AddStoryModal';

export default function StoryTray() {
    const [stories, setStories] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStoryIndex, setSelectedStoryIndex] = useState(null);
    
    // FIX 1: Read the query parameter from Layout.jsx
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const routeStoryId = queryParams.get('story');
    
    const [myPic, setMyPic] = useState(null); 
    const baseURL = import.meta.env.VITE_API_BASE_URL;

    useEffect(() => {
        fetch(`${baseURL}/api/stories/`, {
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => setStories(data.stories))
            .catch(error => console.error("Error fetching stories:", error));
            
        fetch(`${baseURL}/api/profile/`, {
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => setMyPic(data.profile.profile_picture))
            .catch(error => console.error("Error fetching profile:", error));
    }, [baseURL]);

    // Clear query param from the URL when the modal is closed
    const handleCloseModal = () => {
        setSelectedStoryIndex(null);
        if (routeStoryId) {
            navigate('/home', { replace: true });
        }
    };

    return (
        <>
            <div style={{ display: 'flex', overflowX: 'auto', padding: '15px 0', marginBottom: '20px', borderBottom: '1px solid var(--border)', gap: '15px', scrollbarWidth: 'none' }}>
                
                {/* ADD STORY BUTTON */}
                <div 
                    onClick={() => setShowAddModal(true)} 
                    style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', border: '2px dashed var(--muted-foreground)', cursor: 'pointer', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--muted)' }}
                >
                    {myPic ? (
                        <img src={`${baseURL}${myPic}`} alt="My Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--muted-foreground)' }}>
                            A
                        </div>
                    )}
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '22px', height: '22px', backgroundColor: 'var(--primary)', borderRadius: '50%', border: '3px solid var(--background)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-foreground)', fontWeight: 'bold', fontSize: '14px', lineHeight: 1, boxSizing: 'content-box' }}>
                        +
                    </div>
                </div>

                {/* FRIEND STORY BUBBLES */}
                {stories.map((user, index) => {
                    // FIX 3: Check for both is_viewed and viewed to ensure the gray border works
                    const allViewed = user.items.every(item => item.viewed || item.is_viewed);
                    const activeStory = user.items.find(item => !(item.viewed || item.is_viewed)) || user.items[0];

                    let dynamicBorderColor = 'white'; 
                    if (activeStory.visibility === 'followers') {
                        dynamicBorderColor = '#eab308'; 
                    } else if (activeStory.visibility === 'custom') {
                        dynamicBorderColor = 'black'; 
                    }

                    const finalBorderColor = allViewed ? 'var(--muted-foreground)' : dynamicBorderColor;

                    return (
                        <div 
                            key={user.username}
                            onClick={() => setSelectedStoryIndex(index)}
                            title={`View ${user.username}'s story`}
                            style={{ 
                                width: '60px', 
                                height: '60px', 
                                borderRadius: '50%', 
                                border: `3px solid ${finalBorderColor}`, 
                                cursor: 'pointer', 
                                flexShrink: 0, 
                                backgroundColor: 'var(--muted)', 
                                // FIX 2: Added baseURL to the picture fetch
                                backgroundImage: user.pic_url ? `url('${baseURL}${user.pic_url}')` : 'none', 
                                backgroundSize: 'cover', 
                                backgroundPosition: 'center' 
                            }}
                        />
                    );
                })}
            </div>

            {/* Passes the routeStoryId down so the modal knows exactly which item to skip to */}
            {(selectedStoryIndex !== null || routeStoryId) && stories.length > 0 && (
                <StoryModal 
                    stories={stories} 
                    initialUserIndex={selectedStoryIndex !== null ? selectedStoryIndex : 0} 
                    targetStoryId={routeStoryId} 
                    onClose={handleCloseModal} 
                />
            )}

            {showAddModal && (
                <AddStoryModal onClose={() => setShowAddModal(false)} />
            )}
        </>
    );
}