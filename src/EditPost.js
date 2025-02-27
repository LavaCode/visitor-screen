import { useState, useEffect } from 'react';
import './App.css';

function EditPost({
  editingPost,
  setEditingPost,
  handleSaveEdit,
  setIsEditing,
}) {
  const [uploading, setUploading] = useState(false);

  // If the editing post prop changes, update the local state
  useEffect(() => {
    setEditingPost({ ...editingPost });
  }, [editingPost, setEditingPost]);

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
      setEditingPost((prev) => ({ ...prev, mediaUrl: data.secure_url }));
    } catch (error) {
      console.error('Upload failed', error);
    }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!editingPost.title || !editingPost.text) {
      alert('Title and text are required fields');
      return;
    }
    // Call the parent handleSaveEdit function to save the data to the database
    handleSaveEdit(editingPost);
  };

  return (
    <div className="post-editor">
      <h2>Edit Post</h2>
      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={editingPost.title}
          onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label>Text</label>
        <textarea
          value={editingPost.text}
          onChange={(e) => setEditingPost({ ...editingPost, text: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label>Media Type</label>
        <select
          value={editingPost.mediaType}
          onChange={(e) => setEditingPost({ ...editingPost, mediaType: e.target.value })}
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="pdf">PDF Document</option>
        </select>
      </div>
      <div className="form-group">
        <label>Upload Media</label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading && <p>Uploading...</p>}
        {editingPost.mediaUrl && (
          <p>
            Uploaded: <a href={editingPost.mediaUrl} target="_blank" rel="noopener noreferrer">View</a>
          </p>
        )}
      </div>
      <div className="form-group">
        <label>Media Caption</label>
        <input
          type="text"
          value={editingPost.mediaComment}
          onChange={(e) => setEditingPost({ ...editingPost, mediaComment: e.target.value })}
        />
      </div>
      <div className="form-buttons">
        <button className="save-btn" onClick={handleSubmit} disabled={uploading}>
          Save Changes
        </button>
        <button
          className="cancel-btn"
          onClick={() => {
            setIsEditing(false);
            setEditingPost(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default EditPost;
