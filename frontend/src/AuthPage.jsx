import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthPage({ setIsAuthenticated }) {
    const [isLogin, setIsLogin] = useState(true);
    
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        passwordConfirmation: '',
        pronouns: '',
        bio: '',
        location: ''
    });

    const navigate = useNavigate();

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const baseURL = import.meta.env.VITE_API_BASE_URL || '';
        const endpoint = isLogin ? '/api/login/' : '/api/register/';
        
        try {
            const response = await fetch(`${baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
                credentials: 'include' 
            });

            if (response.ok) {
                localStorage.setItem('isAuthenticated', 'true');
                console.log("Authentication successful!");
                setIsAuthenticated(true);
                navigate('/Home');
            } else {
                // Safely check if the response is actually JSON before parsing
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    console.error("Auth failed:", errorData);
                    alert(`Login failed: ${errorData.error || 'Please check your inputs.'}`);
                } else {
                    console.error("Auth failed: Received non-JSON response from server.");
                    alert("Server error. Please verify your Django urls.py and views.py.");
                }
            }
        } catch (error) {
            console.error("Network error during auth", error);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-header">
                <button 
                    className={`nav-item-entrance ${isLogin ? 'active' : ''}`}
                    onClick={() => setIsLogin(true)}
                >
                    I HAVE AN ACCOUNT
                </button>
                <button 
                    className={`nav-item-entrance ${!isLogin ? 'active' : ''}`}
                    onClick={() => setIsLogin(false)}
                >
                    I WANT TO CREATE A NEW ACCOUNT
                </button>
            </div>

            <div className="auth-content pop-animate">
                <h2>{isLogin ? 'Log in to The Network' : 'Create an Account'}</h2>
                
                <form onSubmit={handleSubmit} id={isLogin ? 'loginForm' : 'registerForm'}>
                    
                    <div className="input-group">
                        <label>Username:</label>
                        <input 
                            type="text" 
                            name="username" 
                            value={formData.username} 
                            onChange={handleInputChange} 
                            required 
                        />
                        {!isLogin && (
                            <p className="help-text">Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.</p>
                        )}
                    </div>

                    {!isLogin && (
                        <div className="input-group">
                            <label>Email:</label>
                            <input 
                                type="email" 
                                name="email" 
                                value={formData.email} 
                                onChange={handleInputChange} 
                                required 
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label>Password:</label>
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleInputChange} 
                            required 
                        />
                        {!isLogin && (
                            <ul className="help-text-list">
                                <li>Your password can’t be too similar to your other personal information.</li>
                                <li>Your password must contain at least 8 characters.</li>
                                <li>Your password can’t be a commonly used password.</li>
                                <li>Your password can’t be entirely numeric.</li>
                            </ul>
                        )}
                    </div>

                    {/* Registration-only fields */}
                    {!isLogin && (
                        <>
                            <div className="input-group">
                                <label>Password confirmation:</label>
                                <input 
                                    type="password" 
                                    name="passwordConfirmation" 
                                    value={formData.passwordConfirmation} 
                                    onChange={handleInputChange} 
                                    required 
                                />
                                <p className="help-text">Enter the same password as before, for verification.</p>
                            </div>

                            <div className="input-group">
                                <label>Pronouns:</label>
                                <textarea 
                                    name="pronouns" 
                                    value={formData.pronouns} 
                                    onChange={handleInputChange}
                                    maxLength={20}
                                    rows="1"
                                    required
                                />
                                {!isLogin && (
                                    <p className="help-text">Limited to 20 characters only</p>
                                )}
                                
                            </div>

                            <div className="input-group">
                                <label>Bio:</label>
                                <textarea 
                                    name="bio" 
                                    value={formData.bio} 
                                    onChange={handleInputChange}
                                    maxLength={150}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Location:</label>
                                <input 
                                    type="text" 
                                    name="location" 
                                    value={formData.location} 
                                    onChange={handleInputChange}
                                />
                                {!isLogin && (
                                    <p className="help-text">Optional. Don't put too sensitive info even if this website is secure</p>
                                )}
                            </div>
                        </>
                    )}

                    <button type="submit" id="submitBtn" className="interact-btn">
                        {isLogin ? 'Login' : 'Sign Up'}
                    </button>
                </form>
            </div>
        </div>
    );
}