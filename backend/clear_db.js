const mongoose = require('mongoose');
const File = require('./models/File');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await File.deleteMany({});
    console.log('Successfully wiped database!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
