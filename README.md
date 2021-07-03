# indexDB-export-default-class-FrontendCache-
Simple and easy to use timing task based on indexdb


**定时用法**

```
// 可以挂载在全局方法里
window.$cache = new FrontendCache();
Vue.prototype.$cache = new FrontendCache();

// 添加数据
await $cache.set(1, {a:1});
// {_id:1, data:{a:1}}
await $cache.set(1,{a:1},5000);
//定时5秒清除 {_id:1, data:{a:1}, expiredAt: 1625320214}

// 获取数据
await $cache.get(1);
// {a:1}

// 删除数据
await $cache.delete(1)
// 返回true或者false

// 删除数据并显示删除的数据
await $cache.pop(1)
// {a:1} 并且数据被删除

// 为数字增加值或者增加字符串
await $cache.set(1,200);
await $cache.increase(1,300);
// 打印出500， 数据改为{_id:1, data:500}
await $cache.set(1,'A');
await $cache.increase(1,'B');
// 打印出'AB'， 数据改为{_id:1, data:'AB'}
```
