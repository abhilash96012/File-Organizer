const { readDB, writeDB, randomUUID } = require('../db/jsonDB');

class Category {
  constructor(data) {
    this._id = data._id || randomUUID();
    this.name = data.name;
    this.extensions = data.extensions || [];
    this.isDefault = data.isDefault || false;
  }

  async save() {
    const db = readDB();
    if (db.categories.find(c => c.name === this.name && c._id !== this._id)) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    db.categories.push(this);
    writeDB(db);
    return this;
  }

  static async find() {
    return readDB().categories;
  }

  static async findOne(query) {
    const db = readDB();
    return db.categories.find(c => {
      for (const key in query) {
        if (c[key] !== query[key]) return false;
      }
      return true;
    });
  }

  static async findById(id) {
    return readDB().categories.find(c => c._id === id);
  }

  static async insertMany(arr) {
    const db = readDB();
    const newCats = arr.map(data => new Category(data));
    db.categories.push(...newCats);
    writeDB(db);
    return newCats;
  }

  static async findByIdAndDelete(id) {
    const db = readDB();
    db.categories = db.categories.filter(c => c._id !== id);
    writeDB(db);
  }
}

module.exports = Category;
