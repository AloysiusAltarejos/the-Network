export default function FeedToggle({ currentFeed, setCurrentFeed }) {
    return (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--muted)' }}>
            
            <button 
                className="feed-toggle-btn"
                onClick={() => setCurrentFeed('global')}
                style={{ 
                    flex: 1, 
                    textAlign: 'center', 
                    padding: '15px', 
                    background: 'transparent', 
                    cursor: 'pointer',
                    color: currentFeed === 'global' ? 'var(--primary)' : 'var(--muted-foreground)', 
                    fontWeight: 'bold', 
                    border: 'none',
                    borderBottom: currentFeed === 'global' ? '2px solid var(--primary)' : 'none', 
                    transition: 'background-color 0.2s ease' 
                }}
            >
                ✈︎ Public
            </button>
            
            <button 
                className="feed-toggle-btn"
                onClick={() => setCurrentFeed('following')}
                style={{ 
                    flex: 1, 
                    textAlign: 'center', 
                    padding: '15px', 
                    background: 'transparent', 
                    cursor: 'pointer',
                    color: currentFeed === 'following' ? 'var(--primary)' : 'var(--muted-foreground)', 
                    fontWeight: 'bold', 
                    border: 'none',
                    borderBottom: currentFeed === 'following' ? '2px solid var(--primary)' : 'none', 
                    transition: 'background-color 0.2s ease' 
                }}
            >
                👁👁 Following
            </button>

        </div>
    );
}