/** @format */

import {initDB, getInstance} from './tsIndexDb'

type CacheDoc<T> = {
    _id: string
    data: T
    expiredAt?: number
}

const isVoid = (data: any) => {
    if (data === undefined || data === null || Object.is(NaN, data)) {
        return true
    }
    return false
}

export default class FrontendCache {
    private dbName = 'system'
    private tableName = 'Cache'
    private time = Math.floor(new Date().valueOf() / 1000)

    constructor() {
        initDB({
            dbName: this.dbName,
            version: 3,
            tables: [
                {
                    tableName: this.tableName,
                    option: {
                        keyPath: '_id',
                    },
                    indexes: [
                        {
                            key: 'expiredAt',
                            option: {unique: false},
                        },
                    ],
                },
            ],
        })

        setInterval(async () => {
            try {
                await getInstance().delete({
                    tableName: this.tableName,
                    condition: (data: any) => {
                        return data['expiredAt'] <= this.time
                    },
                })
            } catch (error) {
                console.log(error)
            }
        }, 60_000)
    }

    async get<T>(id: string) {
        const doc = await getInstance().queryByPrimaryKey<CacheDoc<T>>({
            tableName: this.tableName,
            value: id,
        })
        if (!isVoid(doc?.data) && (!doc.expiredAt || doc.expiredAt > this.time)) {
            return doc.data
        }

        await getInstance().delete<CacheDoc<T>>({
            tableName: this.tableName,
            condition: data => {
                return data._id === id
            },
        })
        return null
    }

    /**
     * @param id
     * @param data
     * @param timeout 过期时间
     */
    async set<T>(id: string, data: T, timeout = 0): Promise<void> {
        const $set: Omit<CacheDoc<T>, '_id'> = {data}
        timeout && ($set.expiredAt = this.time + timeout)
        const result = await getInstance().updateByPrimaryKey<CacheDoc<T>>({
            tableName: this.tableName,
            value: id,
            handle: value => {
                const _id = value._id
                value = {_id, ...$set}
                return value
            },
        })
        if (!result?._id) {
            await getInstance().insert({
                tableName: this.tableName,
                data: {
                    _id: id,
                    ...$set,
                },
            })
        }
    }

    async increase(id: string, amount: number): Promise<number> {
        const result = await getInstance().updateByPrimaryKey<CacheDoc<number>>({
            tableName: this.tableName,
            value: id,
            handle: value => {
                const preData = value.data
                value = {...value, data: preData + amount}
                return value
            },
        })
        if (result?._id) {
            return this.get<number>(id) as any
        } else {
            await getInstance().insert({
                tableName: this.tableName,
                data: {
                    _id: id,
                    data: amount,
                },
            })
            return amount
        }
    }

    async delete(id: string): Promise<boolean> {
        const result: any = await getInstance().delete<CacheDoc<any>>({
            tableName: this.tableName,
            condition: data => {
                return data._id === id
            },
        })

        return result?.length !== 0
    }

    async pop<T>(id: string): Promise<T> {
        const result: any = await getInstance().delete<CacheDoc<T>>({
            tableName: this.tableName,
            condition: data => {
                return data._id === id
            },
        })
        return (result?.length !== 0 ? (result[0]?.data as T) ?? null : null) as any
    }
}

export {initDB, getInstance}
