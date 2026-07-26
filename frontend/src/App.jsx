import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Home from './Home';
import AuthPage from './AuthPage';
import Layout from './Layout';
import Profile from './Profile';
import Search from './Search';
import PostDetail from './PostDetail';
import Inbox from './Inbox';
import ChatThread from './ChatThread';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
      localStorage.getItem('isAuthenticated') === 'true'
  );

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage setIsAuthenticated={setIsAuthenticated} />} />
      
      {/* This is the parent route. The Layout acts as the base frame */}
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/auth" replace />}>
        
        {/* child routes. These get injected into Layout's <Outlet /> */}
        <Route path="/home" element={<Home />} />
        <Route path="/post/:id" element={<PostDetail />} />
        
        {/* add active routes here */}
        <Route path="profile" element={<Profile />} />
        <Route path="profile/:username" element={<Profile />} />
        <Route path="/search" element={<Search />} />

        {/* handles messages and conversations */}
        <Route path="inbox" element={<Inbox />} />
        <Route path="messages/:threadId" element={<ChatThread />} />
        
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? "/home" : "/auth"} replace />} />
    </Routes>
  );
}

export default App;