const { readDB, writeDB, randomUUID } = require('../db/jsonDB');

class File {
  constructor(data) {
    this._id = data._id || randomUUID();
    this.filename = data.filename;
    this.originalName = data.originalName;
    this.category = data.category;
    this.filePath = data.filePath;
    this.size = data.size;
    this.uploadDate = data.uploadDate || new Date();
  }

  async save() {
    const db = readDB();
    db.files.push(this);
    writeDB(db);
    return this;
  }

  static async insertMany(filesArray) {
    const db = readDB();
    db.files.push(...filesArray);
    writeDB(db);
    return filesArray;
  }

  static async deleteMany(query) {
    const db = readDB();
    if (Object.keys(query).length === 0) {
      db.files = [];
    } else {
      db.files = db.files.filter(f => {
        for (const key in query) {
          if (f[key] !== query[key]) return false;
        }
        return true;
      });
    }
    writeDB(db);
  }

  static find(query = {}) {
    const db = readDB();
    let files = [...db.files];
    
    // Simple filtering logic
    if (Object.keys(query).length > 0) {
      files = files.filter(f => {
        for (const key in query) {
          if (f[key] !== query[key]) return false;
        }
        return true;
      });
    }

    return {
      sort: (sortObj) => {
        if (sortObj.uploadDate === -1) {
          files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        }
        return Promise.resolve(files);
      },
      then: (resolve) => resolve(files)
    };
  }

  static async countDocuments(query = {}) {
    const db = readDB();
    if (Object.keys(query).length === 0) return db.files.length;
    return db.files.filter(f => {
      for (const key in query) {
        if (f[key] !== query[key]) return false;
      }
      return true;
    }).length;
  }

  static async findById(id) {
    const db = readDB();
    return db.files.find(f => f._id === id);
  }

  static async findByIdAndDelete(id) {
    const db = readDB();
    db.files = db.files.filter(f => f._id !== id);
    writeDB(db);
  }
}

module.exports = File;
