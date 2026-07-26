import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Search() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null); 
    const [isSearching, setIsSearching] = useState(false);
    const baseURL = import.meta.env.VITE_API_BASE_URL;

    const handleSearch = (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        
        setIsSearching(true);
        fetch(`${baseURL}/api/search/?q=${encodeURIComponent(query)}`, {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            setResults(data.results || []); 
            setIsSearching(false);
        })
        .catch(err => {
            console.error("Search error:", err);
            setIsSearching(false);
        });
    };

    return (
        <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'stretch', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', minHeight: '100vh' }}>
            
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--foreground)' }}>Search Directory</h2>
            </div>

            <div style={{ padding: '25px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '15px' }}>
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Locate user..." 
                        required 
                        style={{ flexGrow: 1, background: 'var(--background)', padding: '12px', color: 'var(--foreground)', border: '1px solid var(--border)', outline: 'none', fontSize: '1rem', fontFamily: 'inherit' }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                    <button 
                        type="submit" 
                        disabled={isSearching}
                        style={{ backgroundColor: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--muted-foreground)', padding: '8px 24px', fontWeight: 'bold', letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.8rem', transition: 'all 0.2s ease' }}
                        onMouseOver={(e) => { e.target.style.backgroundColor = 'var(--background)'; e.target.style.color = 'var(--foreground)'; }}
                        onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--muted-foreground)'; }}
                    >
                        {isSearching ? 'Scanning...' : 'Scan'}
                    </button>
                </form>
            </div>

            <div style={{ padding: '25px' }}>
                {results !== null ? (
                    <>
                        <h3 style={{ margin: '0 0 20px 0', color: 'var(--muted-foreground)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Results for "{query}"
                        </h3>
                        
                        {results.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {results.map((person) => (
                                    <Link 
                                        key={person.username} 
                                        to={`/profile/${person.username}`} 
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', transition: 'border-color 0.2s ease', textDecoration: 'none' }}
                                        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                    >
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--foreground)', fontSize: '1rem' }}>
                                                {person.profile_picture_url ? (
                                                    <img src={`${baseURL}${person.profile_picture_url}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    person.username.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ color: 'var(--foreground)', fontSize: '1.1rem' }}>
                                                    {person.name || person.username}
                                                </strong>
                                                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                                                    @{person.username}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', marginTop: '40px', fontStyle: 'italic' }}>
                                No users with that name. Make sure the username you put is EXACTLY what that person's name is.
                            </p>
                        )}
                    </>
                ) : (
                    <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', marginTop: '40px', fontStyle: 'italic' }}>
                        Looking for someone?
                    </p>
                )}
            </div>
        </main>
    );
}