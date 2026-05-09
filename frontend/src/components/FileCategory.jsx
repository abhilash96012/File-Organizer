import FileItem from './FileItem';

const FileCategory = ({ categoryName, files, onDelete, selectedFileIds, onToggleSelect }) => {
  if (files.length === 0) return null;

  return (
    <div className="file-category">
      <h3 className="category-title">{categoryName} <span className="category-count">({files.length})</span></h3>
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
    </div>
  );
};

export default FileCategory;
