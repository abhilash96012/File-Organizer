const { readDB, writeDB, randomUUID } = require('../db/jsonDB');

class History {
  static find() {
    const db = readDB();
    return {
      sort: (sortObj) => {
        let result = [...db.history];
        if (sortObj.lastOrganizedAt === -1) {
          result.sort((a, b) => new Date(b.lastOrganizedAt) - new Date(a.lastOrganizedAt));
        }
        return {
          limit: (n) => Promise.resolve(result.slice(0, n))
        };
      },
      then: (resolve) => resolve(db.history)
    };
  }

  static async findByIdAndDelete(id) {
    const db = readDB();
    db.history = db.history.filter(h => h._id !== id);
    writeDB(db);
  }

  static async findOneAndUpdate(query, update, options) {
    const db = readDB();
    const folderPath = query.folderPath;
    let item = db.history.find(h => h.folderPath === folderPath);
    
    if (item) {
      if (update.lastOrganizedAt) item.lastOrganizedAt = update.lastOrganizedAt;
      if (update.isAutoOrganizing !== undefined) item.isAutoOrganizing = update.isAutoOrganizing;
    } else if (options && options.upsert) {
      item = {
        _id: randomUUID(),
        folderPath: folderPath,
        lastOrganizedAt: update.lastOrganizedAt || new Date(),
        isAutoOrganizing: update.isAutoOrganizing || false
      };
      db.history.push(item);
    }
    writeDB(db);
    return item;
  }
}

module.exports = History;
