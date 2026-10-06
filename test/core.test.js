/* ============================================================================
 * 单元测试：js/core.js（纯逻辑）与 js/store.js（数据存取）
 * ----------------------------------------------------------------------------
 * 跑法：
 *   npm install      # 只装一次，装 mocha
 *   npm test
 *
 * 为什么能直接在 Node 里跑：js/core.js 和 js/store.js 都用 UMD 包装，
 * 浏览器里挂到 window.LF，Node 里走 module.exports。测的和页面跑的是同一份代码。
 *
 * 测试数据的构造思路见 README「单元测试」一节。
 * ========================================================================== */
'use strict';

const assert = require('node:assert');
const LF = require('../js/core.js');
const store = require('../js/store.js');

/* ------------------------------------------------------------ 测试夹具 */

/** 造一条最小可用的信息，只覆盖需要改的字段 */
function makeItem(overrides) {
  return Object.assign({
    id: 'LF-20260928-001',
    kind: 'lost',
    title: '黑色 Sony 降噪耳机',
    category: 'digital',
    place: '图书馆三楼 C 区自习室',
    happenedAt: '2026-09-28T14:20',
    desc: '在自习室捡到的',
    images: [],
    contact: { type: 'phone', value: '138-0013-8000' },
    state: 'open',
    author: LF.CURRENT_USER,
    createdAt: '2026-09-28T14:20:00.000Z',
    updatedAt: '2026-09-28T14:20:00.000Z',
    timeline: [{ state: 'open', at: '2026-09-28T14:20:00.000Z' }]
  }, overrides || {});
}

/** 造一份合法的发布草稿 */
function makeDraft(overrides) {
  return Object.assign({
    kind: 'lost',
    title: '黑色 Sony 降噪耳机',
    category: 'digital',
    place: '图书馆三楼 C 区自习室',
    happenedAt: '2026-09-28T14:20',
    desc: '在自习室捡到的',
    contact: { type: 'phone', value: '138-0013-8000' }
  }, overrides || {});
}

/* ==========================================================================
 * 一、表单校验 LF.validateDraft
 * ======================================================================== */

describe('LF.validateDraft —— 发布表单校验', function () {

  it('① 合法草稿应当通过', function () {
    const result = LF.validateDraft(makeDraft());
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('② 物品名称为空（或只有空格）时不通过，并给出提示', function () {
    assert.strictEqual(LF.validateDraft(makeDraft({ title: '' })).ok, false);
    assert.strictEqual(LF.validateDraft(makeDraft({ title: '   ' })).ok, false);
    assert.match(LF.validateDraft(makeDraft({ title: '' })).errors.title, /物品名称/);
  });

  it('③ 物品名称超过 40 字不通过', function () {
    const tooLong = '耳'.repeat(LF.TITLE_MAX + 1);
    const result = LF.validateDraft(makeDraft({ title: tooLong }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.title);

    // 边界：正好 40 字应当通过
    assert.strictEqual(LF.validateDraft(makeDraft({ title: '耳'.repeat(LF.TITLE_MAX) })).ok, true);
  });

  it('④ 没选物品类别不通过；选了不存在的类别也不通过', function () {
    assert.ok(LF.validateDraft(makeDraft({ category: '' })).errors.category);
    assert.ok(LF.validateDraft(makeDraft({ category: '不存在的类别' })).errors.category);
  });

  it('⑤ 详细描述超过 200 字不通过，正好 200 字通过', function () {
    assert.ok(LF.validateDraft(makeDraft({ desc: '字'.repeat(LF.DESC_MAX + 1) })).errors.desc);
    assert.strictEqual(LF.validateDraft(makeDraft({ desc: '字'.repeat(LF.DESC_MAX) })).ok, true);
  });

  it('⑥ 联系方式缺失或手机号位数不足时不通过', function () {
    assert.ok(LF.validateDraft(makeDraft({ contact: { type: 'phone', value: '' } })).errors.contact);
    assert.ok(LF.validateDraft(makeDraft({ contact: { type: 'phone', value: '123' } })).errors.contact);
    assert.ok(LF.validateDraft(makeDraft({ contact: { type: '', value: '138' } })).errors.contact);

    // 带分隔符的手机号应当被接受
    assert.strictEqual(
      LF.validateDraft(makeDraft({ contact: { type: 'phone', value: '138-0013-8000' } })).ok, true);
    // 微信号不受手机号位数限制
    assert.strictEqual(
      LF.validateDraft(makeDraft({ contact: { type: 'wechat', value: 'abc' } })).ok, true);
  });

  it('⑦ 一次可以报出多个字段的错误（不是遇到第一个就停）', function () {
    const result = LF.validateDraft({ title: '', category: '', contact: {} });
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(
      Object.keys(result.errors).sort(), ['category', 'contact', 'title']);
  });
});

/* ==========================================================================
 * 二、草稿补全 LF.normalizeDraft
 * ======================================================================== */

describe('LF.normalizeDraft —— 补全成完整的信息', function () {

  it('⑧ 补上 state / 时间戳 / timeline，并去掉首尾空格', function () {
    const at = '2026-10-07T08:00:00.000Z';
    const item = LF.normalizeDraft(makeDraft({ title: '  耳机  ', place: ' 图书馆 ' }), at);

    assert.strictEqual(item.title, '耳机');
    assert.strictEqual(item.place, '图书馆');
    assert.strictEqual(item.state, 'open');
    assert.strictEqual(item.createdAt, at);
    assert.strictEqual(item.updatedAt, at);
    assert.deepStrictEqual(item.timeline, [{ state: 'open', at: at }]);
  });

  it('⑨ kind 只认 found，其他值一律当 lost，避免脏数据把标签画错', function () {
    assert.strictEqual(LF.normalizeDraft(makeDraft({ kind: 'found' })).kind, 'found');
    assert.strictEqual(LF.normalizeDraft(makeDraft({ kind: '乱七八糟' })).kind, 'lost');
    assert.strictEqual(LF.normalizeDraft(makeDraft({ kind: undefined })).kind, 'lost');
  });
});

/* ==========================================================================
 * 三、状态展示与流转
 * ======================================================================== */

describe('状态文案与配色', function () {

  it('⑩ 四种组合的文案与配色都对得上', function () {
    assert.strictEqual(LF.statusText(makeItem({ kind: 'lost',  state: 'open' })), '焦急寻找中');
    assert.strictEqual(LF.statusText(makeItem({ kind: 'found', state: 'open' })), '寻找失主中');
    assert.strictEqual(LF.statusText(makeItem({ kind: 'lost',  state: 'done' })), '已找到');
    assert.strictEqual(LF.statusText(makeItem({ kind: 'found', state: 'done' })), '已归还');

    assert.strictEqual(LF.toneOf(makeItem({ kind: 'lost',  state: 'open' })), 'orange');
    assert.strictEqual(LF.toneOf(makeItem({ kind: 'found', state: 'open' })), 'green');
    assert.strictEqual(LF.toneOf(makeItem({ state: 'done' })), 'blue');
  });
});

describe('LF.canTransit / LF.markDone —— 标记已找到 / 已归还', function () {

  it('⑪ 只有发布者本人、且还是 open 状态时才能标记', function () {
    const mine = makeItem({ author: LF.CURRENT_USER, state: 'open' });
    const others = makeItem({ author: { name: '小金毛同学' }, state: 'open' });
    const alreadyDone = makeItem({ author: LF.CURRENT_USER, state: 'done' });

    assert.strictEqual(LF.canTransit(mine), true);
    assert.strictEqual(LF.canTransit(others), false, '不是本人发布的不能改');
    assert.strictEqual(LF.canTransit(alreadyDone), false, '标记不可逆');
  });

  it('⑫ markDone 返回新对象，不改原对象，并追加一条 timeline', function () {
    const item = makeItem();
    const at = '2026-10-07T09:30:00.000Z';
    const done = LF.markDone(item, at);

    assert.notStrictEqual(done, item, '必须是新对象');
    assert.strictEqual(item.state, 'open', '原对象不能被改动');
    assert.strictEqual(item.timeline.length, 1, '原对象的时间线不能被改动');

    assert.strictEqual(done.state, 'done');
    assert.strictEqual(done.updatedAt, at);
    assert.strictEqual(done.timeline.length, 2);
    assert.deepStrictEqual(done.timeline[1], { state: 'done', at: at });
  });
});

/* ==========================================================================
 * 四、搜索与筛选
 * ======================================================================== */

describe('LF.search —— 关键词与条件筛选', function () {

  const items = [
    makeItem({ id: 'A', title: '黑色 Sony 降噪耳机',  category: 'digital',    place: '图书馆三楼 C 区', kind: 'found', happenedAt: '2026-10-01T10:00' }),
    makeItem({ id: 'B', title: '蓝色水壶',            category: 'other',      place: '二食堂二楼',     kind: 'lost',  happenedAt: '2026-10-03T10:00' }),
    makeItem({ id: 'C', title: '校园一卡通',          category: 'card',       place: '图书馆一楼服务台', kind: 'lost', happenedAt: '2026-10-02T10:00' })
  ];

  it('⑬ 关键词命中物品名称', function () {
    const hit = LF.search(items, { keyword: '耳机' });
    assert.deepStrictEqual(hit.map(i => i.id), ['A']);
  });

  it('⑭ 关键词也命中地点、描述和类别名', function () {
    assert.deepStrictEqual(LF.search(items, { keyword: '食堂' }).map(i => i.id), ['B']);
    assert.deepStrictEqual(LF.search(items, { keyword: '数码电子' }).map(i => i.id), ['A']);
  });

  it('⑮ 类别筛选只返回该类别', function () {
    assert.deepStrictEqual(LF.search(items, { category: 'card' }).map(i => i.id), ['C']);
    assert.deepStrictEqual(LF.search(items, { category: 'all' }).length, 3, 'all 表示不筛选');
  });

  it('⑯ 地点按子串匹配，"图书馆" 能同时命中两个地点', function () {
    assert.deepStrictEqual(LF.search(items, { place: '图书馆' }).map(i => i.id), ['C', 'A']);
  });

  it('⑰ 多个条件是与关系，且结果按时间倒序', function () {
    const hit = LF.search(items, { keyword: '图书馆', kind: 'lost' });
    assert.deepStrictEqual(hit.map(i => i.id), ['C']);
  });

  it('⑱ 搜不到时返回空数组，不是 null（页面上可以直接 .length 判断）', function () {
    const hit = LF.search(items, { keyword: '不存在的关键词' });
    assert.ok(Array.isArray(hit));
    assert.strictEqual(hit.length, 0);
  });

  it('⑲ search 不修改传入的数组', function () {
    const snapshot = items.map(i => i.id);
    LF.search(items, { keyword: '耳机' });
    assert.deepStrictEqual(items.map(i => i.id), snapshot);
  });
});

/* ==========================================================================
 * 五、安全与格式
 * ======================================================================== */

describe('LF.escapeHtml —— 防止用户输入打穿页面', function () {

  it('⑳ 尖括号、引号、& 都被转义', function () {
    assert.strictEqual(
      LF.escapeHtml('<img src=x onerror="alert(1)">'),
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    assert.strictEqual(LF.escapeHtml("it's & that"), 'it&#39;s &amp; that');
  });

  it('㉑ null / undefined / 数字都能安全处理', function () {
    assert.strictEqual(LF.escapeHtml(null), '');
    assert.strictEqual(LF.escapeHtml(undefined), '');
    assert.strictEqual(LF.escapeHtml(42), '42');
  });
});

describe('时间格式化', function () {

  const now = '2026-10-07T15:00:00';

  it('㉒ 今天 / 昨天 / 前天 / 更早，用不同的写法', function () {
    assert.strictEqual(LF.formatTime('2026-10-07T09:05', now), '今天 09:05');
    assert.strictEqual(LF.formatTime('2026-10-06T19:00', now), '昨天 19:00');
    assert.strictEqual(LF.formatTime('2026-10-05T08:30', now), '前天 08:30');
    assert.strictEqual(LF.formatTime('2026-09-28T14:20', now), '09-28 14:20');
  });

  it('㉓ 时间非法时返回空串，不抛异常也不显示 Invalid Date', function () {
    assert.strictEqual(LF.formatTime('不是时间', now), '');
    assert.strictEqual(LF.formatTime('', now), '');
  });

  it('㉔ 相对时间：刚刚 / 分钟 / 小时 / 天', function () {
    assert.strictEqual(LF.formatRelative('2026-10-07T14:59:30', now), '刚刚');
    assert.strictEqual(LF.formatRelative('2026-10-07T14:30:00', now), '30 分钟前');
    assert.strictEqual(LF.formatRelative('2026-10-07T12:00:00', now), '3 小时前');
    assert.strictEqual(LF.formatRelative('2026-10-04T12:00:00', now), '3 天前');
  });
});

describe('LF.nextId —— 生成唯一 ID', function () {

  it('㉕ 同一天内序号递增，不重复', function () {
    const day = '2026-10-07T10:00:00';
    const list = [];

    const first = LF.nextId(list, day);
    list.push(makeItem({ id: first }));
    const second = LF.nextId(list, day);
    list.push(makeItem({ id: second }));

    assert.strictEqual(first, 'LF-20261007-001');
    assert.strictEqual(second, 'LF-20261007-002');
    assert.notStrictEqual(first, second);
  });

  it('㉖ 序号有空洞时取最大值 +1，不会覆盖已有记录', function () {
    const day = '2026-10-07T10:00:00';
    const list = [
      makeItem({ id: 'LF-20261007-001' }),
      makeItem({ id: 'LF-20261007-007' })     // 中间被删了几条
    ];
    assert.strictEqual(LF.nextId(list, day), 'LF-20261007-008');
  });

  it('㉗ 不同日期的前缀互不干扰', function () {
    const list = [makeItem({ id: 'LF-20261006-005' })];
    assert.strictEqual(LF.nextId(list, '2026-10-07T09:00:00'), 'LF-20261007-001');
  });
});

/* ==========================================================================
 * 六、数据存取 LF.store
 * ======================================================================== */

describe('LF.store —— 增删改查', function () {

  beforeEach(function () {
    store.reset('2026-10-07T10:00:00');   // 每个用例都从干净的种子数据开始
  });

  it('㉘ 首次使用会灌入种子数据', function () {
    const all = store.all();
    assert.ok(all.length > 0, '种子数据不能是空的，否则页面打开一片空白');
    assert.ok(store.get(all[0].id), '按 id 能取回同一条');
  });

  it('㉙ 新增一条后能查回来，且 id 是自动生成的', function () {
    const before = store.all().length;
    const item = store.add(makeDraft({ title: '测试用的一把伞' }), '2026-10-07T11:00:00');

    assert.ok(item, '合法草稿应当入库成功');
    assert.match(item.id, /^LF-\d{8}-\d{3}$/);
    assert.strictEqual(store.all().length, before + 1);
    assert.strictEqual(store.get(item.id).title, '测试用的一把伞');
    assert.strictEqual(item.state, 'open');
  });

  it('㉚ 非法草稿被拒绝，不会污染数据', function () {
    const before = store.all().length;
    assert.strictEqual(store.add(makeDraft({ title: '' })), null);
    assert.strictEqual(store.add(makeDraft({ contact: { type: 'phone', value: '' } })), null);
    assert.strictEqual(store.all().length, before, '失败的发布不能改到已有数据');
  });

  it('㉛ 标记完成只对本人发布的信息生效', function () {
    const mine = store.add(makeDraft(), '2026-10-07T11:00:00');
    const other = store.get(store.all().filter(i => !LF.isMine(i))[0].id);

    assert.strictEqual(store.markDone(other.id), null, '别人发的不能标记');
    const done = store.markDone(mine.id);
    assert.strictEqual(done.state, 'done');
    assert.strictEqual(store.markDone(mine.id), null, '不能重复标记');
  });

  it('㉜ 删除后查不到，且长度减一', function () {
    const target = store.all()[0];
    const before = store.all().length;
    assert.strictEqual(store.remove(target.id), true);
    assert.strictEqual(store.get(target.id), null);
    assert.strictEqual(store.all().length, before - 1);
    assert.strictEqual(store.remove('不存在的-id'), false);
  });

  it('㉝ stats 统计当前用户的发布情况', function () {
    const stats = store.stats();
    assert.strictEqual(stats.total, stats.open + stats.done);
    assert.ok(stats.total > 0, '种子数据里应当有当前用户发布的信息，否则「我的」页是空的');
  });

  it('㉞ reset 之后回到种子数据', function () {
    store.add(makeDraft({ title: '临时一条' }), '2026-10-07T11:00:00');
    const afterAdd = store.all().length;

    store.reset('2026-10-07T10:00:00');
    assert.ok(store.all().length < afterAdd);
    assert.strictEqual(store.all().some(i => i.title === '临时一条'), false);
  });
});
