/* ============================================================================
 * 拾光校园 · 数据存储
 * ----------------------------------------------------------------------------
 * 对外只有 LF.store 一个对象。页面通过它读写信息，不直接碰 localStorage。
 *
 * 三个设计要点：
 *   1. 首次运行（localStorage 为空）自动灌入 js/seed.js 的种子数据，
 *      否则助教克隆下来打开就是一片空白。
 *   2. localStorage 不可用时（file:// 的某些隐私设置、无痕模式）**静默降级为内存**，
 *      页面照常能跑，只是刷新后数据没了 —— 不能因为这个让整页白屏。
 *   3. 存储内容被改坏时（手工改过 localStorage）回落到种子数据，同样不白屏。
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./seed.js'));
  } else {
    root.LF = root.LF || {};
    root.LF.store = factory(root.LF, root.LF.buildSeedItems);
  }
})(typeof self !== 'undefined' ? self : this, function (LF, buildSeedItems) {
  'use strict';

  var STORAGE_KEY = 'shiguang.items.v1';

  /* 探测 localStorage 是否真的可用。Safari 无痕下 setItem 会抛异常，
     file:// 下也可能被策略禁用，所以必须真的写一次才算数。 */
  var backend = (function () {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      var probe = '__shiguang_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    } catch (e) {
      return null;
    }
  })();

  var persistent = backend !== null;
  var cache = null;

  function load() {
    if (cache) return cache;

    if (persistent) {
      try {
        var raw = backend.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          // 注意：空数组是合法状态（用户删光了），不能当成「没数据」去灌种子
          if (Array.isArray(parsed)) { cache = parsed; return cache; }
        }
      } catch (e) {
        // 内容损坏 → 当作没数据，下面回落到种子
      }
    }

    cache = buildSeedItems();
    save();
    return cache;
  }

  function save() {
    if (!persistent || !cache) return false;
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(cache));
      return true;
    } catch (e) {
      return false;   // 配额满或被禁写：不影响页面运行，只是这次没存下
    }
  }

  function find(id) {
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  /** 取全部信息（返回副本，外部改不动内部状态） */
  function all() {
    return load().slice();
  }

  function get(id) {
    return find(id);
  }

  /**
   * 新增一条信息。会先跑一遍校验，不合法直接返回 null（调用方应先用
   * LF.validateDraft 给出具体错误提示，这里只是兜底）。
   * 返回落库后的完整对象，其中 id 由 LF.nextId 生成、保证唯一。
   */
  function add(draft, now) {
    var check = LF.validateDraft(draft);
    if (!check.ok) return null;

    var list = load();
    var stamp = now ? new Date(now) : new Date();
    var item = LF.normalizeDraft(draft, stamp.toISOString());
    item.id = LF.nextId(list, stamp);

    list.push(item);
    save();
    return item;
  }

  /**
   * 标记为已完成（寻物→已找到 / 招领→已归还）。
   * 只有发布者本人、且当前是 open 状态才能改 —— 标记不可逆。
   * 不允许时返回 null。
   */
  function markDone(id, now) {
    var item = find(id);
    if (!item || !LF.canTransit(item)) return null;

    var stamp = now ? new Date(now) : new Date();
    var updated = LF.markDone(item, stamp.toISOString());
    replace(id, updated);
    save();
    return updated;
  }

  function replace(id, next) {
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) { list[i] = next; return true; }
    }
    return false;
  }

  function remove(id) {
    var list = load();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) {
        list.splice(i, 1);
        save();
        return true;
      }
    }
    return false;
  }

  /** 恢复演示数据（页面上的「重置演示数据」按钮用） */
  function reset(now) {
    cache = buildSeedItems(now);
    save();
    return cache.slice();
  }

  /**
   * 某个用户（默认当前用户）的发布统计，给「我的」页的统计格用。
   * 返回 { total, open, done }
   */
  function stats(user) {
    var list = load().filter(function (item) { return LF.isMine(item, user); });
    return {
      total: list.length,
      open: list.filter(function (i) { return i.state === 'open'; }).length,
      done: list.filter(function (i) { return i.state === 'done'; }).length
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    persistent: persistent,
    all: all,
    get: get,
    add: add,
    markDone: markDone,
    remove: remove,
    reset: reset,
    stats: stats
  };
});
