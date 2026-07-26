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
      
      {/* PARENT ROUTE: The Layout acts as the base frame */}
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/auth" replace />}>
        
        {/* CHILD ROUTES: These get injected into Layout's <Outlet /> */}
        <Route path="/home" element={<Home />} />
        <Route path="/post/:id" element={<PostDetail />} />
        
        {/* 3. Uncomment and add your active routes here */}
        <Route path="profile" element={<Profile />} />
        <Route path="profile/:username" element={<Profile />} />
        <Route path="/search" element={<Search />} />
        {/* <Route path="/inbox" element={<Messages />} /> */}

        {/* Add these two new routes to stop the redirect! */}
        <Route path="inbox" element={<Inbox />} />
        {/* Note the :threadId parameter, you need to pull this inside ChatThread using the useParams() hook */}
        <Route path="messages/:threadId" element={<ChatThread />} />
        
      </Route>

      {/* CATCH-ALL */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/home" : "/auth"} replace />} />
    </Routes>
  );
}

export default App;