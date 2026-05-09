const chokidar = require('chokidar');
const path = require('path');
const { organizeSingleFile } = require('./organizer');
const Category = require('../models/Category');

class AutoOrganizer {
  constructor() {
    this.watchers = new Map(); // path -> watcher
  }

  async startWatching(folderPath) {
    if (this.watchers.has(folderPath)) return;

    console.log(`Starting auto-organizer for: ${folderPath}`);
    
    // Fetch categories once to keep them in memory for the watcher
    const categoriesDb = await Category.find();

    const watcher = chokidar.watch(folderPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      depth: 0, // only watch the root level
      ignoreInitial: true // don't organize existing files (that's what manual organize is for)
    });

    watcher.on('add', async (filePath) => {
      const filename = path.basename(filePath);
      console.log(`New file detected: ${filename}`);
      
      // Wait a tiny bit to ensure file is fully written/closed
      setTimeout(async () => {
        try {
          await organizeSingleFile(folderPath, filename, categoriesDb);
          console.log(`Auto-organized: ${filename}`);
        } catch (err) {
          console.error(`Error auto-organizing ${filename}:`, err.message);
        }
      }, 500);
    });

    this.watchers.set(folderPath, watcher);
  }

  stopWatching(folderPath) {
    const watcher = this.watchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(folderPath);
      console.log(`Stopped auto-organizer for: ${folderPath}`);
    }
  }

  getMonitoredPaths() {
    return Array.from(this.watchers.keys());
  }
}

const autoOrganizer = new AutoOrganizer();
module.exports = autoOrganizer;
