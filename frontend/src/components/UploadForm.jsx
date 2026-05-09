import { useState, useEffect } from 'react';
import api from '../api';
import { FolderSymlink, Clock, Search } from 'lucide-react';

const UploadForm = ({ fetchFiles }) => {
  const [folderPath, setFolderPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/history');
      setHistory(response.data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handleBrowse = async () => {
    try {
      // Check if we are running in Electron
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        const selectedPath = await ipcRenderer.invoke('select-folder');
        if (selectedPath) {
          setFolderPath(selectedPath);
        }
      } else {
        alert('Folder browsing is only available in the desktop app.');
      }
    } catch (err) {
      console.error('Error opening folder picker:', err);
    }
  };

  const handleOrganize = async (e) => {
    if (e) e.preventDefault();
    if (!folderPath.trim()) {
      setError('Please enter or select a folder path first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/files/organize-local', {
        targetPath: folderPath.trim()
      });
      
      fetchFiles(); // Refresh the list from the parent
      fetchHistory(); // Refresh history
      setFolderPath('');
      alert('Local folder organized successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Error organizing folder');
    } finally {
      setLoading(false);
    }
  };

  const handleUnorganize = async (e) => {
    if (e) e.preventDefault();
    if (!folderPath.trim()) {
      setError('Please enter or select a folder path first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/files/unorganize-local', {
        targetPath: folderPath.trim()
      });
      
      fetchFiles(); // Refresh the list from the parent (will be empty)
      setFolderPath('');
      alert('Local folder un-organized successfully! All files are back in the root folder.');
    } catch (err) {
      setError(err.response?.data?.message || 'Error un-organizing folder');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAuto = async () => {
    if (!folderPath.trim()) return;
    
    const isCurrentlyMonitoring = history.find(h => h.folderPath === folderPath && h.isAutoOrganizing);
    const endpoint = isCurrentlyMonitoring ? '/files/stop-auto' : '/files/start-auto';
    
    setLoading(true);
    try {
      await api.post(endpoint, { folderPath: folderPath.trim() });
      fetchHistory(); // Refresh history to update toggle state
      alert(isCurrentlyMonitoring ? 'Real-time monitoring stopped.' : 'Real-time monitoring started! Any new files in this folder will be organized automatically.');
    } catch (err) {
      alert(err.response?.data?.message || 'Error toggling auto-organize');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2>Organize a Local Folder</h2>
      <form onSubmit={handleOrganize} className="upload-form">
        {error && <div className="error-message">{error}</div>}
        
        <div className="file-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="file-input-label" style={{ padding: '2rem 1rem', cursor: 'default', borderStyle: 'dashed' }}>
            <FolderSymlink size={32} />
            <span style={{ textAlign: 'center', fontSize: '0.9rem' }}>Select the folder you want to organize.<br/>(Use the browse button below or enter the path manually)</span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="folder-path"
              type="text"
              autoFocus
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="C:\..."
              className="search-input"
              style={{ flex: 1, paddingLeft: '1rem', border: error ? '2px solid var(--danger)' : '1px solid var(--border)' }}
              disabled={loading}
            />
            <button 
              type="button" 
              onClick={handleBrowse}
              disabled={loading}
              className="upload-btn"
              style={{ width: 'auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Search size={18} />
              Browse
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button 
            type="submit" 
            disabled={!folderPath.trim() || loading}
            className="upload-btn"
            style={{ flex: 1 }}
          >
            {loading ? 'Processing...' : 'Organize This Folder'}
          </button>
          
          <button 
            type="button" 
            onClick={handleUnorganize}
            disabled={!folderPath.trim() || loading}
            className="upload-btn"
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            Un-organize This Folder
          </button>
        </div>

        {folderPath.trim() && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {history.find(h => h.folderPath === folderPath && h.isAutoOrganizing) 
                ? '🟢 Real-time monitoring active' 
                : '⚪ Real-time monitoring inactive'}
            </span>
            <button 
              type="button"
              onClick={handleToggleAuto}
              disabled={loading}
              style={{
                padding: '0.4rem 0.8rem',
                background: history.find(h => h.folderPath === folderPath && h.isAutoOrganizing) ? '#ef4444' : 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {history.find(h => h.folderPath === folderPath && h.isAutoOrganizing) ? 'Stop Watching' : 'Enable Auto-Organize'}
            </button>
          </div>
        )}
      </form>

      {history.length > 0 && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            <Clock size={16} />
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Recent Folders</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {history.map((item) => (
              <button
                key={item._id}
                onClick={() => setFolderPath(item.folderPath)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {item.folderPath.split('\\').pop() || item.folderPath}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadForm;
