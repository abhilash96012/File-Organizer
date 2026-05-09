require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Import routes
const fileRoutes = require('./routes/fileRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const historyRoutes = require('./routes/historyRoutes');

const app = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/files', fileRoutes);
app.use('/categories', categoryRoutes);
app.use('/history', historyRoutes);

// Initialize Auto-Organizer
const autoOrganizer = require('./utils/autoOrganizer');
const History = require('./models/History');

const initAutoOrganizer = async () => {
  try {
    const history = await History.find();
    // find() returns an object with sort and then, so we need to await the promise
    const historyData = await history;
    const pathsToWatch = historyData.filter(h => h.isAutoOrganizing);
    
    for (const item of pathsToWatch) {
      autoOrganizer.startWatching(item.folderPath);
    }
  } catch (err) {
    console.error('Failed to initialize auto-organizer:', err.message);
  }
};

initAutoOrganizer();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error!', error: err.message });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
