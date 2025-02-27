// App.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import NewPostSection from './NewPostSection';
import EditPost from './EditPost';
import './App.css';
import Parse from 'parse/dist/parse.min.js';

// Environment variables - in a real app these would be in .env file
const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const CITY_NAME = 'Alkmaar';
Parse.initialize(process.env.REACT_APP_BACK4APP_APP_ID, process.env.REACT_APP_BACK4APP_REST_API_KEY);
Parse.serverURL = "https://parseapi.back4app.com/";

// Sample data - used as fallback when database is empty
const initialPosts = [
  {
    id: 1,
    title: "Stay tuned!",
    text: "We'll publish new posts frequently with updates from our projects!",
    mediaType: "image",
    mediaUrl: "",
    mediaComment: ""
  }
];

// Authentication and session management 
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Check for existing auth in session storage on load
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('isAuthenticated');
    const storedUser = sessionStorage.getItem('currentUser');

    if (storedAuth === 'true' && storedUser) {
      setIsAuthenticated(true);
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const login = useCallback((username) => {
    setIsAuthenticated(true);
    setCurrentUser({ username, role: 'admin' });
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('currentUser', JSON.stringify({ username, role: 'admin' }));
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('currentUser');
  }, []);

  const authContextValue = useMemo(
    () => ({ isAuthenticated, currentUser, login, logout }),
    [isAuthenticated, currentUser, login, logout]
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Protected route component
function ProtectedRoute({ children }) {
  const { isAuthenticated } = React.useContext(AuthContext);

  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<KioskDisplay />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong.</h2>
          <p>Please refresh the page or contact your administrator.</p>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Kiosk Display Component
function KioskDisplay() {
  const [posts, setPosts] = useState(initialPosts);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [weather, setWeather] = useState({
    temp: "Loading...",
    condition: "Loading...",
    city: CITY_NAME
  });
  const [news, setNews] = useState(["Loading the latest news from the Netherlands..."]);
  const [isPostVisible, setIsPostVisible] = useState(true);
  const [adminBtnVisible, setAdminBtnVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rotationTime, setRotationTime] = useState(30000); // 30 seconds
  const [timeRemaining, setTimeRemaining] = useState(rotationTime / 1000);
  const navigate = useNavigate();

  // Fetch posts from Back4App
  useEffect(() => {
    const fetchPosts = async () => {
      const Post = Parse.Object.extend('Post');
      const query = new Parse.Query(Post);
      query.descending("createdAt"); // Get newest posts first
      
      try {
        const results = await query.find();
        
        if (results.length === 0) {
          console.log('No posts found in database, using initial sample post');
          return; // Keep using initialPosts
        }
        
        const parsedPosts = results.map(post => ({
          id: post.id,
          title: post.get('title'),
          text: post.get('content'),
          mediaType: post.get('mediaType') || 'image',
          mediaUrl: post.get('mediaUrl') || '/api/placeholder/800/600',
          mediaComment: post.get('imageComment') || '',
          createdAt: post.get('createdAt').toISOString()
        }));
        
        setPosts(parsedPosts);
      } catch (error) {
        console.error('Error while fetching posts:', error);
      }
    };
    
    fetchPosts();
    
    // Refresh posts periodically
    const refreshInterval = setInterval(fetchPosts, 300000); // Every 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Get rotation time from localStorage or Back4App settings
  useEffect(() => {
    const getSavedRotationTime = async () => {
      try {
        // Try to get from localStorage first
        const savedTime = localStorage.getItem('rotationTime');
        
        if (savedTime) {
          setRotationTime(parseInt(savedTime));
          return;
        }
        
        // Fallback to fetching from Back4App
        const Settings = Parse.Object.extend('Settings');
        const query = new Parse.Query(Settings);
        query.equalTo('name', 'rotationTime');
        
        const result = await query.first();
        if (result) {
          const time = result.get('value');
          setRotationTime(parseInt(time));
        }
      } catch (error) {
        console.error('Error fetching rotation time:', error);
      }
    };
    
    getSavedRotationTime();
  }, []);

  // Fetch news
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.nos.nl/nosnieuwsalgemeen');
        const data = await response.json();

        if (data && data.items && data.items.length > 0) {
          setNews(data.items.map(item => item.title));
        }
      } catch (error) {
        console.error("Failed to fetch news", error);
        setNews(["Unable to load news feed. Please check your connection."]);
      }
    };

    fetchNews();
    const newsInterval = setInterval(fetchNews, 1800000); // Refresh every 30 minutes

    return () => clearInterval(newsInterval);
  }, []);

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${CITY_NAME},nl&units=metric&appid=${WEATHER_API_KEY}`
        );
        const data = await response.json();

        if (data && data.main && data.weather && data.weather.length > 0) {
          setWeather({
            temp: `${Math.floor(data.main.temp)}°C`,
            condition: data.weather[0].description,
            city: CITY_NAME
          });
        }
      } catch (error) {
        console.error("Failed to fetch weather", error);
        setWeather({
          temp: "N/A",
          condition: "Unavailable",
          city: CITY_NAME
        });
      }
    };

    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 3600000); // Refresh every hour

    return () => clearInterval(weatherInterval);
  }, []);

  // Change post with animation
  useEffect(() => {
    if (isPaused || posts.length <= 1) return;

    let intervalId;
    let countdownId;

    // Update the countdown timer every second
    countdownId = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return rotationTime / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    // Change posts based on rotation time
    intervalId = setInterval(() => {
      setIsPostVisible(false);

      setTimeout(() => {
        setCurrentPostIndex((prevIndex) =>
          prevIndex === posts.length - 1 ? 0 : prevIndex + 1
        );
        setIsPostVisible(true);
        setTimeRemaining(rotationTime / 1000);
      }, 1000); // Wait for fade-out animation to complete

    }, rotationTime);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [isPaused, posts, rotationTime]);

  // Show admin button on 5 rapid taps in corner
  useEffect(() => {
    let tapCount = 0;
    let tapTimeout;

    const handleTap = (e) => {
      // Check if tap is in bottom left corner (within 100px square)
      if (e.clientX < 100 && e.clientY > window.innerHeight - 100) {
        tapCount++;

        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => {
          tapCount = 0;
        }, 3000); // Reset count after 3 seconds of inactivity

        if (tapCount >= 5) {
          setAdminBtnVisible(true);
          setTimeout(() => {
            setAdminBtnVisible(false);
          }, 5000); // Hide button after 5 seconds
        }
      }
    };

    document.addEventListener('click', handleTap);
    return () => document.removeEventListener('click', handleTap);
  }, []);

  // Get current post with fallback for empty posts
  const currentPost = posts.length > 0
    ? posts[currentPostIndex]
    : {
      title: "No Content Available",
      text: "Stay tuned.",
      mediaType: "image",
      mediaUrl: "/api/placeholder/800/600",
      mediaComment: "No content available"
    };

  // Format news items with proper spacing
  const formattedNews = news.map((item, index) => (
    <span key={index} className="ticker-item">{item}</span>
  ));

  return (
    <ErrorBoundary>
      <div className="kiosk-display" onClick={() => setAdminBtnVisible(false)}>
        {/* Header */}
        <div className="kiosk-header">
          <h1>RAPENBURG PLAZA NEWS</h1>
        </div>

        <div className={`post-container ${isPostVisible ? 'visible' : 'hidden'}`}>
          <div className="post-content">
            <h1 className="post-title" tabIndex="0">{currentPost.title}</h1>
            <div className="post-media-container">
              {currentPost.mediaType === 'image' ? (
                <div className="fixed-media-frame">
                  <img
                    src={currentPost.mediaUrl}
                    alt={currentPost.mediaComment}
                    className="post-media"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/api/placeholder/800/600";
                    }}
                  />
                </div>
              ) : currentPost.mediaType === 'video' ? (
                <div className="fixed-media-frame">
                  <video
                    src={currentPost.mediaUrl}
                    className="post-media"
                    autoPlay
                    muted
                    loop
                    onError={(e) => {
                      e.target.onerror = null;
                      // Replace with placeholder image on error
                      const img = document.createElement('img');
                      img.src = "/api/placeholder/800/450";
                      img.alt = "Video failed to load";
                      img.className = "post-media";
                      e.target.parentNode.replaceChild(img, e.target);
                    }}
                  >
                    <source src={currentPost.mediaUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : currentPost.mediaType === 'pdf' ? (
                <div className="fixed-media-frame">
                  <iframe
                    src={`${currentPost.mediaUrl}#toolbar=0&navpanes=0`}
                    title={currentPost.mediaComment}
                    className="post-media pdf-viewer"
                  >
                    PDF viewer not supported
                  </iframe>
                </div>
              ) : (
                <div className="fixed-media-frame">
                  <div className="media-placeholder">
                    <p>Media not available</p>
                  </div>
                </div>
              )}
              <p className="media-comment" tabIndex="0">{currentPost.mediaComment}</p>
            </div>
            <p className="post-text" tabIndex="0">{currentPost.text}</p>
          </div>
        </div>

        <div className="bottom-bar">
          <div className="weather-widget" aria-label={`Weather for ${weather.city}: ${weather.temp}, ${weather.condition}`} tabIndex="0">
            <div>
              <span className="weather-temp">{weather.temp}</span>
            </div>
            <span className="weather-city">{weather.city}</span>
          </div>

          <div className="news-ticker">
            <div className="ticker-content" tabIndex="0">
              {formattedNews}
              {/* Duplicate content to ensure continuous flow */}
              {formattedNews}
            </div>
          </div>
        </div>

        {adminBtnVisible && (
          <button
            className="admin-button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/admin');
            }}
            aria-label="Go to admin panel"
          >
            Admin
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
}

// Admin Login Component
function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = React.useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    const storedUsername = process.env.REACT_APP_USERNAME;
    const storedPassword = process.env.REACT_APP_PASSWORD;

    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Simulate API call with timeout
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simple authentication (replace with real auth in production)
      if (username === storedUsername && password === storedPassword) {
        login(username);
        navigate('/admin/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="login-container">
        <h2>Admin Login</h2>
        {error && <p className="error-message" role="alert">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              aria-required="true"
            />
          </div>
          <div className="form-buttons">
            <button
              type="submit"
              className={`login-button ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            <Link to="/" className="cancel-button">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null);
  const [newPost, setNewPost] = useState({
    title: '',
    text: '',
    mediaType: 'image',
    mediaUrl: '',
    mediaComment: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [rotationSettings, setRotationSettings] = useState({
    time: 30, // seconds
  });
  const { logout } = React.useContext(AuthContext);
  const navigate = useNavigate();

  // Fetch posts from Back4App on component mount
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const Post = Parse.Object.extend('Post');
        const query = new Parse.Query(Post);
        query.descending("createdAt");
        
        const results = await query.find();
        
        const parsedPosts = results.map(post => ({
          id: post.id,
          title: post.get('title'),
          text: post.get('content'),
          mediaType: post.get('mediaType') || 'image',
          mediaUrl: post.get('mediaUrl') || '',
          mediaComment: post.get('imageComment') || '',
          createdAt: post.get('createdAt').toISOString()
        }));
        
        setPosts(parsedPosts);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Get rotation settings
    const getRotationSettings = async () => {
      try {
        const savedTime = localStorage.getItem('rotationTime');
        if (savedTime) {
          setRotationSettings({
            time: Math.floor(parseInt(savedTime) / 1000)
          });
        } else {
          // Try to get from Back4App
          const Settings = Parse.Object.extend('Settings');
          const query = new Parse.Query(Settings);
          query.equalTo('name', 'rotationTime');
          
          const result = await query.first();
          if (result) {
            const time = result.get('value');
            setRotationSettings({
              time: Math.floor(parseInt(time) / 1000)
            });
          }
        }
      } catch (error) {
        console.error('Error fetching rotation settings:', error);
      }
    };
    
    fetchPosts();
    getRotationSettings();
  }, []);

  // Handle editing an existing post
  const handleEditPost = (post) => {
    setEditingPost({ ...post });
    setIsEditing(true);
    setIsAdding(false);
  };

  // Handle deleting a post
  const handleDeletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        // Delete from Back4App
        const Post = Parse.Object.extend('Post');
        const query = new Parse.Query(Post);
        const parseObject = await query.get(postId);
        await parseObject.destroy();
        
        // Update local state
        setPosts(posts.filter(post => post.id !== postId));
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
      }
    }
  };

  // Handle saving edited post
  const handleSaveEdit = async () => {
    if (!editingPost.title || !editingPost.text) {
      alert('Title and text are required fields');
      return;
    }

    try {
      // Update in Back4App
      const Post = Parse.Object.extend('Post');
      const query = new Parse.Query(Post);
      const parseObject = await query.get(editingPost.id);
      
      parseObject.set('title', editingPost.title);
      parseObject.set('content', editingPost.text);
      parseObject.set('mediaType', editingPost.mediaType);
      parseObject.set('mediaUrl', editingPost.mediaUrl);
      parseObject.set('imageComment', editingPost.mediaComment);
      
      await parseObject.save();
      
      // Update local state
      setPosts(posts.map(post =>
        post.id === editingPost.id ? editingPost : post
      ));
      
      setIsEditing(false);
      setEditingPost(null);
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    }
  };

  // Handle adding a new post
  const handleAddPost = async (newPostData) => {
    if (!newPostData.title || !newPostData.text) {
      alert('Title and text are required fields');
      return;
    }

    try {
      // Save to Back4App
      const Post = Parse.Object.extend('Post');
      const parseObject = new Post();
      
      parseObject.set('title', newPostData.title);
      parseObject.set('content', newPostData.text);
      parseObject.set('mediaType', newPostData.mediaType);
      parseObject.set('mediaUrl', newPostData.mediaUrl);
      parseObject.set('imageComment', newPostData.mediaComment);
      
      const savedPost = await parseObject.save();
      
      // Add to local state
      const newPostWithId = {
        id: savedPost.id,
        title: newPostData.title,
        text: newPostData.text,
        mediaType: newPostData.mediaType,
        mediaUrl: newPostData.mediaUrl,
        mediaComment: newPostData.mediaComment,
        createdAt: savedPost.get('createdAt').toISOString()
      };
      
      setPosts([...posts, newPostWithId]);
      setIsAdding(false);
    } catch (error) {
      console.error('Error saving post:', error);
      alert('Failed to save post. Please try again.');
    }
  };

  // Handle saving rotation settings
  const handleSaveSettings = async () => {
    try {
      const timeInMs = rotationSettings.time * 1000;
      
      // Save to localStorage first (for faster access)
      localStorage.setItem('rotationTime', timeInMs.toString());
      
      // Then save to Back4App
      const Settings = Parse.Object.extend('Settings');
      const query = new Parse.Query(Settings);
      query.equalTo('name', 'rotationTime');
      
      let settingsObject = await query.first();
      
      if (!settingsObject) {
        // Create new settings if doesn't exist
        settingsObject = new Settings();
        settingsObject.set('name', 'rotationTime');
      }
      
      settingsObject.set('value', timeInMs.toString());
      await settingsObject.save();
      
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Content Management System</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="view-kiosk-btn">
            View Kiosk
          </button>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <p>Loading content...</p>
        </div>
      ) : !isEditing && !isAdding ? (
        <div className="admin-content">
          <div className="dashboard-section settings-section">
            <h2>Display Settings</h2>
            <div className="form-group">
              <label htmlFor="rotationTime">Content Rotation (seconds)</label>
              <input
                type="number"
                id="rotationTime"
                min="5"
                max="120"
                value={rotationSettings.time}
                onChange={(e) => setRotationSettings({
                  ...rotationSettings,
                  time: parseInt(e.target.value) || 30
                })}
              />
            </div>
            <button className="save-btn" onClick={handleSaveSettings}>
              Save Settings
            </button>
          </div>

          <div className="posts-section full-width">
            <div className="section-header">
              <h2>Content Posts</h2>
              <button
                className="add-btn"
                onClick={() => {
                  setIsAdding(true);
                  setIsEditing(false);
                }}
              >
                Add New Post
              </button>
            </div>

            <div className="posts-list">
              {posts.map(post => (
                <div key={post.id} className="post-item">
                  <div className="post-item-content">
                    <h3>{post.title}</h3>
                    <p><strong>Media Type:</strong> {post.mediaType}</p>
                    <p className="truncate-text"><strong>Text:</strong> {post.text.substring(0, 100)}...</p>
                    <p><strong>Created:</strong> {new Date(post.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="post-actions">
                    <button
                      className="edit-btn"
                      onClick={() => handleEditPost(post)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeletePost(post.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {posts.length === 0 && (
                <div className="empty-state">
                  <p>No posts available. Add your first post!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      
      {isEditing && (
        <EditPost
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          handleSaveEdit={handleSaveEdit}
          setIsEditing={setIsEditing}
        />
      )}

      {isAdding && (
        <NewPostSection 
          addPost={handleAddPost}
          cancelAdd={() => setIsAdding(false)} 
        />
      )}
    </div>
  );
}

export default App;