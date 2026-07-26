import { useState, useRef, useEffect } from 'react';

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

const AnimatedButton = ({ children, onClick, type = "button", baseStyle, hoverStyle, disabled }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    return (
        <button
            type={type}
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            onMouseEnter={() => !disabled && setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
            onMouseDown={() => !disabled && setIsPressed(true)}
            onMouseUp={() => !disabled && setIsPressed(false)}
            style={{
                ...baseStyle,
                transition: 'all 0.2s ease',
                transform: isPressed && !disabled ? 'scale(0.92)' : (isHovered && !disabled ? 'translateY(-2px)' : 'translateY(0)'),
                boxShadow: isHovered && !disabled ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                ...(isHovered && !disabled ? hoverStyle : {})
            }}
        >
            {children}
        </button>
    );
};

export default function CreatePost({ setPosts, currentFeed }) {
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [imageFile, setImageFile] = useState(null);
    const [myPic, setMyPic] = useState(null); 
    const fileInputRef = useRef(null);
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';

    // Fetch the profile picture to display next to the input
    useEffect(() => {
        fetch(`${baseURL}/api/profile/`, {
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => setMyPic(data.profile.profile_picture))
            .catch(error => console.error("Error fetching profile:", error));
    }, [baseURL]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim() && !imageFile) return;

        const csrftoken = getCookie('csrftoken');
        const formData = new FormData();
        formData.append('content', content);
        formData.append('visibility', visibility);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        fetch(`${baseURL}/api/posts/create/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken 
            },
            credentials: 'include',
            body: formData 
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(newPost => {
            if (newPost.followers_only && currentFeed === 'global') { 
                console.log("Post created, but hidden from global feed.");
            } else {
                setPosts(prevPosts => [newPost, ...prevPosts]); 
            }
            setContent('');
            setImageFile(null);
            setVisibility('public');
        })
        .catch(error => console.error("Error submitting post:", error));
    };

    return (
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* Top Row: Profile Pic & Text Area */}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: 'var(--muted)', flexShrink: 0, overflow: 'hidden' }}>
                        {myPic ? (
                            <img src={`${baseURL}${myPic}`} alt="My Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--muted-foreground)' }}>
                                A
                            </div>
                        )}
                    </div>
                    
                    <textarea 
                        placeholder="What's happening in your network?" 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required={!imageFile}
                        style={{ 
                            width: '100%', 
                            minHeight: '45px', 
                            padding: '10px 0', 
                            backgroundColor: 'transparent', 
                            color: 'var(--foreground)', 
                            border: 'none', 
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            fontSize: '1rem'
                        }}
                    />
                </div>
                
                {/* Subtle divider matching the UI */}
                <hr style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--muted)', margin: '0 0 15px 0' }} />

                {/* Bottom Row: Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Image Upload */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                            type="button" 
                            className="image-text-input"
                            onClick={() => fileInputRef.current.click()}
                            style={{ background: 'transparent', cursor: 'pointer', border: 'none', color: 'var(--muted-foreground)', transition: 'color 0.4s' }}
                            onMouseEnter={(e) => e.target.style.color = 'var(--foreground)'}
                            onMouseLeave={(e) => e.target.style.color = 'var(--muted-foreground)'}
                        >
                            [¯◉°]
                        </button>
                        <input 
                            type="file" 
                            accept="image/png, image/jpeg" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }}
                            onChange={(e) => setImageFile(e.target.files[0])}
                        />
                        {imageFile && <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{imageFile.name}</span>}
                    </div>

                    {/* Visibility & Submit */}
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <AnimatedButton 
                            type="button"
                            onClick={() => setVisibility(prev => prev === 'public' ? 'followers' : 'public')}
                            baseStyle={{ 
                                backgroundColor: 'transparent',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: visibility === 'public' ? 'var(--primary)' : 'rgba(234, 179, 8, 1)', 
                                color: visibility === 'public' ? 'var(--primary)' : 'rgba(234, 179, 8, 1)', 
                                padding: '8px 15px', 
                                borderRadius: '5px', 
                                cursor: 'pointer', 
                                fontWeight: 'bold' 
                            }}
                            hoverStyle={{
                                backgroundColor: visibility === 'public' ? 'var(--primary)' : 'rgba(234, 179, 8, 1)',
                                color: visibility === 'public' ? 'var(--background)' : '#000',
                            }}
                        >
                            {visibility === 'public' ? '✈︎ Public' : '🔒︎ Followers'}
                        </AnimatedButton>

                        <AnimatedButton 
                            type="submit" 
                            baseStyle={{ 
                                padding: '8px 20px', 
                                backgroundColor: 'transparent', 
                                color: 'var(--foreground)', 
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: 'var(--muted-foreground)', 
                                borderRadius: '5px', 
                                cursor: 'pointer', 
                                fontWeight: 'bold' 
                            }}
                            hoverStyle={{
                                backgroundColor: 'var(--foreground)',
                                color: 'var(--background)',
                                borderColor: 'var(--foreground)'
                            }}
                        >
                            SEND
                        </AnimatedButton>
                    </div>
                </div>
            </form>
        </div>
    );
}