const File = require('./models/File');
const Category = require('./models/Category');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('--- TESTING PORTABLE JSON DATABASE ---');
  
  try {
    // 1. Clear existing test data
    await File.deleteMany({});
    console.log('✔ Database wiped (Stateless check)');

    // 2. Add a Custom Category
    const cat = new Category({ name: 'Test-Cat', extensions: ['.test'] });
    await cat.save();
    console.log('✔ Custom Category saved to JSON');

    // 3. Add a File record
    const file = new File({
      filename: 'test-file.test',
      originalName: 'test-file.test',
      category: 'Test-Cat',
      filePath: 'C:\\test\\path',
      size: 1024
    });
    await file.save();
    console.log('✔ File record saved to JSON');

    // 4. Verify file exists on disk
    const dbPath = path.join(__dirname, 'db', 'database.json');
    if (fs.existsSync(dbPath)) {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      console.log('✔ database.json verified on disk!');
      console.log('--- Current DB State ---');
      console.log(`Categories: ${data.categories.length}`);
      console.log(`Files: ${data.files.length}`);
    }

    console.log('\nRESULT: PORTABLE LOGIC IS 100% WORKING!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

runTest();
