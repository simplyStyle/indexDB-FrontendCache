"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstance = exports.initDB = void 0;
class TsIndexDb {
    constructor({ dbName, version, tables }) {
        this.dbName = ''; // 数据库名称
        this.version = 1; // 数据库版本
        this.tableList = []; // 表单列表
        this.db = null;
        this.queue = [];
        this.dbName = dbName;
        this.version = version;
        this.tableList = tables;
    }
    static getInstance(dbOptions) {
        if (TsIndexDb._instance === null && dbOptions) {
            TsIndexDb._instance = new TsIndexDb(dbOptions);
        }
        return TsIndexDb._instance;
    }
    queryAll({ tableName }) {
        const res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readonly', (e, resolve) => {
            this.cursorSuccess(e, {
                condition: () => true,
                handler: ({ currentValue }) => res.push(currentValue),
                success: () => resolve(res),
            });
        });
    }
    query({ tableName, condition }) {
        const res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readonly', (e, resolve) => {
            this.cursorSuccess(e, {
                condition,
                handler: ({ currentValue }) => res.push(currentValue),
                success: () => resolve(res),
            });
        });
    }
    queryByKeyValue({ tableName, key, value }) {
        return this.commitDb(tableName, (transaction) => transaction.index(key).get(value), 'readonly', (e, resolve) => {
            resolve(e.target.result || null);
        });
    }
    queryByPrimaryKey({ tableName, value }) {
        return this.commitDb(tableName, (transaction) => transaction.get(value), 'readonly', (e, resolve) => {
            resolve(e.target.result || null);
        });
    }
    update({ tableName, condition, handle }) {
        const res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readwrite', (e, resolve) => {
            this.cursorSuccess(e, {
                condition,
                handler: ({ currentValue, cursor }) => {
                    const value = handle(currentValue);
                    res.push(value);
                    cursor.update(value);
                },
                success: () => {
                    resolve(res);
                },
            });
        });
    }
    updateByPrimaryKey({ tableName, value, handle }) {
        return this.commitDb(tableName, (transaction) => transaction.get(value), 'readwrite', (e, resolve, store) => {
            const currentValue = e.target.result;
            if (!currentValue) {
                resolve(null);
                return;
            }
            const value = handle(currentValue);
            store.put(value);
            resolve(value);
        });
    }
    insert({ tableName, data }) {
        return this.commitDb(tableName, undefined, 'readwrite', (_, resolve, store) => {
            data instanceof Array
                ? data.forEach(v => {
                    store.put(v);
                })
                : store.put(data);
            resolve();
        });
    }
    delete({ tableName, condition }) {
        const res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readwrite', (e, resolve) => {
            this.cursorSuccess(e, {
                condition,
                handler: ({ currentValue, cursor }) => {
                    res.push(currentValue);
                    cursor.delete();
                },
                success: () => {
                    resolve(res);
                },
            });
        });
    }
    deleteByPrimaryKey({ tableName, value }) {
        return this.commitDb(tableName, (transaction) => transaction.delete(value), 'readwrite', (e, resolve) => {
            resolve();
        });
    }
    openDB() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.version);
            request.onerror = e => {
                reject(e);
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                let task;
                while ((task = this.queue.pop())) {
                    task();
                }
                resolve(this);
            };
            // 数据库升级
            request.onupgradeneeded = e => {
                this.tableList.forEach((element) => {
                    this.createTable(e.target.result, element);
                });
            };
        });
    }
    closeDB() {
        return new Promise((resolve, reject) => {
            var _a;
            try {
                if (!this.db) {
                    resolve('请开启数据库');
                    return;
                }
                (_a = this.db) === null || _a === void 0 ? void 0 : _a.close();
                this.db = null;
                TsIndexDb._instance = null;
                resolve(null);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    deleteDB(name) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = e => {
                reject(e);
            };
            request.onsuccess = e => {
                resolve(e);
            };
        });
    }
    deleteTable(tableName) {
        return this.commitDb(tableName, (transaction) => transaction.clear(), 'readwrite', (_, resolve) => {
            resolve();
        });
    }
    createTable(idb, { tableName, option, indexes = [] }) {
        if (!idb.objectStoreNames.contains(tableName)) {
            const store = idb.createObjectStore(tableName, option);
            for (const { key, option } of indexes) {
                store.createIndex(key, key, option);
            }
        }
    }
    commitDb(tableName, commit, mode = 'readwrite', backF) {
        return new Promise((resolve, reject) => {
            const task = () => {
                var _a;
                try {
                    const store = (_a = this.db) === null || _a === void 0 ? void 0 : _a.transaction(tableName, mode).objectStore(tableName);
                    if (!commit) {
                        backF === null || backF === void 0 ? void 0 : backF(null, resolve, store);
                        return;
                    }
                    const res = commit(store);
                    res.onsuccess = (e) => {
                        if (backF) {
                            backF(e, resolve, store);
                        }
                        else {
                            resolve(e);
                        }
                    };
                    res.onerror = event => {
                        reject(event);
                    };
                }
                catch (error) {
                    reject(error);
                }
            };
            if (!this.db) {
                this.queue.push(task);
            }
            else {
                task();
            }
        });
    }
    cursorSuccess(e, { condition, handler, success }) {
        const cursor = e.target.result;
        if (cursor) {
            const currentValue = cursor.value;
            if (condition(currentValue))
                handler({ cursor, currentValue });
            cursor.continue();
        }
        else {
            success();
        }
    }
}
exports.default = TsIndexDb;
TsIndexDb._instance = null;
const initDB = ({ dbName, version = 1, tables = [] }) => {
    const db = TsIndexDb.getInstance({
        dbName,
        version,
        tables,
    });
    return db.openDB();
};
exports.initDB = initDB;
const getInstance = () => TsIndexDb.getInstance();
exports.getInstance = getInstance;
