import FileItem from './FileItem';

const FileCategory = ({ categoryName, files, onDelete, selectedFileIds, onToggleSelect }) => {
  return (
    <div className="file-category">
      <h3 className="category-title" style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        {categoryName} <span className="category-count" style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>({files.length})</span>
      </h3>
      {files.length === 0 ? (
        <div className="empty-state" style={{ 
          padding: '4rem 2rem', 
          textAlign: 'center', 
          background: 'var(--surface)', 
          borderRadius: '16px', 
          border: '1px dashed var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '2.5rem' }}>📂</span>
          <p style={{ color: 'var(--text-primary)', fontWeight: '600', margin: 0 }}>This folder is currently empty</p>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Organize folders containing files of this category to see them here.</span>
        </div>
      ) : (
        <div className="file-grid">
          {files.map(file => (
            <FileItem 
              key={file._id} 
              file={file} 
              onDelete={onDelete} 
              isSelected={selectedFileIds?.includes(file._id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileCategory;
