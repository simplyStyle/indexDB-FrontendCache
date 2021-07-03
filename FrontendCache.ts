type IIndexDb = {
    dbName: string;
    version: number;
    tables: DbTable[];
};
type DbIndex = { key: string, option?: IDBIndexParameters; };
type DbTable = {
    tableName: string,
    option?: IDBObjectStoreParameters;
    indexes?: DbIndex[];
};
interface DbOperate<T> {
    tableName: string,
    key: string,
    data: T | T[],
    value: string | number,
    condition(data: T): boolean;
    success(res: T[] | T): void;
    handle(res: T): void;

}

class TsIndexDb {

    private dbName = "";// 数据库名称
    private version = 1;// 数据库版本
    private tableList: DbTable[] = [];// 表单列表
    private db: IDBDatabase | null = null;
    private queue: (() => void)[] = [];
    constructor({ dbName, version, tables }: IIndexDb) {
        this.dbName = dbName;
        this.version = version;
        this.tableList = tables;
    }

    private static _instance: TsIndexDb | null = null;

    public static getInstance(dbOptions?: IIndexDb): TsIndexDb {
        if (TsIndexDb._instance === null && dbOptions) {
            TsIndexDb._instance = new TsIndexDb(dbOptions);
        }
        return TsIndexDb._instance as any;
    }

    queryAll<T>({ tableName }: Pick<DbOperate<T>, "tableName">) {
        const res: T[] = [];
        return this.commitDb<T[]>(
            tableName,
            (transaction: IDBObjectStore) => transaction.openCursor(),
            "readonly",
            (e: any, resolve: (data: T[]) => void) => {
                this.cursorSuccess(e, {
                    condition: () => true,
                    handler: ({ currentValue }: any) => res.push(currentValue),
                    success: () => resolve(res)
                });
            });
    }

    query<T>({ tableName, condition }: Pick<DbOperate<T>, "condition" | "tableName">) {
        const res: T[] = [];
        return this.commitDb<T[]>(
            tableName,
            (transaction: IDBObjectStore) => transaction.openCursor(),
            "readonly",
            (e: any, resolve: (data: T[]) => void) => {
                this.cursorSuccess(e, {
                    condition,
                    handler: ({ currentValue }: any) => res.push(currentValue),
                    success: () => resolve(res)
                });
            });
    }

    queryByKeyValue<T>({ tableName, key, value }: Pick<DbOperate<T>, "tableName" | "key" | "value">) {
        return this.commitDb<T>(
            tableName,
            (transaction: IDBObjectStore) => transaction.index(key).get(value),
            "readonly",
            (e: any, resolve: (data: T) => void) => {
                resolve(e.target.result || null);
            });
    }

    queryByPrimaryKey<T>({ tableName, value }: Pick<DbOperate<T>, "tableName" | "value">) {
        return this.commitDb<T>(
            tableName,
            (transaction: IDBObjectStore) => transaction.get(value),
            "readonly",
            (e: any, resolve: (data: T) => void) => {
                resolve(e.target.result || null);
            });
    }

    update<T>({ tableName, condition, handle }: Pick<DbOperate<T>, "tableName" | "condition" | "handle">) {
        const res: T[] = [];
        return this.commitDb<T>(
            tableName,
            (transaction: IDBObjectStore) => transaction.openCursor(),
            "readwrite",
            (e: any, resolve: (data: T[]) => void) => {
                this.cursorSuccess(e, {
                    condition,
                    handler: ({ currentValue, cursor }: any) => {
                        const value = handle(currentValue);
                        res.push(value as any);
                        cursor.update(value);
                    },
                    success: () => {
                        resolve(res);
                    }
                });
            });
    }

    updateByPrimaryKey<T>({ tableName, value, handle }: Pick<DbOperate<T>, "tableName" | "value" | "handle">) {
        return this.commitDb<T>(
            tableName,
            (transaction: IDBObjectStore) => transaction.get(value),
            "readwrite",
            (e: any, resolve: (data: T | null) => void, store: IDBObjectStore) => {
                const currentValue = e.target.result;
                if (!currentValue) {
                    resolve(null);
                    return;
                }
                const value = handle(currentValue);
                store.put(value);
                resolve(value as any);
            });
    }

    insert<T>({ tableName, data }: Pick<DbOperate<T>, "tableName" | "data">) {
        return this.commitDb<T>(
            tableName,
            undefined,
            "readwrite",
            (_: any, resolve: () => void, store: IDBObjectStore) => {
                data instanceof Array
                    ? data.forEach(v => {
                        store.put(v);
                    })
                    : store.put(data);
                resolve();
            });

    }

    delete<T>({ tableName, condition }: Pick<DbOperate<T>, "tableName" | "condition">) {
        const res: T[] = [];
        return this.commitDb<T>(
            tableName,
            (transaction: IDBObjectStore) => transaction.openCursor(),
            "readwrite",
            (e: any, resolve: (data: T[]) => void) => {
                this.cursorSuccess(e, {
                    condition,
                    handler: ({ currentValue, cursor }: any) => {
                        res.push(currentValue);
                        cursor.delete();
                    },
                    success: () => {
                        resolve(res);
                    }
                });
            });
    }

    deleteByPrimaryKey<T>({ tableName, value }: Pick<DbOperate<T>, "tableName" | "value">) {
        return this.commitDb<T>(
            tableName,
            (transaction: IDBObjectStore) => transaction.delete(value),
            "readwrite",
            (e: any, resolve: () => void) => {
                resolve();
            });
    }

    /**
     * 
     * @param s  
     */
    openDB() {
        return new Promise<TsIndexDb>((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.version);
            request.onerror = e => {
                reject(e);
            };
            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                let task: () => void;

                while (task = this.queue.pop() as any) {
                    task();
                }

                resolve(this);
            };
            // 数据库升级
            request.onupgradeneeded = e => {
                this.tableList.forEach((element: DbTable) => {
                    this.createTable((e.target as any).result, element);
                });
            };
        });
    }

    closeDB() {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    resolve("请开启数据库");
                    return;
                }
                this.db?.close();
                this.db = null;
                TsIndexDb._instance = null;
                resolve(null);
            } catch (error) {
                reject(error);
            }
        });

    }

    deleteDB(name: string) {
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


    deleteTable(tableName: string) {
        return this.commitDb(
            tableName,
            (transaction: IDBObjectStore) => transaction.clear(),
            "readwrite",
            (_: any, resolve: () => void) => {
                resolve();
            });
    }

    private createTable(idb: any, { tableName, option, indexes = [] }: DbTable) {
        if (!idb.objectStoreNames.contains(tableName)) {
            const store = idb.createObjectStore(tableName, option);
            for (const { key, option } of indexes) {
                store.createIndex(key, key, option);
            }
        }
    }

    private commitDb<T>(
        tableName: string,
        commit?: (transaction: IDBObjectStore) => IDBRequest<any>,
        mode: IDBTransactionMode = "readwrite",
        backF?: (request: any, resolve: any, store: IDBObjectStore) => void
    ) {
        return new Promise<T>((resolve, reject) => {
            const task = () => {
                try {
                    const store = this.db?.transaction(tableName, mode).objectStore(tableName) as any;
                    if (!commit) {
                        backF?.(null, resolve, store);
                        return;
                    }
                    const res = commit(store);
                    res.onsuccess = (e: any) => {
                        if (backF) {
                            backF(e, resolve, store);
                        } else {
                            resolve(e);
                        }
                    };
                    res.onerror = (event) => {
                        reject(event);
                    };
                } catch (error) {
                    reject(error);
                }
            };

            if (!this.db) {
                this.queue.push(task);
            } else {
                task();
            }
        });
    }

    cursorSuccess(e: any, { condition, handler, success }: any) {
        const cursor: IDBCursorWithValue = e.target.result;
        if (cursor) {
            const currentValue = cursor.value;
            if (condition(currentValue)) handler({ cursor, currentValue });
            cursor.continue();
        } else {
            success();
        }
    }
}

export const initDB = ({ dbName, version = 1, tables = [] }: IIndexDb): Promise<TsIndexDb> => {
    const db = TsIndexDb.getInstance({
        dbName,
        version,
        tables
    });
    return db.openDB();
};

export const getInstance = () => TsIndexDb.getInstance();

type CacheDoc<T> = {
    _id: string;
    data: T;
    expiredAt?: number;
};


const isVoid = (data: any) => {
    if (data === undefined || data === null || Object.is(NaN, data)) {
        return true;
    }
    return false;
}

export default class FrontendCache {

    private dbName = "system";
    private tableName = "Cache";
    private time = Math.floor(new Date().valueOf() / 1000);

    constructor() {
        initDB({
            dbName: this.dbName,
            version: 3,
            tables: [
                {
                    tableName: this.tableName,
                    option: {
                        keyPath: "_id"
                    },
                    indexes: [
                        {
                            key: "expiredAt",
                            option: { unique: false }
                        }
                    ]
                }
            ]
        });

        setInterval(async () => {
            try {
                await getInstance().delete({
                    tableName: this.tableName,
                    condition: (data: any) => {
                        return data["expiredAt"] <= this.time;
                    }
                });
            } catch (error) {
                console.log(error);
            }
        }, 60_000);
    }

    async get<T>(id: string) {
        const doc = await getInstance().queryByPrimaryKey<CacheDoc<T>>({
            tableName: this.tableName,
            value: id
        });
        if (!isVoid(doc?.data) && (!doc.expiredAt || doc.expiredAt > this.time)) {
            return doc.data;
        }

        await getInstance().delete<CacheDoc<T>>({
            tableName: this.tableName,
            condition: (data) => {
                return data._id === id;
            }
        });
        return null;
    }

    /**
   * @param id
   * @param data
   * @param timeout 过期时间
   */
    async set<T>(id: string, data: T, timeout = 0): Promise<void> {
        const $set: Omit<CacheDoc<T>, "_id"> = { data };
        timeout && ($set.expiredAt = this.time + timeout);
        const result = await getInstance().updateByPrimaryKey<CacheDoc<T>>({
            tableName: this.tableName,
            value: id,
            handle: (value) => {
                const _id = value._id;
                value = { _id, ...$set };
                return value;
            }
        });
        if (!result?._id) {
            await getInstance().insert({
                tableName: this.tableName,
                data: {
                    _id: id,
                    ...$set
                }
            });
        }
    }

    async increase(id: string, amount: number): Promise<number> {
        const result = await getInstance().updateByPrimaryKey<CacheDoc<number>>({
            tableName: this.tableName,
            value: id,
            handle: (value) => {
                const preData = value.data;
                value = { ...value, data: preData + amount };
                return value;
            }
        });
        if (result?._id) {
            return this.get<number>(id) as any;
        } else {
            await getInstance().insert({
                tableName: this.tableName,
                data: {
                    _id: id,
                    data: amount
                }
            });
            return amount;
        }
    }

    async delete(id: string): Promise<boolean> {
        const result: any = await getInstance().delete<CacheDoc<any>>({
            tableName: this.tableName,
            condition: (data) => {
                return data._id === id;
            }
        });

        return result?.length !== 0;
    }

    async pop<T>(id: string): Promise<T> {
        const result: any = await getInstance().delete<CacheDoc<T>>({
            tableName: this.tableName,
            condition: (data) => {
                return data._id === id;
            }
        });
        return (result?.length !== 0 ? (result[0]?.data as T ?? null) : null) as any;
    }
}
