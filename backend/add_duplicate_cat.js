const Category = require('./models/Category');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function seed() {
  try {
    const existing = await Category.findOne({ name: 'Duplicates' });
    if (!existing) {
      const cat = new Category({ name: 'Duplicates', extensions: [], isDefault: true });
      await cat.save();
      console.log('Successfully added Duplicates category to JSON DB!');
    } else {
      console.log('Duplicates category already exists.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
