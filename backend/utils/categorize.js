const path = require('path');

const categorizeFile = (filename, categoriesList) => {
  const ext = path.extname(filename).toLowerCase();
  
  // Exclude 'Others' if it's in the list, as it's the fallback
  for (const category of categoriesList) {
    if (category.name === 'Others') continue;
    if (category.extensions.includes(ext)) {
      return category.name;
    }
  }
  
  return 'Others';
};

module.exports = categorizeFile;
