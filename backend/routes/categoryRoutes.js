const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// Default categories
const DEFAULT_CATEGORIES = [
  { name: 'Images', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'], isDefault: true },
  { name: 'Documents', extensions: ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.csv', '.ppt', '.pptx'], isDefault: true },
  { name: 'Videos', extensions: ['.mp4', '.avi', '.mov', '.wmv', '.mkv'], isDefault: true },
  { name: 'Duplicates', extensions: [], isDefault: true }
];

// GET /categories - Fetch all categories
router.get('/', async (req, res) => {
  try {
    let categories = await Category.find();
    
    // Seed default categories if DB is empty
    if (categories.length === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES);
      categories = await Category.find();
    }
    
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// POST /categories - Add custom category
router.post('/', async (req, res) => {
  try {
    const { name, extensions } = req.body;
    
    // Convert extensions string/array to normalized array
    let extArray = Array.isArray(extensions) ? extensions : extensions.split(',').map(e => e.trim());
    extArray = extArray.map(e => e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`);
    
    const newCategory = new Category({ name, extensions: extArray });
    await newCategory.save();
    
    res.status(201).json(newCategory);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// DELETE /categories/:id - Delete custom category
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    
    if (category.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default categories' });
    }
    
    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
});

module.exports = router;
