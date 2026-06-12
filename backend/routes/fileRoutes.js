const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const File = require('../models/File');
const Category = require('../models/Category');
const History = require('../models/History');
const categorizeFile = require('../utils/categorize');
const autoOrganizer = require('../utils/autoOrganizer');
const { getFileHash, organizeSingleFile } = require('../utils/organizer');

// POST /organize-local -> organize files in the user-provided local folder
router.post('/organize-local', async (req, res) => {
  try {
    const { targetPath } = req.body;
    
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(400).json({ message: 'Invalid or missing folder path' });
    }

    const files = fs.readdirSync(targetPath);
    if (files.length === 0) {
      return res.status(400).json({ message: 'Folder is empty' });
    }

    // WIPE MEMORY: We only track the single most recently organized folder
    await File.deleteMany({});

    const organizedFiles = [];

    // Fetch dynamic categories
    let categoriesDb = await Category.find();
    if (categoriesDb.length === 0) {
      const DEFAULT_CATEGORIES = [
        { name: 'Images', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'], isDefault: true },
        { name: 'Documents', extensions: ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.csv', '.ppt', '.pptx'], isDefault: true },
        { name: 'Videos', extensions: ['.mp4', '.avi', '.mov', '.wmv', '.mkv'], isDefault: true },
        { name: 'Duplicates', extensions: [], isDefault: true }
      ];
      await Category.insertMany(DEFAULT_CATEGORIES);
      categoriesDb = await Category.find();
    }
    
    const seenHashes = new Map();
    // Process and organize loose files in the folder
    for (const filename of files) {
      try {
        const result = await organizeSingleFile(targetPath, filename, categoriesDb, seenHashes);
        if (result) {
          organizedFiles.push(result);
        }
      } catch (err) {
        console.error(`Error organizing ${filename}:`, err.message);
      }
    }

    // Log the successful organization in history
    await History.findOneAndUpdate(
      { folderPath: targetPath },
      { lastOrganizedAt: Date.now() },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Folder organized successfully', files: organizedFiles });
  } catch (error) {
    res.status(500).json({ message: 'Error organizing folder', error: error.message });
  }
});

// GET /preview -> securely streams a file from the local file system using the absolute path
router.get('/preview', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ message: 'File not found on local system' });
  }
  // Send the file to the browser
  res.sendFile(path.resolve(filePath));
});

// GET /files -> get all files
router.get('/', async (req, res) => {
  try {
    const files = await File.find().sort({ uploadDate: -1 });
    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
});

// DELETE /files/:id -> delete file
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find file in database
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete physical file using the absolute path stored in filePath
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }

    // Delete metadata from database
    await File.findByIdAndDelete(id);

    res.status(200).json({ message: 'File deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting file', error: error.message });
  }
});

// POST /unorganize-local -> unorganize an entire path locally
router.post('/unorganize-local', async (req, res) => {
  try {
    const { targetPath } = req.body;
    
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(400).json({ message: 'Invalid or missing folder path' });
    }

    // Wipe memory just in case this was the currently tracked folder
    await File.deleteMany({});

    // Fetch dynamic categories to know which folders to un-organize
    let categoriesDb = await Category.find();
    let categoriesList = categoriesDb.map(c => c.name);
    if (!categoriesList.includes('Others')) categoriesList.push('Others');
    if (!categoriesList.includes('Duplicates')) categoriesList.push('Duplicates');

    let filesMoved = 0;

    for (const category of categoriesList) {
      const catPath = path.join(targetPath, category);
      
      if (fs.existsSync(catPath) && fs.statSync(catPath).isDirectory()) {
        const files = fs.readdirSync(catPath);
        
        for (const filename of files) {
          const oldPath = path.join(catPath, filename);
          const newPath = path.join(targetPath, filename);
          
          if (fs.statSync(oldPath).isFile()) {
            fs.renameSync(oldPath, newPath);
            filesMoved++;
          }
        }
        
        // After moving files out, try to delete the category folder
        try {
          const remainingFiles = fs.readdirSync(catPath);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(catPath);
          }
        } catch (err) {
          console.error(`Could not delete category folder ${category}:`, err.message);
        }
      }
    }

    res.status(200).json({ message: `Un-organized successfully. Moved ${filesMoved} files back to root.` });
  } catch (error) {
    res.status(500).json({ message: 'Error un-organizing folder', error: error.message });
  }
});

// DELETE /category/:name -> un-organize entire category (restore files)
router.delete('/category/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Find all files in the database for this category
    const files = await File.find({ category: name });
    
    // Set to collect unique category directories to potentially delete later
    const parentDirs = new Set();

    // Loop through and move physical files back
    for (const file of files) {
      if (fs.existsSync(file.filePath)) {
        // file.filePath is e.g. C:\Path\Images\photo.png
        // currentDir is C:\Path\Images
        const currentDir = path.dirname(file.filePath);
        // originalDir is C:\Path
        const originalDir = path.dirname(currentDir);
        
        // original path of the file
        const restoredPath = path.join(originalDir, file.originalName);
        
        // move it back
        fs.renameSync(file.filePath, restoredPath);
        
        // save the category folder to attempt deleting it later
        parentDirs.add(currentDir);
      }
    }

    // Try to delete the empty category folders
    for (const dir of parentDirs) {
      try {
        if (fs.existsSync(dir)) {
          const remainingFiles = fs.readdirSync(dir);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(dir);
          }
        }
      } catch (err) {
        console.error('Could not delete directory:', err.message);
      }
    }

    // Delete metadata from database so they are no longer "organized"
    await File.deleteMany({ category: name });

    res.status(200).json({ message: `All files in ${name} restored successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error restoring category', error: error.message });
  }
});

// POST /files/bulk-rename -> rename multiple files at once
router.post('/bulk-rename', async (req, res) => {
  try {
    const { fileIds, pattern } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || !pattern) {
      return res.status(400).json({ message: 'Invalid data provided' });
    }

    const renamedFiles = [];

    for (let i = 0; i < fileIds.length; i++) {
      const file = await File.findById(fileIds[i]);
      if (!file || !fs.existsSync(file.filePath)) continue;

      const ext = path.extname(file.filename);
      const newName = pattern.replace('{n}', (i + 1).toString().padStart(2, '0')) + ext;
      const newPath = path.join(path.dirname(file.filePath), newName);

      // Physicall rename
      fs.renameSync(file.filePath, newPath);

      // Update DB
      file.filename = newName;
      file.originalName = newName;
      file.filePath = newPath;
      await file.save();

      renamedFiles.push(file);
    }

    res.status(200).json({ message: `Successfully renamed ${renamedFiles.length} files`, files: renamedFiles });
  } catch (error) {
    res.status(500).json({ message: 'Error bulk renaming files', error: error.message });
  }
});

// POST /files/start-auto -> start monitoring a folder
router.post('/start-auto', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ message: 'Invalid folder path' });
    }

    await autoOrganizer.startWatching(folderPath);

    // Persist in history
    await History.findOneAndUpdate(
      { folderPath },
      { isAutoOrganizing: true },
      { upsert: true }
    );

    res.status(200).json({ message: 'Auto-organizer started', monitoredPaths: autoOrganizer.getMonitoredPaths() });
  } catch (error) {
    res.status(500).json({ message: 'Error starting auto-organizer', error: error.message });
  }
});

// POST /files/stop-auto -> stop monitoring a folder
router.post('/stop-auto', async (req, res) => {
  try {
    const { folderPath } = req.body;
    autoOrganizer.stopWatching(folderPath);

    // Update history
    await History.findOneAndUpdate(
      { folderPath },
      { isAutoOrganizing: false },
      { upsert: true }
    );

    res.status(200).json({ message: 'Auto-organizer stopped', monitoredPaths: autoOrganizer.getMonitoredPaths() });
  } catch (error) {
    res.status(500).json({ message: 'Error stopping auto-organizer', error: error.message });
  }
});

// GET /files/auto-status -> get all monitored paths
router.get('/auto-status', (req, res) => {
  res.status(200).json({ monitoredPaths: autoOrganizer.getMonitoredPaths() });
});

module.exports = router;
