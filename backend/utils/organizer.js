const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const File = require('../models/File');
const categorizeFile = require('./categorize');

// Helper function to generate file hash
function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * Organizes a single file into its appropriate category folder.
 * @param {string} rootPath - The root folder path.
 * @param {string} filename - The name of the file in the root folder.
 * @param {Array} categoriesDb - List of category objects from DB.
 * @returns {Promise<Object|null>} - The organized file object or null if skipped.
 */
async function organizeSingleFile(rootPath, filename, categoriesDb) {
  const oldPath = path.join(rootPath, filename);
  
  // Skip if it's not a file or it's a directory
  if (!fs.existsSync(oldPath) || !fs.statSync(oldPath).isFile()) return null;

  // Skip hidden files or system files
  if (filename.startsWith('.') || filename === 'Thumbs.db' || filename === 'desktop.ini') return null;

  const stats = fs.statSync(oldPath);
  let category = categorizeFile(filename, categoriesDb);
  
  // Basic duplicate check by looking at existing organized folders
  // In a real app, we'd maintain a global hash map, but for now we simplify.
  
  const targetDir = path.join(rootPath, category);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const newPath = path.join(targetDir, filename);
  
  // If a file with the same name already exists in target, add a timestamp
  let finalPath = newPath;
  let finalFilename = filename;
  if (fs.existsSync(newPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    finalFilename = `${base}_${Date.now()}${ext}`;
    finalPath = path.join(targetDir, finalFilename);
  }

  // Move the file
  fs.renameSync(oldPath, finalPath);

  const newFileData = new File({
    filename: finalFilename,
    originalName: filename,
    category: category,
    filePath: finalPath,
    size: stats.size,
    uploadDate: new Date()
  });

  await newFileData.save();
  return newFileData;
}

module.exports = { organizeSingleFile, getFileHash };
