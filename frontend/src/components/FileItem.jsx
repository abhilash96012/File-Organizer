import { FileText, Image, Video, File, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../api';

const FileItem = ({ file, onDelete, isSelected, onToggleSelect }) => {
  const getFileType = () => {
    const name = file.originalName || '';
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'Images';
    if (['.mp4', '.avi', '.mov', '.wmv', '.mkv'].includes(ext)) return 'Videos';
    if (['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.csv', '.ppt', '.pptx'].includes(ext)) return 'Documents';
    return 'Others';
  };

  const fileType = getFileType();

  // Helper to determine which icon to show
  const getIcon = () => {
    switch (fileType) {
      case 'Images': return <Image size={24} className="icon-image" />;
      case 'Documents': return <FileText size={24} className="icon-doc" />;
      case 'Videos': return <Video size={24} className="icon-video" />;
      default: return <File size={24} className="icon-other" />;
    }
  };

  // Helper to format file size
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`file-item ${isSelected ? 'selected' : ''}`} onClick={() => onToggleSelect(file._id)}>
      <div style={{ marginRight: '0.5rem' }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => {}} // Controlled by parent onClick
          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
        />
      </div>
      <div className="file-icon-wrapper">
        {fileType === 'Images' ? (
          <img 
            src={`${API_BASE_URL}/files/preview?path=${encodeURIComponent(file.filePath)}`} 
            alt={file.originalName} 
            className="file-preview-img"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
          />
        ) : (
          getIcon()
        )}
      </div>
      <div className="file-details">
        <h4 className="file-name" title={file.originalName}>{file.originalName}</h4>
        <div className="file-meta">
          <span>{formatSize(file.size)}</span>
          <span>•</span>
          <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
        </div>
        {file.category === 'Duplicates' && (
          <div 
            className="duplicate-badge" 
            style={{ 
              fontSize: '0.8rem', 
              color: '#fbbf24', 
              marginTop: '0.3rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: '500'
            }} 
            title={file.duplicateOf ? `Original file path: ${file.duplicateOf}` : "Duplicate content detected"}
          >
            <span>⚠️</span> Duplicate{file.duplicateOf ? ` of: ${file.duplicateOf.split(/[\\\\/]/).pop()}` : ""}
          </div>
        )}
      </div>
      <button 
        className="delete-btn" 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file._id);
        }}
        title="Delete file"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

export default FileItem;
