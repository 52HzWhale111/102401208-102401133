/* ============================================================================
 * 拾光校园 · 核心逻辑
 * ----------------------------------------------------------------------------
 * 这个文件里全是**纯函数**：不进 DOM、不碰 localStorage、不联网。
 * 页面用它渲染，单元测试用它断言，两边跑的是同一份代码。
 *
 * 写法说明（很重要，改之前先看）：
 *   用的是 UMD 包装 —— Node 里 `require('./js/core.js')` 能拿到模块，
 *   浏览器里经典 <script src> 执行后拿到 window.LF。
 *   之所以不用 ES module，是因为本项目要能**双击 html 直接打开**，
 *   而 file:// 协议下 Chrome 会按 CORS 拦掉 <script type="module">。
 *   同理，这个文件**必须自包含**：不能 require 别的文件，否则浏览器端就断了。
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- 枚举 */

  /** 信息类型：寻物 / 招领 */
  var KINDS = { lost: '寻物', found: '招领' };

  /**
   * 物品类别。取值与原型（失物招领小程序.fig 搜索页的「物品类别」筛选）一致。
   * 原型里发布表单没有这一项，但搜索页按它筛选 —— 采集端不采集，筛选端就永远筛不到，所以补上。
   */
  var CATEGORIES = [
    { id: 'card',       label: '证件卡片' },
    { id: 'digital',    label: '数码电子' },
    { id: 'keychain',   label: '钥匙·挂件' },
    { id: 'bag',        label: '服饰包袋' },
    { id: 'stationery', label: '书籍文具' },
    { id: 'other',      label: '其他小物' }
  ];

  /** 联系方式类型。原型里没有录入项，是作业要求「查看发布者提供的联系方式」后补的。 */
  var CONTACT_TYPES = [
    { id: 'phone',  label: '手机', hint: '如：138-0013-8000' },
    { id: 'wechat', label: '微信', hint: '如：shiguang_2024' },
    { id: 'qq',     label: 'QQ',   hint: '如：123456789' }
  ];

  var DESC_MAX = 200;   // 详细描述字数上限
  var TITLE_MAX = 40;   // 物品名称字数上限

  /** 当前登录用户（本项目没有登录，写死一个；「我的」页只显示这个人的发布） */
  var CURRENT_USER = { name: '小白同学', college: '计算机学院', grade: '2023级' };

  /* ------------------------------------------------------------ 基础工具 */

  function trim(v) {
    return v == null ? '' : String(v).replace(/^\s+|\s+$/g, '');
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  /** 转义用户输入后再拼进 innerHTML，防止发布一条 <img onerror> 就把页面打挂 */
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function categoryLabel(id) {
    var c = findById(CATEGORIES, id);
    return c ? c.label : '';
  }

  function contactTypeLabel(id) {
    var c = findById(CONTACT_TYPES, id);
    return c ? c.label : '';
  }

  function kindLabel(item) {
    return item && KINDS[item.kind] ? KINDS[item.kind] : '';
  }

  function isKnownCategory(id) {
    return !!findById(CATEGORIES, id);
  }

  function isKnownContactType(id) {
    return !!findById(CONTACT_TYPES, id);
  }

  /* ---------------------------------------------------------------- 状态 */

  /**
   * 全站只有两个逻辑状态：open（还在找/还在等人认领）和 done（已找到/已归还）。
   * 原型和各文档里出现过「寻找中 / 待认领 / 找到 / 已找回 / 焦急寻找中 / 已完成」七八种叫法，
   * 统一收敛到这两个值，展示文案由 statusText() 派生，改文案不用改数据。
   */
  function statusText(item) {
    if (!item) return '';
    if (item.kind === 'found') return item.state === 'done' ? '已归还' : '寻找失主中';
    return item.state === 'done' ? '已找到' : '焦急寻找中';
  }

  /** 列表标签配色：寻物橙 / 招领绿 / 已完成蓝 */
  function toneOf(item) {
    if (!item) return 'green';
    if (item.state === 'done') return 'blue';
    return item.kind === 'found' ? 'green' : 'orange';
  }

  /** 这条是不是当前用户发的（只有发布者本人能改状态） */
  function isMine(item, user) {
    var me = user || CURRENT_USER;
    return !!(item && item.author && item.author.name === me.name);
  }

  /** 能不能标记为已完成：本人发布 + 还没标记过。标记不可逆。 */
  function canTransit(item, user) {
    return !!(item && item.state === 'open' && isMine(item, user));
  }

  /**
   * 能不能编辑：只有发布者本人能改自己的信息。
   * 和 canTransit 不同，**已完成的信息也能改** —— 「已找到」是一件事实，
   * 但描述写错了、联系方式填漏了，什么时候都该让人补上。能不能改状态是另一回事。
   */
  function canEdit(item, user) {
    return !!(item && isMine(item, user));
  }

  /**
   * 标记为已完成，返回**新对象**（不改原对象，方便测试和撤销）。
   * 寻物 → 已找到；招领 → 已归还。具体文案由 statusText() 决定。
   */
  function markDone(item, at) {
    if (!item) return item;
    var when = at || new Date().toISOString();
    var next = {};
    for (var k in item) if (Object.prototype.hasOwnProperty.call(item, k)) next[k] = item[k];
    next.state = 'done';
    next.updatedAt = when;
    next.timeline = (item.timeline || []).concat([{ state: 'done', at: when }]);
    return next;
  }

  /**
   * 按草稿改写一条已有信息（编辑功能），返回**新对象**（不改原对象，方便测试和撤销）。
   *
   * 只覆盖表单上那几个字段，其余原样保留 —— 这是编辑和发布最大的区别：
   *   - id / createdAt / author 不能变，否则这条信息就变成另一个人发的另一条了；
   *   - images 不能动（表单里没有图片项，覆盖成空数组等于把配图删了）；
   *   - **state 也不能动** —— 编辑一段描述不该把「已找到」打回「焦急寻找中」。
   *     normalizeDraft() 会无条件把 state 设成 open，所以这里绝不能复用它。
   *
   * timeline 追加一条 action:'edit' 的条目。注意老数据（以及 markDone 写下的）
   * 都是 { state, at } 两个键，没有 action —— 判断「有没有被编辑过」要看 action，别看键的个数。
   */
  function applyEdit(item, draft, at) {
    if (!item) return item;
    var when = at || new Date().toISOString();
    var next = {};
    for (var k in item) if (Object.prototype.hasOwnProperty.call(item, k)) next[k] = item[k];

    var d = draft || {};
    var contact = d.contact || {};

    next.kind       = d.kind === 'found' ? 'found' : 'lost';
    next.title      = trim(d.title);
    next.category   = d.category;
    next.place      = trim(d.place);
    next.happenedAt = trim(d.happenedAt);
    next.desc       = trim(d.desc);
    next.contact    = { type: contact.type, value: trim(contact.value) };
    next.updatedAt  = when;
    next.timeline   = (item.timeline || []).concat([{ state: item.state, at: when, action: 'edit' }]);
    return next;
  }

  /* ---------------------------------------------------------------- 校验 */

  /**
   * 校验发布表单。返回 { ok, errors }，errors 按字段名给提示文案。
   * 页面拿它做前端拦截，单测拿它验边界。
   */
  function validateDraft(draft) {
    var d = draft || {};
    var errors = {};

    var title = trim(d.title);
    if (!title) errors.title = '请填写物品名称';
    else if (title.length > TITLE_MAX) errors.title = '物品名称最多 ' + TITLE_MAX + ' 个字';

    if (!isKnownCategory(d.category)) errors.category = '请选择物品类别';

    if (trim(d.desc).length > DESC_MAX) errors.desc = '详细描述最多 ' + DESC_MAX + ' 个字';

    var contact = d.contact || {};
    if (!isKnownContactType(contact.type)) {
      errors.contact = '请选择联系方式类型';
    } else {
      var value = trim(contact.value);
      if (!value) errors.contact = '请填写' + contactTypeLabel(contact.type);
      else if (contact.type === 'phone' && value.replace(/[^0-9]/g, '').length < 7) {
        errors.contact = '手机号至少 7 位数字';
      }
    }

    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /**
   * 把表单草稿补全成一条完整的信息（不生成 id，id 由 store 负责，因为要保证全局唯一）。
   * 时间语义：happenedAt 是「丢失/拾到时间」（用户填，可空），createdAt 是「发布时间」。
   */
  function normalizeDraft(draft, now) {
    var d = draft || {};
    var at = now || new Date().toISOString();
    var contact = d.contact || {};
    return {
      id: d.id || '',
      kind: d.kind === 'found' ? 'found' : 'lost',
      title: trim(d.title),
      category: d.category,
      place: trim(d.place),
      happenedAt: trim(d.happenedAt),
      desc: trim(d.desc),
      images: (d.images || []).slice(),
      contact: { type: contact.type, value: trim(contact.value) },
      state: 'open',
      author: d.author || CURRENT_USER,
      createdAt: at,
      updatedAt: at,
      timeline: [{ state: 'open', at: at }]
    };
  }

  /* ---------------------------------------------------------------- 检索 */

  /**
   * 单条信息是否命中筛选条件。
   * query = { keyword, kind, category, place, state }
   * 值为 'all' 或空 → 该项不筛选。
   * keyword 在「标题 / 地点 / 描述 / 类别名」里做子串匹配（大小写不敏感）。
   */
  function matchesQuery(item, query) {
    if (!item) return false;
    var q = query || {};

    if (q.kind && q.kind !== 'all' && item.kind !== q.kind) return false;
    if (q.category && q.category !== 'all' && item.category !== q.category) return false;
    if (q.state && q.state !== 'all' && item.state !== q.state) return false;

    // 地点是自由文本，按「区域关键词」做子串匹配，例如「图书馆」能命中「图书馆三楼 C 区自习室」
    if (q.place && q.place !== 'all' && String(item.place || '').indexOf(q.place) === -1) return false;

    // 只看最近一段时间（广场页右上角那个下拉）
    if (!withinRange(item, q.within, q.now)) return false;

    var keyword = trim(q.keyword).toLowerCase();
    if (keyword) {
      var haystack = [item.title, item.place, item.desc, categoryLabel(item.category)]
        .join(' ').toLowerCase();
      if (haystack.indexOf(keyword) === -1) return false;
    }
    return true;
  }

  /** 取一条信息用于排序的时间：优先「丢失/拾到时间」，没有就用发布时间 */
  function timeOf(item) {
    var raw = (item && (item.happenedAt || item.createdAt)) || '';
    var t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
  }

  /* 「只看最近多久」的几个档位。半年按 183 天、一年按 365 天算 ——
     用天数而不是 setMonth()，是为了可预期：不会因为跨月天数不同而忽宽忽窄。 */
  var WITHIN_DAYS = { '7d': 7, '30d': 30, '6m': 183, '1y': 365 };

  /**
   * 时间范围筛选：'7d' | '30d' | '6m' | '1y'；'all' 或不传 = 不限。
   * 比较的是「丢失 / 拾到的时间」（和排序共用 timeOf），不是发布时间 ——
   * 用户想知道的是「最近丢的东西」，不是「最近录入的东西」。
   *
   * now 是留给测试的注入口：不传就取当前时刻。测试里必须传，
   * 否则「近 7 天」会跟着跑测试的那一天飘，今天绿明天红。
   */
  function withinRange(item, within, now) {
    if (!within || within === 'all') return true;
    var days = WITHIN_DAYS[within];
    if (!days) return true;          // 认不出来的值一律当「不限」，别把列表筛成空的
    var base = now ? new Date(now) : new Date();
    var t = base.getTime();
    if (isNaN(t)) t = new Date().getTime();
    return timeOf(item) >= t - days * 86400000;
  }

  /** 按时间排序，默认最新在前。返回新数组，不动入参。 */
  function sortByTime(items, dir) {
    var sign = dir === 'asc' ? 1 : -1;
    return (items || []).slice().sort(function (a, b) {
      var diff = timeOf(a) - timeOf(b);
      if (diff !== 0) return diff * sign;
      // 时间相同时用 id 兜底，保证排序稳定（否则两次渲染顺序可能不一样）
      return String(a && a.id).localeCompare(String(b && b.id)) * sign;
    });
  }

  /**
   * 筛选 + 排序，页面列表直接用这个。
   * query 上多认两个可选字段：
   *   sort   —— 'desc'（默认，最新在前）/ 'asc'（最早在前）
   *   within —— '7d' / '30d' / '6m' / '1y'，不传 = 不限时间
   * 两个都不传时行为和以前完全一样，搜索页 / 引导页不受影响。
   */
  function search(items, query) {
    var q = query || {};
    var hit = (items || []).filter(function (item) { return matchesQuery(item, q); });
    return sortByTime(hit, q.sort === 'asc' ? 'asc' : 'desc');
  }

  /* ---------------------------------------------------------------- 时间 */

  function startOfDay(d) {
    var x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /** 列表上的时间文案：今天 14:20 / 昨天 19:00 / 10-27 14:20 */
  function formatTime(iso, now) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var today = startOfDay(now ? new Date(now) : new Date());
    var days = Math.round((today.getTime() - startOfDay(d).getTime()) / 86400000);
    var hm = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);

    if (days === 0) return '今天 ' + hm;
    if (days === 1) return '昨天 ' + hm;
    if (days === 2) return '前天 ' + hm;
    return pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) + ' ' + hm;
  }

  /** 详情页发布者卡片上的相对时间：刚刚 / 12 分钟前 / 2 小时前 / 3 天前 */
  function formatRelative(iso, now) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var base = now ? new Date(now) : new Date();
    var diff = base.getTime() - d.getTime();
    if (diff < 0) return '刚刚';

    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return minutes + ' 分钟前';

    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' 小时前';

    var days = Math.floor(hours / 24);
    if (days < 30) return days + ' 天前';

    return pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }

  /**
   * 把数据里的时间转成 <input type="datetime-local"> 认得的字符串
   * ——**本地**时间的 YYYY-MM-DDTHH:mm。
   *
   * 编辑页非做这个转换不可：种子数据里的 happenedAt 是 toISOString() 出来的
   * 「2026-10-06T15:00:00.000Z」，而 datetime-local 只吃上面那一种写法。
   * 把带 Z 的 ISO 串直接塞进 input.value，浏览器会判定格式非法、输入框显示为空 ——
   * 看起来就像「这条信息没有时间」，用户一保存就把原时间抹掉了。
   *
   * 认不出来的时间返回空串：宁可让用户重填，也别塞一个错的时间进去。
   */
  function toLocalInput(value) {
    var raw = trim(value);
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2)
         + 'T' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
  }

  /* ------------------------------------------------------------------ ID */

  /** 生成形如 LF-20260928-001 的唯一 ID：同一天内取当前最大序号 +1 */
  function nextId(items, now) {
    var d = now ? new Date(now) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var prefix = 'LF-' + d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + '-';

    var max = 0;
    (items || []).forEach(function (item) {
      var id = item && item.id;
      if (typeof id !== 'string' || id.indexOf(prefix) !== 0) return;
      var n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return prefix + pad(max + 1, 3);
  }

  /* ----------------------------------------------------------------- */

  return {
    KINDS: KINDS,
    CATEGORIES: CATEGORIES,
    CONTACT_TYPES: CONTACT_TYPES,
    DESC_MAX: DESC_MAX,
    TITLE_MAX: TITLE_MAX,
    CURRENT_USER: CURRENT_USER,

    trim: trim,
    escapeHtml: escapeHtml,
    categoryLabel: categoryLabel,
    contactTypeLabel: contactTypeLabel,
    kindLabel: kindLabel,

    statusText: statusText,
    toneOf: toneOf,
    isMine: isMine,
    canTransit: canTransit,
    canEdit: canEdit,
    markDone: markDone,
    applyEdit: applyEdit,

    validateDraft: validateDraft,
    normalizeDraft: normalizeDraft,

    matchesQuery: matchesQuery,
    search: search,
    sortByTime: sortByTime,
    withinRange: withinRange,
    WITHIN_DAYS: WITHIN_DAYS,

    formatTime: formatTime,
    formatRelative: formatRelative,
    toLocalInput: toLocalInput,
    nextId: nextId
  };
});
