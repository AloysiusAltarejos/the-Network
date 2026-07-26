import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function SuggestedConnections() {
    const [suggestions, setSuggestions] = useState([]);
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        fetch(`${baseURL}/api/suggested/`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                setSuggestions(data.suggested || []); 
            })
            .catch(err => console.error("Fetch Error:", err));
    }, []);

    if (suggestions.length === 0) {
        return (
            <div style={{ 
                padding: '30px 20px', 
                margin: '10px 0',
                textAlign: 'center', 
                color: 'var(--muted-foreground)', 
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--background)'
            }}>
                No new accounts to suggest at the moment.
            </div>
        );
    }

    return (
        <div style={{ borderBottom: '1px solid var(--border)', padding: '25px', width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--background)' }}>
            <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>
                𖠋 People You May Know
            </p>
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'thin' }}>
                {suggestions.map(profile => (
                    <div key={profile.username} className="suggested-card-anim" style={{ minWidth: '140px', maxWidth: '140px', border: '1px solid var(--border)', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backgroundColor: 'var(--muted)', flexShrink: 0 }}>
                        
                        <Link to={`/profile/${profile.username}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--background)', border: '2px solid var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', fontSize: '1.5rem' }}>
                                {profile.pic_url ? (
                                    <img src={`${baseURL}${profile.pic_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={profile.username} />
                                ) : (
                                    profile.username.charAt(0).toUpperCase()
                                )}
                            </div>
                            <strong style={{ color: 'var(--foreground)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                {profile.name}
                            </strong>
                            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginBottom: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                @{profile.username}
                            </span>
                        </Link>
                        
                        <button className="follow-btn-anim" style={{ width: '100%', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '6px 0', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 'auto' }}>
                            Follow
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}