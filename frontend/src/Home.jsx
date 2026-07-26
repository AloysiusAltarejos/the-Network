import { useState, useEffect, useRef, useCallback } from 'react';
import CreatePost from './components/CreatePost';
import Post from './Post';
import AddStoryModal from './components/AddStoryModal';
import FeedToggle from './components/FeedToggle';
import StoryModal from './components/StoryModal';
import StoryTray from './components/StoryTray';
import SuggestedConnection from './components/SuggestedConnections';

export default function Home() {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    
    const [currentFeed, setCurrentFeed] = useState(() => localStorage.getItem('feedPreference') || 'global');
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        localStorage.setItem('feedPreference', currentFeed);
        setPosts([]);
        setPage(1);
        setHasMore(true);
    }, [currentFeed]);
    
    useEffect(() => {
        if (!hasMore && page !== 1) return;

        setLoading(true);
        
        fetch(`${baseURL}/api/home/?feed=${currentFeed}&page=${page}`, {
            credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                console.log("Raw data from Django:", data);
                setPosts(prevPosts => {
                    if (page === 1) return data.posts;
                    
                    const existingIds = new Set(prevPosts.map(p => p.id));
                    const newPosts = data.posts.filter(p => !existingIds.has(p.id));
                    return [...prevPosts, ...newPosts];
                });
                
                setHasMore(data.has_next); 
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                setLoading(false);
            });
    }, [currentFeed, page]);

    const observer = useRef();
    
    const lastPostElementRef = useCallback(node => {
        if (loading) return;
        
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    return (
        <div className="home-content" style={{ margin: '0 auto', width: '100%', padding: '20px 0' }}>
            
            {/* 1. The Stories Row */}
            <StoryTray />

            {/* 2. The Feed Toggle (Global / Following) */}
            <FeedToggle currentFeed={currentFeed} setCurrentFeed={setCurrentFeed} />

            {/* 3. The Input to Create a New Regular Post */}
            <CreatePost setPosts={setPosts} currentFeed={currentFeed} />

            {/* ---> Suggested Connections Box <--- */}
            <SuggestedConnection />

            {/* Feed Rendering */}
            <div className="feed-container">
                {posts.map((post, index) => {
                    if (posts.length === index + 1) {
                        return (
                            <div ref={lastPostElementRef} key={post.id}>
                                <Post postData={post} />
                            </div>
                        );
                    } else {
                        return <Post postData={post} key={post.id} />;
                    }
                })}
            </div>

            {/* Empty State: No posts in the database yet */}
            {!loading && posts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted-foreground)' }}>
                    <span className="neon-title" style={{ fontSize: '1.2rem' }}>It's quiet here...</span>
                    <p>No posts found in this feed. Be the first to create one!</p>
                </div>
            )}

            {/* Loading Indicator at the bottom */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted-foreground)' }}>
                    <span className="neon-title" style={{ fontSize: '1rem' }}>Loading the network...</span>
                </div>
            )}

            {/* End of Feed Message */}
            {!hasMore && posts.length > 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)' }}>
                    You have caught up on all posts.
                </div>
            )}
        </div>
    );
}