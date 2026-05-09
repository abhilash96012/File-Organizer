const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'test_folder');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
fs.writeFileSync(path.join(testDir, 'test1.jpg'), 'fake image data');
fs.writeFileSync(path.join(testDir, 'test2.txt'), 'fake doc data');

console.log('Created test folder with files.');

async function testApi() {
  try {
    const res = await fetch('http://localhost:5000/files/organize-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: testDir })
    });
    const data = await res.json();
    console.log('Organize API Response:', res.status, data);

    const getRes = await fetch('http://localhost:5000/files');
    const getData = await getRes.json();
    console.log('GET /files API Response size:', getData.length);
  } catch (err) {
    console.error('API Error:', err);
  }
}

testApi();
