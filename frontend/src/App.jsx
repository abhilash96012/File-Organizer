import { useState, useEffect, useMemo, useCallback } from 'react';
import api from './api';
import { FolderOpen, Folder, HardDrive, File as FileIcon, Search, Settings, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import UploadForm from './components/UploadForm';
import FileCategory from './components/FileCategory';
import './index.css';

function App() {
  const [files, setFiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  // Settings state
  const [newCatName, setNewCatName] = useState('');
  const [newCatExts, setNewCatExts] = useState('');

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/files');
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchCategories();
  }, [fetchFiles, fetchCategories]);

  // Retry fetching if categories are empty (backend might be starting)
  useEffect(() => {
    if (categories.length === 0) {
      const timer = setTimeout(() => {
        fetchCategories();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [categories, fetchCategories]);

  const handleFileUpload = (newFile) => {
    // Add new file to the beginning of the list
    setFiles((prev) => [newFile, ...prev]);
  };

  const handleRestoreCategory = async (category) => {
    if (!window.confirm(`Are you sure you want to un-organize all ${category} files?`)) return;
    
    setLoading(true);
    try {
      await api.delete(`/files/category/${category}`);
      
      // Remove all files of this category from state
      setFiles((prev) => prev.filter((file) => file.category !== category));
      
      // Go back to home view
      setCurrentView('home');
    } catch (error) {
      console.error('Error restoring category:', error);
      alert('Failed to restore category files');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName || !newCatExts) return;
    try {
      const response = await api.post('/categories', {
        name: newCatName,
        extensions: newCatExts
      });
      setCategories([...categories, response.data]);
      setNewCatName('');
      setNewCatExts('');
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this custom category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories(categories.filter(c => c._id !== id));
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting category');
    }
  };

  const handleFileDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this file permanently?')) return;
    try {
      await api.delete(`/files/${id}`);
      setFiles((prev) => prev.filter((file) => file._id !== id));
      setSelectedFileIds((prev) => prev.filter((fid) => fid !== id));
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedFileIds((prev) => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleBulkRename = async () => {
    const pattern = window.prompt('Enter renaming pattern (use {n} for number, e.g., vacation_{n}):');
    if (!pattern) return;

    try {
      setLoading(true);
      const response = await api.post('/files/bulk-rename', {
        fileIds: selectedFileIds,
        pattern
      });
      
      // Update local state with renamed files
      const updatedFiles = response.data.files;
      setFiles(prev => prev.map(f => {
        const updated = updatedFiles.find(uf => uf._id === f._id);
        return updated || f;
      }));
      
      setSelectedFileIds([]);
      alert(response.data.message);
    } catch (error) {
      alert(error.response?.data?.message || 'Error bulk renaming');
    } finally {
      setLoading(false);
    }
  };

  // Filter and Sort logic optimized with useMemo
  const processedFiles = useMemo(() => {
    return files
      .filter(file => file.originalName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.uploadDate) - new Date(a.uploadDate);
        if (sortOrder === 'oldest') return new Date(a.uploadDate) - new Date(b.uploadDate);
        if (sortOrder === 'largest') return (b.size || 0) - (a.size || 0);
        if (sortOrder === 'smallest') return (a.size || 0) - (b.size || 0);
        return 0;
      });
  }, [files, searchQuery, sortOrder]);

  // Group files by category optimized with useMemo
  const groupedFiles = useMemo(() => {
    const groups = {};
    categories.forEach(cat => {
      groups[cat.name] = processedFiles.filter(f => f.category === cat.name);
    });
    if (!groups['Others']) {
      groups['Others'] = processedFiles.filter(f => f.category === 'Others');
    }
    return groups;
  }, [categories, processedFiles]);

  // Compute data for charts optimized with useMemo
  const pieData = useMemo(() => {
    const data = Object.keys(groupedFiles).map(catName => ({
      name: catName,
      value: groupedFiles[catName].length
    })).filter(item => item.value > 0);
    if (data.length === 0) {
      return [{ name: 'No Files Organized', value: 1 }];
    }
    return data;
  }, [groupedFiles]);

  const COLORS = useMemo(() => {
    if (files.length === 0) {
      return ['#475569']; // Slate-600 gray placeholder color
    }
    return ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#6366f1'];
  }, [files]);

  const totalFiles = useMemo(() => processedFiles.length, [processedFiles]);
  const totalSize = useMemo(() => processedFiles.reduce((acc, file) => acc + (file.size || 0), 0), [processedFiles]);
  
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="logo" style={{ margin: 0, cursor: 'pointer' }} onClick={() => setCurrentView('home')}>
            <FolderOpen size={36} />
            <h1>File Organizer</h1>
          </div>
          <button 
            onClick={() => setCurrentView(currentView === 'settings' ? 'home' : 'settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: currentView === 'settings' ? 'var(--primary)' : 'var(--surface)',
              color: 'white',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            <Settings size={18} />
            {currentView === 'settings' ? 'Close Settings' : 'Settings'}
          </button>
        </div>
        <p className="subtitle" style={{ textAlign: 'left' }}>Locally organize any folder on your computer.</p>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading-state">Loading your files...</div>
        ) : currentView === 'settings' ? (
          <div className="settings-view" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', animation: 'slideIn 0.3s ease-out' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Custom Categories</h2>
            
            <div className="settings-list" style={{ marginBottom: '2rem' }}>
              {categories.map(cat => (
                <div key={cat._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{cat.name} {cat.isDefault && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>(Default)</span>}</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{cat.extensions.join(', ')}</p>
                  </div>
                  {!cat.isDefault && (
                    <button onClick={() => handleDeleteCategory(cat._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Add New Category</h3>
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Category Name (e.g., Code)" 
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-primary)' }}
                required
              />
              <input 
                type="text" 
                placeholder="Extensions (e.g., .js, .py, .html)" 
                value={newCatExts}
                onChange={e => setNewCatExts(e.target.value)}
                style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-primary)' }}
                required
              />
              <button type="submit" style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Create
              </button>
            </form>
          </div>
        ) : currentView === 'home' ? (
          <>
            <UploadForm onFileUpload={handleFileUpload} fetchFiles={fetchFiles} />
            
            {selectedFileIds.length > 0 && (
              <div className="bulk-actions-toolbar" style={{ 
                background: 'var(--primary)', 
                padding: '1rem', 
                borderRadius: '12px', 
                marginBottom: '1.5rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                animation: 'slideIn 0.3s ease-out'
              }}>
                <span style={{ fontWeight: '600', color: 'white' }}>{selectedFileIds.length} files selected</span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={handleBulkRename}
                    style={{ padding: '0.5rem 1rem', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Bulk Rename
                  </button>
                  <button 
                    onClick={() => setSelectedFileIds([])}
                    style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="controls-container">
                <div className="search-wrapper">
                  <Search size={20} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search files by name..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select 
                  className="sort-select" 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="largest">Largest Size</option>
                  <option value="smallest">Smallest Size</option>
                </select>
              </div>
            )}

            {searchQuery && processedFiles.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0', minHeight: 'auto', marginBottom: '2rem' }}>
                <p>No matching files found.</p>
                <span>Try a different search term.</span>
              </div>
            ) : (
              <>
                {groupedFiles['Duplicates']?.length > 0 && (
                  <div className="duplicates-alert-banner" style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '1.25rem',
                    borderRadius: '16px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    animation: 'slideIn 0.3s ease-out'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '250px' }}>
                      <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                      <div>
                        <h4 style={{ margin: 0, color: '#fbbf24', fontWeight: '600' }}>Duplicate Files Detected</h4>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Found {groupedFiles['Duplicates'].length} duplicate files. You can review them or clean them up to free space.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        onClick={() => setCurrentView('Duplicates')}
                        style={{ 
                          padding: '0.6rem 1.2rem', 
                          background: 'rgba(245, 158, 11, 0.15)', 
                          color: '#fbbf24', 
                          border: '1px solid rgba(245, 158, 11, 0.3)', 
                          borderRadius: '8px', 
                          fontWeight: '600', 
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        View Duplicates
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to permanently delete all ${groupedFiles['Duplicates'].length} duplicate files?`)) {
                            setLoading(true);
                            try {
                              for (const file of groupedFiles['Duplicates']) {
                                  await api.delete(`/files/${file._id}`);
                              }
                              await fetchFiles();
                              alert('All duplicates deleted successfully!');
                            } catch (error) {
                              console.error(error);
                              alert('Failed to delete some duplicate files');
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        style={{ 
                          padding: '0.6rem 1.2rem', 
                          background: 'var(--danger)', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '8px', 
                          fontWeight: '600', 
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Clean All Duplicates
                      </button>
                    </div>
                  </div>
                )}

                <div className="dashboard-container">
                  <div className="dashboard-card" style={{ minWidth: 0 }}>
                    <h3>Category Distribution</h3>
                    <div style={{ width: '100%', height: 200, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            isAnimationActive={true}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Organization Summary</h3>
                    <div className="stats-container">
                      <div className="stat-item">
                        <div className="stat-icon"><FileIcon size={24} /></div>
                        <div className="stat-details">
                          <p>Total Files Organized</p>
                          <h4>{totalFiles}</h4>
                        </div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-icon"><HardDrive size={24} /></div>
                        <div className="stat-details">
                          <p>Total Storage Managed</p>
                          <h4>{formatSize(totalSize)}</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="folder-grid">
              {Object.keys(groupedFiles).map(catName => (
                <div key={catName} className="folder-card" onClick={() => setCurrentView(catName)}>
                  <Folder size={48} className="folder-card-icon" />
                  <h3>{catName}</h3>
                  <p>{groupedFiles[catName].length} files</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="category-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button className="back-btn" style={{ marginBottom: 0 }} onClick={() => setCurrentView('home')}>
                ← Back to Folders
              </button>
              {groupedFiles[currentView]?.length > 0 && (
                <button 
                  onClick={() => handleRestoreCategory(currentView)}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Un-organize {currentView}
                </button>
              )}
            </div>
            <FileCategory 
              categoryName={currentView} 
              files={groupedFiles[currentView] || []} 
              onDelete={handleFileDelete} 
              selectedFileIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
