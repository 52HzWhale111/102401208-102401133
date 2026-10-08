/* ============================================================================
 * 单元测试：广场页的「排序 + 时间范围」
 * ----------------------------------------------------------------------------
 * 这个功能一半在 js/core.js（筛选与排序是纯逻辑，Node 里能直接跑），
 * 一半在 square.html 的页内脚本（下拉的开关、地址栏同步）。
 * 所以这个文件也分两截：前面测逻辑，后面照 browse.test.js 的老办法读文件、断结构。
 *
 * 「时间范围」最容易写错的一处：拿哪根时间轴去比。
 * 数据里有 happenedAt（什么时候丢的）和 createdAt（什么时候发的），
 * 用户想看的是「最近丢的东西」，所以必须比 happenedAt —— ⑭ 那条钉的就是这个。
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert');

const LF = require('../js/core.js');
const store = require('../js/store.js');

const ROOT = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* 从某段代码往后截一段出来做断言。
   ⚠️ 别用 slice(indexOf(a), indexOf(b))：'</script>'、'交互' 这类词在文件前面
   可能已经出现过一次，两个下标一前一后，截出来是空的，断言就永远不过。 */
function after(js, needle, len) {
  const i = js.indexOf(needle);
  assert.ok(i > -1, '源码里找不到：' + needle);
  return js.slice(i, i + (len || 800));
}

/* 固定的「现在」。测试里所有相对时间都从它算，
   不然「近 7 天」会跟着跑测试的那一天飘，今天绿明天红。 */
const NOW = '2026-10-08T12:00:00.000Z';
const DAY = 86400000;

function daysAgoIso(n, base) {
  return new Date(new Date(base || NOW).getTime() - n * DAY).toISOString();
}

function mk(id, daysAgo, extra) {
  return Object.assign({
    id: id,
    kind: 'lost',
    title: id,
    category: 'other',
    place: '某处',
    happenedAt: daysAgoIso(daysAgo),
    createdAt: daysAgoIso(daysAgo),
    desc: '',
    images: [],
    contact: { type: 'phone', value: '138-0000-0000' },
    state: 'open',
    author: LF.CURRENT_USER
  }, extra || {});
}

/* ==========================================================================
 * 一、时间范围 LF.withinRange
 * ======================================================================== */

describe('LF.withinRange —— 只看最近多久', function () {

  it('① 近 7 天：3 天前的进来，10 天前的出去', function () {
    assert.strictEqual(LF.withinRange(mk('a', 3), '7d', NOW), true);
    assert.strictEqual(LF.withinRange(mk('b', 10), '7d', NOW), false);
  });

  it('② 边界上刚好 7 天整，算「在范围内」', function () {
    /* 边界写成 > 还是 >= 很容易随手写反。这一条把它钉死：
       恰好 7×24 小时前的那条应该留下来，否则「整整一周前丢的」会被莫名吃掉。 */
    assert.strictEqual(LF.withinRange(mk('a', 7), '7d', NOW), true);
    /* 再多一分钟就出去 */
    const justOver = new Date(new Date(NOW).getTime() - 7 * DAY - 60000).toISOString();
    assert.strictEqual(LF.withinRange(mk('a', 0, { happenedAt: justOver }), '7d', NOW), false);
  });

  it('③ 不限 / 空值 / 认不出来的档位，一律放行', function () {
    /* 认不出来的档位当「不限」而不是当「全筛掉」：宁可多显示，
       也不该因为地址栏里一个拼错的参数就把整个列表清空。 */
    const old = mk('a', 3000);
    assert.strictEqual(LF.withinRange(old, 'all', NOW), true);
    assert.strictEqual(LF.withinRange(old, '', NOW), true);
    assert.strictEqual(LF.withinRange(old, undefined, NOW), true);
    assert.strictEqual(LF.withinRange(old, '99y', NOW), true);
  });

  it('④ 四档窗口宽度对得上「7 天 / 30 天 / 半年 / 一年」', function () {
    /* 用「刚过线」和「刚没过线」两对来验，比只试一个好 ——
       半年写成 180 天还是 183 天，只有拿 181 天那条去试才看得出来。 */
    assert.strictEqual(LF.withinRange(mk('a', 29), '30d', NOW), true);
    assert.strictEqual(LF.withinRange(mk('a', 31), '30d', NOW), false);
    assert.strictEqual(LF.withinRange(mk('a', 180), '6m', NOW), true);
    assert.strictEqual(LF.withinRange(mk('a', 200), '6m', NOW), false);
    assert.strictEqual(LF.withinRange(mk('a', 360), '1y', NOW), true);
    assert.strictEqual(LF.withinRange(mk('a', 400), '1y', NOW), false);
  });

  it('⑤ 比的是「丢失时间」happenedAt，不是发布时间 createdAt', function () {
    /* 一条上个月丢的、今天才补发的信息，应该被「近 7 天」筛掉 ——
       用户问的是「最近丢的东西」，不是「最近有人发帖」。 */
    const item = mk('a', 0, { happenedAt: daysAgoIso(40), createdAt: daysAgoIso(0) });
    assert.strictEqual(LF.withinRange(item, '7d', NOW), false);
    assert.strictEqual(LF.withinRange(item, '6m', NOW), true);
  });

  it('⑥ item 为空、时间坏掉都不抛异常', function () {
    assert.strictEqual(LF.withinRange(null, '7d', NOW), false);
    assert.strictEqual(LF.withinRange(undefined, '7d', NOW), false);
    assert.strictEqual(LF.withinRange(mk('a', 0, { happenedAt: '不是时间' }), '7d', NOW), false);
  });
});

/* ==========================================================================
 * 二、排序 + 筛选 LF.search
 * ======================================================================== */

describe('LF.search —— 排序与时间范围都从 query 上走', function () {

  const items = [mk('old', 100), mk('mid', 10), mk('new', 1)];

  it('⑦ 什么都不传时，和以前一模一样（最新在前）', function () {
    /* 搜索页和引导页都调 LF.search 且不传 sort / within。
       这条是保证「加了新功能没把老页面带歪」。 */
    assert.deepStrictEqual(LF.search(items).map(i => i.id), ['new', 'mid', 'old']);
  });

  it('⑧ sort:"asc" 变成最早在前', function () {
    assert.deepStrictEqual(
      LF.search(items, { sort: 'asc' }).map(i => i.id), ['old', 'mid', 'new']);
  });

  it('⑨ sort 传了认不出来的值，退回默认的最新在前', function () {
    assert.deepStrictEqual(
      LF.search(items, { sort: '乱写' }).map(i => i.id), ['new', 'mid', 'old']);
  });

  it('⑩ within 能筛，且能和 kind 叠加', function () {
    const mixed = [
      mk('lost-new', 1, { kind: 'lost' }),
      mk('found-new', 2, { kind: 'found' }),
      mk('lost-old', 200, { kind: 'lost' })
    ];
    assert.deepStrictEqual(
      LF.search(mixed, { within: '7d', now: NOW }).map(i => i.id).sort(),
      ['found-new', 'lost-new']);
    assert.deepStrictEqual(
      LF.search(mixed, { within: '7d', kind: 'lost', now: NOW }).map(i => i.id),
      ['lost-new']);
  });

  it('⑪ 排序和筛选都不动入参', function () {
    const before = items.map(i => i.id);
    LF.search(items, { sort: 'asc', within: '7d', now: NOW });
    assert.deepStrictEqual(items.map(i => i.id), before, 'search 必须返回新数组，不能就地排');
  });
});

/* ==========================================================================
 * 三、广场页的结构（读文件，盯坑）
 * ======================================================================== */

describe('广场页 · 右上角的排序 / 时间范围下拉', function () {

  it('⑫ 有下拉按钮，而且挂上了 aria 的三个属性', function () {
    const html = read('square.html');
    assert.ok(/id="sortBtn"/.test(html), '广场页没有那个下拉按钮');
    assert.ok(/aria-haspopup="menu"/.test(html), '按钮没声明自己会弹菜单');
    assert.ok(/aria-expanded="false"/.test(html), '按钮没有 aria-expanded，读屏软件读不出展开状态');
    assert.ok(/aria-controls="sortMenu"/.test(html), '按钮没和菜单关联起来');
  });

  it('⑬ 菜单里两组、六个可选项一个不少', function () {
    const html = read('square.html');
    /* 排序两项 */
    ['desc', 'asc'].forEach(v => {
      assert.ok(new RegExp('data-sort="' + v + '"').test(html), '排序少了 data-sort="' + v + '"');
    });
    /* 时间范围五档 */
    ['all', '7d', '30d', '6m', '1y'].forEach(v => {
      assert.ok(new RegExp('data-within="' + v + '"').test(html),
        '时间范围少了 data-within="' + v + '"');
    });
    assert.ok(/<span class="sort-group-title">时间排序<\/span>/.test(html), '少了「时间排序」这一组的标题');
    assert.ok(/<span class="sort-group-title">时间范围<\/span>/.test(html), '少了「时间范围」这一组的标题');
  });

  it('⑭ 选项是 menuitemradio + aria-checked，不是普通按钮', function () {
    /* 单选语义：不写 role / aria-checked 的话，读屏软件只会念「按钮」，
       用户不知道这几个里面只能选一个、现在选中的是哪个。 */
    const html = read('square.html');
    const js = after(html, 'function applySort()', 900);
    assert.ok(/role="menuitemradio"/.test(html), '选项没写 role="menuitemradio"');
    assert.ok(/setAttribute\('aria-checked'/.test(js), '选中状态没有同步到 aria-checked');
  });

  it('⑮ 点按钮那一下不会被「点外面就关」立刻收掉', function () {
    /* 按钮和「关菜单」都挂在 document 的 click 上。
       收菜单那一段如果不放过 .sort-wrap 里的点击，按钮就会展开完立刻被关上，
       症状是「点了没反应」—— 最难查的那种。 */
    const js = after(read('square.html'), "document.addEventListener('click'", 400);
    assert.ok(/closest\('\.sort-wrap'\)/.test(js),
      '点外面的处理没有放过 .sort-wrap，按钮会被自己人关掉');
  });

  it('⑯ 时间范围把列表筛空时，计数条要留着（不然下拉也一起没了）', function () {
    /* 原来的写法是 elBar.hidden = !hasHit。加上时间筛选之后这就成了死胡同：
       筛空 -> 计数条连带下拉一起藏起来 -> 没有任何办法把范围放宽，只能退页面。 */
    const js = after(read('square.html'), 'function render()', 900);
    assert.ok(/elBar\.hidden\s*=\s*!hasHit\s*&&\s*state\.within\s*===\s*'all'/.test(js),
      'erBar 还是只要没命中就藏起来，被时间范围筛空后就出不来了');
  });

  it('⑰ 排序和时间范围都写进地址栏，认不出的值退回默认', function () {
    const html = read('square.html');
    const sync = after(html, 'function syncUrl()', 500);
    assert.ok(/push\('sort='\s*\+\s*state\.sort\)/.test(sync), 'sort 没写进地址栏');
    assert.ok(/push\('within='\s*\+\s*state\.within\)/.test(sync), 'within 没写进地址栏');

    const rd = after(html, 'function readStateFromUrl()', 500);
    assert.ok(/SORTS\.indexOf\(sort\)\s*>=\s*0/.test(rd), '读 sort 时没做合法性兜底');
    assert.ok(/WITHINS\.indexOf\(within\)\s*>=\s*0/.test(rd), '读 within 时没做合法性兜底');
  });

  it('⑱ 菜单自己带 [hidden] 兜底，不靠外面的通用规则', function () {
    const html = read('square.html');
    assert.ok(/\.sort-menu\[hidden\]\s*\{\s*display:\s*none/.test(html),
      '.sort-menu 少了 [hidden] 兜底 —— 以后给它加 display:flex 菜单就关不上了');
  });
});

/* ==========================================================================
 * 四、种子数据得撑得起这个筛选
 * ======================================================================== */

describe('种子数据的时间跨度', function () {

  it('⑲ 四档筛出来的条数依次递增，最后一档才等于全部', function () {
    /* 9 条种子原来全是「距今几小时」，四档点下去条数一模一样 ——
       功能是对的，但演示时看不出任何效果。所以 04 / 05 / 06 / 09 被故意写老了。
       这条盯着那个跨度：谁要是把它们改回「几小时前」，这里立刻红。 */
    store.reset(NOW);
    const all = store.all();
    const count = w => LF.search(all, { within: w, now: NOW }).length;

    assert.strictEqual(count('all'), all.length, '「全部时间」必须等于总条数');
    assert.ok(count('7d') < count('all'), '「仅近 7 天」和「全部时间」条数一样，筛选看不出效果');
    assert.ok(count('7d') < count('30d'), '「近 7 天」应当比「近 30 天」少');
    assert.ok(count('30d') < count('6m'), '「近 30 天」应当比「近半年」少');
    assert.ok(count('6m') < count('1y'), '「近半年」应当比「近一年」少');
    assert.ok(count('7d') > 0, '「仅近 7 天」不该是空的，那样首屏就没人了');
  });

  it('⑳ 拉老的那几条，描述里不能出现「昨天 / 两天」这种露馅的词', function () {
    /* 时间改老了，描述还写着「已经放我这儿两天了」，一眼就穿帮。
       这条是拦着以后有人再顺手把某条的 hoursAgo 调大却忘了看描述。 */
    store.reset(NOW);
    const OLD = store.all().filter(i => LF.withinRange(i, '30d', NOW) === false);
    assert.ok(OLD.length > 0, '应当有超过 30 天的种子数据');

    const LEAK = /(昨天|前天|今天|刚刚|两天|几小时|上周)/;
    OLD.forEach(i => {
      assert.ok(!LEAK.test(i.desc),
        '「' + i.title + '」已经是很久以前的记录了，描述里却还写着「'
          + (i.desc.match(LEAK) || [])[0] + '」');
    });
  });
});
