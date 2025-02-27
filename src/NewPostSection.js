import { useState } from 'react';
import './App.css';

function NewPostSection({ addPost }) {
  const [newPost, setNewPost] = useState({
    title: '',
    text: '',
    mediaType: 'image',
    mediaUrl: '',
    mediaComment: ''
  });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_PRESET);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_NAME}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setNewPost((prev) => ({ ...prev, mediaUrl: data.secure_url }));
    } catch (error) {
      console.error('Upload failed', error);
    }
    setUploading(false);
  };

  const handleAddPost = () => {
    if (!newPost.title || !newPost.text) {
      alert('Title and text are required fields');
      return;
    }
    addPost(newPost);
    setNewPost({ title: '', text: '', mediaType: 'image', mediaUrl: '', mediaComment: '' });
  };

  return (
    <div className="new-post-section">
      <h2>Add New Post</h2>
      <div className="form-group">
        <label>Title</label>
        <input type="text" placeholder="Title" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Text</label>
        <textarea placeholder="Text" value={newPost.text} onChange={(e) => setNewPost({ ...newPost, text: e.target.value })}></textarea>
      </div>
      <div className="form-group">
        <label>Media Type</label>
        <select value={newPost.mediaType} onChange={(e) => setNewPost({ ...newPost, mediaType: e.target.value })}>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </div>
      <div className="form-group">
        <label>Upload Media</label>
        <input type="file" accept="image/*,video/*" onChange={handleUpload} disabled={uploading} />
        {uploading && <p>Uploading...</p>}
        {newPost.mediaUrl && <p>Uploaded: <a href={newPost.mediaUrl} target="_blank" rel="noopener noreferrer">View</a></p>}
      </div>
      <div className="form-group">
        <label>Media Caption</label>
        <input type="text" placeholder="Media Caption" value={newPost.mediaComment} onChange={(e) => setNewPost({ ...newPost, mediaComment: e.target.value })} />
      </div>
      <div className="form-buttons">
        <button className="add-btn" onClick={handleAddPost} disabled={uploading}>Add Post</button>
      </div>
    </div>
  );
}

export default NewPostSection;
