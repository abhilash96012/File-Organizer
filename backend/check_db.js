const File = require('./models/File');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function check() {
  try {
    const count = await File.countDocuments();
    const files = await File.find().then(res => res);
    console.log(`--- PORTABLE DB CHECK ---`);
    console.log(`DB Count: ${count}`);
    console.log('Files:', JSON.stringify(files, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

check();
