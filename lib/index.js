"use strict";
/** @format */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstance = exports.initDB = void 0;
const tsIndexDb_1 = require("./tsIndexDb");
Object.defineProperty(exports, "initDB", { enumerable: true, get: function () { return tsIndexDb_1.initDB; } });
Object.defineProperty(exports, "getInstance", { enumerable: true, get: function () { return tsIndexDb_1.getInstance; } });
const isVoid = (data) => {
    if (data === undefined || data === null || Object.is(NaN, data)) {
        return true;
    }
    return false;
};
class FrontendCache {
    constructor() {
        this.dbName = 'system';
        this.tableName = 'Cache';
        this.time = Math.floor(new Date().valueOf() / 1000);
        (0, tsIndexDb_1.initDB)({
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
                            option: { unique: false },
                        },
                    ],
                },
            ],
        });
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, tsIndexDb_1.getInstance)().delete({
                    tableName: this.tableName,
                    condition: (data) => {
                        return data['expiredAt'] <= this.time;
                    },
                });
            }
            catch (error) {
                console.log(error);
            }
        }), 60000);
    }
    get(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const doc = yield (0, tsIndexDb_1.getInstance)().queryByPrimaryKey({
                tableName: this.tableName,
                value: id,
            });
            if (!isVoid(doc === null || doc === void 0 ? void 0 : doc.data) && (!doc.expiredAt || doc.expiredAt > this.time)) {
                return doc.data;
            }
            yield (0, tsIndexDb_1.getInstance)().delete({
                tableName: this.tableName,
                condition: data => {
                    return data._id === id;
                },
            });
            return null;
        });
    }
    /**
     * @param id
     * @param data
     * @param timeout 过期时间
     */
    set(id, data, timeout = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const $set = { data };
            timeout && ($set.expiredAt = this.time + timeout);
            const result = yield (0, tsIndexDb_1.getInstance)().updateByPrimaryKey({
                tableName: this.tableName,
                value: id,
                handle: value => {
                    const _id = value._id;
                    value = Object.assign({ _id }, $set);
                    return value;
                },
            });
            if (!(result === null || result === void 0 ? void 0 : result._id)) {
                yield (0, tsIndexDb_1.getInstance)().insert({
                    tableName: this.tableName,
                    data: Object.assign({ _id: id }, $set),
                });
            }
        });
    }
    increase(id, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield (0, tsIndexDb_1.getInstance)().updateByPrimaryKey({
                tableName: this.tableName,
                value: id,
                handle: value => {
                    const preData = value.data;
                    value = Object.assign(Object.assign({}, value), { data: preData + amount });
                    return value;
                },
            });
            if (result === null || result === void 0 ? void 0 : result._id) {
                return this.get(id);
            }
            else {
                yield (0, tsIndexDb_1.getInstance)().insert({
                    tableName: this.tableName,
                    data: {
                        _id: id,
                        data: amount,
                    },
                });
                return amount;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield (0, tsIndexDb_1.getInstance)().delete({
                tableName: this.tableName,
                condition: data => {
                    return data._id === id;
                },
            });
            return (result === null || result === void 0 ? void 0 : result.length) !== 0;
        });
    }
    pop(id) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield (0, tsIndexDb_1.getInstance)().delete({
                tableName: this.tableName,
                condition: data => {
                    return data._id === id;
                },
            });
            return ((result === null || result === void 0 ? void 0 : result.length) !== 0 ? (_b = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : null : null);
        });
    }
}
exports.default = FrontendCache;
