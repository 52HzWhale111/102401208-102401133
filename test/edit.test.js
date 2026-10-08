/* ============================================================================
 * 单元测试：编辑功能（LF.canEdit / LF.applyEdit / LF.store.update）
 *           + 新增页面的结构自检
 * ----------------------------------------------------------------------------
 * 和 core.test.js 一样，纯逻辑那几条直接在 Node 里跑（core.js / store.js 都是 UMD，
 * 浏览器和 Node 走的是同一份代码）。页面那几条沿 browse.test.js 的老办法：只读文本、
 * 断言结构，盯的是「这几个坑会不会回来」。
 *
 * 编辑功能最容易错的一件事：**把 state 和 author 改掉**。
 * 编辑表单走的是和发布同一张表，顺手复用 normalizeDraft() 的话，
 * state 会被无条件写成 open —— 编辑一下描述，一条「已归还」的信息就变回「寻找失主中」了。
 * 下面 ④⑥ 两条就是钉死这件事的。
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
   ⚠️ 别用 slice(indexOf(a), indexOf(b)) 那种写法：页面里 '</script>' 和
   '交互' 这些词在前面（外链 script 标签、上一段注释）就会出现一次，
   两个下标一前一后，截出来是空的，测试就变成了永远不过 —— 或者更糟，
   把别处的代码当成这段来断言。给个长度上限最稳。 */
function after(js, needle, len) {
  const i = js.indexOf(needle);
  assert.ok(i > -1, '源码里找不到：' + needle);
  return js.slice(i, i + (len || 800));
}

function makeItem(overrides) {
  return Object.assign({
    id: 'LF-20261007-001',
    kind: 'lost',
    title: '蓝色水壶 + 线条小狗挂件',
    category: 'other',
    place: '操场看台',
    happenedAt: '2026-10-06T15:00:00.000Z',
    desc: '壶身上挂着一只有点掉漆的线条小狗玩偶。',
    images: ['assets/items/item-02.svg'],
    contact: { type: 'wechat', value: 'shiguang_2024' },
    state: 'open',
    author: LF.CURRENT_USER,
    createdAt: '2026-10-06T16:00:00.000Z',
    updatedAt: '2026-10-06T16:00:00.000Z',
    timeline: [{ state: 'open', at: '2026-10-06T16:00:00.000Z' }]
  }, overrides || {});
}

function makeDraft(overrides) {
  return Object.assign({
    kind: 'lost',
    title: '蓝色水壶（已换新挂件）',
    category: 'other',
    place: '二食堂二楼',
    happenedAt: '2026-10-06T15:00',
    desc: '改过之后的描述',
    contact: { type: 'wechat', value: 'shiguang_2024' }
  }, overrides || {});
}

/* ==========================================================================
 * 一、能不能编辑 LF.canEdit
 * ======================================================================== */

describe('LF.canEdit —— 谁可以编辑', function () {

  it('① 本人发布的能编辑，别人的不能', function () {
    assert.strictEqual(LF.canEdit(makeItem({ author: LF.CURRENT_USER })), true);
    assert.strictEqual(LF.canEdit(makeItem({ author: { name: '小金毛同学' } })), false);
  });

  it('② 已完成的信息**也**能编辑', function () {
    /* 和 canTransit 的区别就在这儿：改状态是不可逆的，改文字不是。
       「已归还」是既成事实，但描述写错了、联系方式留错了，什么时候都该让人补。 */
    assert.strictEqual(LF.canEdit(makeItem({ state: 'done' })), true);
    assert.strictEqual(LF.canTransit(makeItem({ state: 'done' })), false);
  });

  it('③ 空值不会把它撑爆', function () {
    assert.strictEqual(LF.canEdit(null), false);
    assert.strictEqual(LF.canEdit(undefined), false);
    assert.strictEqual(LF.canEdit({}), false);
  });
});

/* ==========================================================================
 * 二、改写一条信息 LF.applyEdit
 * ======================================================================== */

describe('LF.applyEdit —— 按草稿改写一条信息', function () {

  const at = '2026-10-08T10:00:00.000Z';

  it('④ 只改表单上的那几个字段，state / author / createdAt / images 原样保留', function () {
    const item = makeItem({ state: 'done' });
    const next = LF.applyEdit(item, makeDraft(), at);

    /* 改到了的 */
    assert.strictEqual(next.title, '蓝色水壶（已换新挂件）');
    assert.strictEqual(next.place, '二食堂二楼');
    assert.strictEqual(next.desc, '改过之后的描述');
    assert.strictEqual(next.updatedAt, at);

    /* 没动的 —— 这几条才是这个函数存在的理由 */
    assert.strictEqual(next.state, 'done', '编辑不能把「已完成」打回 open');
    assert.strictEqual(next.id, item.id, 'id 不能变');
    assert.strictEqual(next.createdAt, item.createdAt, '发布时间不能变');
    assert.deepStrictEqual(next.author, item.author, '发布者不能变');
    assert.deepStrictEqual(next.images, item.images, '配图不能被抹掉（表单里没有图片项）');
  });

  it('⑤ 返回的是新对象，原对象一个字段都不动', function () {
    const item = makeItem();
    const next = LF.applyEdit(item, makeDraft(), at);

    assert.notStrictEqual(next, item);
    assert.strictEqual(item.title, '蓝色水壶 + 线条小狗挂件');
    assert.strictEqual(item.place, '操场看台');
    assert.strictEqual(item.updatedAt, '2026-10-06T16:00:00.000Z');
    assert.strictEqual(item.timeline.length, 1, '原对象的时间线不能被改动');
  });

  it('⑥ timeline 追加一条 action:"edit"，记着什么时候被改过', function () {
    const item = makeItem({ state: 'done' });
    const next = LF.applyEdit(item, makeDraft(), at);

    assert.strictEqual(next.timeline.length, 2);
    assert.deepStrictEqual(next.timeline[1], { state: 'done', at: at, action: 'edit' });
  });

  it('⑦ 去掉首尾空格，kind 只认 found', function () {
    const next = LF.applyEdit(makeItem(), makeDraft({ title: '  耳机  ', kind: 'found' }), at);
    assert.strictEqual(next.title, '耳机');
    assert.strictEqual(next.kind, 'found');

    assert.strictEqual(LF.applyEdit(makeItem(), makeDraft({ kind: '乱七八糟' }), at).kind, 'lost');
  });

  it('⑧ item 为空时原样返回，不抛异常', function () {
    assert.strictEqual(LF.applyEdit(null, makeDraft(), at), null);
  });
});

/* ==========================================================================
 * 三、落库 LF.store.update
 * ======================================================================== */

describe('LF.store.update —— 保存修改', function () {

  beforeEach(function () {
    store.reset('2026-10-07T10:00:00');
  });

  /** 种子数据里挑一条当前用户发的（没有就现发一条） */
  function mineId() {
    const mine = store.all().filter(i => LF.isMine(i));
    assert.ok(mine.length > 0, '种子数据里应当有当前用户发布的信息');
    return mine[0].id;
  }

  it('⑨ 改完能查回来，条数不变（是改不是新增）', function () {
    const id = mineId();
    const before = store.all().length;

    const updated = store.update(id, makeDraft({ title: '改过的标题' }), '2026-10-07T12:00:00');

    assert.ok(updated, '合法草稿应当保存成功');
    assert.strictEqual(updated.title, '改过的标题');
    assert.strictEqual(store.get(id).title, '改过的标题');
    assert.strictEqual(store.all().length, before, '编辑不能变成新增一条');
  });

  it('⑩ 改完之后 state 还是原来的 state', function () {
    /* 种子里有一条「蓝牙耳机充电盒」是已归还的（state: done），拿它来验 */
    const done = store.all().filter(i => LF.isMine(i) && i.state === 'done')[0];
    assert.ok(done, '种子数据里应当有一条已完成的信息用来演示完成态');

    const updated = store.update(done.id, makeDraft({ title: '改过的标题' }), '2026-10-07T12:00:00');
    assert.strictEqual(updated.state, 'done', '编辑已归还的信息，不能把它打回「寻找失主中」');
  });

  it('⑪ 非法草稿被拒绝，而且不会动到已有数据', function () {
    const id = mineId();
    const before = store.get(id).title;

    assert.strictEqual(store.update(id, makeDraft({ title: '' })), null);
    assert.strictEqual(store.update(id, makeDraft({ category: '不存在的类别' })), null);
    assert.strictEqual(
      store.update(id, makeDraft({ contact: { type: 'phone', value: '' } })), null);

    assert.strictEqual(store.get(id).title, before, '失败的编辑不能改到已有数据');
  });

  it('⑫ 只能改自己发的；id 不存在返回 null', function () {
    const other = store.all().filter(i => !LF.isMine(i))[0];
    assert.ok(other, '种子数据里应当有别人发的一条');

    assert.strictEqual(store.update(other.id, makeDraft()), null, '别人发的不能改');
    assert.strictEqual(store.get(other.id).title, other.title, '被拒之后数据不能变');

    assert.strictEqual(store.update('不存在的-id', makeDraft()), null);
  });
});

/* ==========================================================================
 * 四、时间转成输入框认得的格式 LF.toLocalInput
 * ======================================================================== */

describe('LF.toLocalInput —— 时间回填输入框', function () {

  it('⑬ 带 Z 的 ISO 串转成本地时间，能被 datetime-local 接受', function () {
    /* 重点不是「转成了哪一刻」，而是**必须是这一个格式**：
       datetime-local 的值一旦格式非法，浏览器就把输入框显示成空的，
       用户一保存就把原时间抹掉了 */
    const out = LF.toLocalInput('2026-10-06T15:00:00.000Z');
    assert.match(out, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    /* 转出来的这一刻，跟原来那个 ISO 串指的是同一时刻（跟本机时区无关地成立） */
    assert.strictEqual(new Date(out).getTime(), new Date('2026-10-06T15:00:00.000Z').getTime());
  });

  it('⑭ 本来就规范的本地时间串原样返回（发布页存的就是这种）', function () {
    assert.strictEqual(LF.toLocalInput('2026-10-07T14:20'), '2026-10-07T14:20');
  });

  it('⑮ 空值和不认识的时间都给空串，不抛异常', function () {
    assert.strictEqual(LF.toLocalInput(''), '');
    assert.strictEqual(LF.toLocalInput(null), '');
    assert.strictEqual(LF.toLocalInput('不是时间'), '');
  });
});

/* ==========================================================================
 * 五、页面结构自检（读文件，盯坑）
 * ======================================================================== */

describe('编辑页 edit.html', function () {

  it('⑯ 表单交给 js/form.js，两个页面共用一份，不抄第二遍', function () {
    const html = read('edit.html');
    assert.ok(/<script src="js\/form\.js"><\/script>/.test(html), 'edit.html 没引 js/form.js');
    assert.ok(/id="formHost"/.test(html), 'edit.html 少了表单容器');

    /* 表单的标记是 form.js 生成的，页面里不该再出现一份手写的字段 ——
       一旦有人图省事把表单抄回 html，两页就会开始各改各的 */
    assert.ok(!/id="f-title"/.test(html), 'edit.html 自己抄了一份表单字段，应当只用 js/form.js 生成');
  });

  it('⑰ 地址栏的 id 认不出来时不白屏，给一句话 + 出路', function () {
    const html = read('edit.html');
    const js = after(html, '(function ()', 1200);
    assert.ok(/id="editGone"[\s\S]{0,80}hidden/.test(html),
      '#editGone 初始必须是 hidden，否则正常打开编辑页也会闪一下「改不了」');
    assert.ok(/if\s*\(\s*!item\s*\)/.test(js), '少了「找不到这条信息」的分支');
  });

  it('⑱ 不是本人发的不给编辑，而且说清楚为什么', function () {
    /* 入口本来只列本人的信息，但地址栏是能改的 ——
       这一道拦的是「给出说法」，不是兜底数据安全（数据安全在 store.update 那道） */
    const html = read('edit.html');
    assert.ok(/LF\.canEdit\(item\)/.test(html), 'edit.html 没做本人校验');
  });

  it('⑲ 保存成功后回「我的」，并带上提示标记', function () {
    const html = read('edit.html');
    assert.ok(/mine\.html\?saved=1/.test(html),
      '保存后应当回到 mine.html?saved=1，否则用户看不到「已保存」的确认');
    assert.ok(/LF\.store\.update\(/.test(html), 'edit.html 没有调用 store.update');
  });

  it('⑳ 提交按钮走的是表单自己的 submit 事件（回车能提交）', function () {
    /* 用 click 监听提交按钮的话，在输入框里按回车不会触发 —— 手机上尤其别扭。
       form.js 里必须挂的是 form 的 submit。 */
    const js = read('js/form.js');
    assert.ok(/addEventListener\('submit'/.test(js), 'js/form.js 没接表单的 submit 事件');
  });
});

describe('我的页 · 发布记录能点开、能编辑', function () {

  it('㉑ 记录整行指向详情页，不再是点不动的死行', function () {
    const js = read('mine.html');
    assert.ok(/role',\s*'link'/.test(js), '记录行没有 role="link"，读屏软件读不出它可点');
    assert.ok(/detail\.html\?id=/.test(js), '记录行没有指向 detail.html?id=');
  });

  it('㉒ 「⋯」的点击不会连带跳去详情页，下拉也不会', function () {
    /* 整行都能点开之后，行内那两颗交互控件的点击必须挡掉 ——
       不然点一下状态下拉，人就被带去详情页了 */
    const js = read('mine.html');
    const block = after(js, "elRecList.addEventListener('click'", 700);
    assert.ok(/closest\('\.me-rec-more'\)/.test(block), '行点击没有先让开「⋯」按钮');
    assert.ok(/closest\('\.me-rec-state'\)/.test(block), '行点击没有先让开状态下拉');
  });

  it('㉓ 「⋯」菜单里的「编辑」指向 edit.html?id=', function () {
    const html = read('mine.html');
    const js = after(html, "elMenuLayer.addEventListener('click'", 700);
    assert.ok(/editHref\(id\)/.test(js), '菜单里的「编辑」没有跳到 edit.html');
    assert.ok(/data-menu="edit"/.test(html), '菜单里没有「编辑」这一项');
  });

  it('㉔ 点开的反馈靠 data-kind 决定描边颜色，行上必须写着它', function () {
    /* 样式里是 .me-rec[data-kind="lost"]:active 这种写法，
       属性名对不上的话按下时只是缩一下、没有变色，很难查 */
    const html = read('mine.html');
    assert.ok(/row\.dataset\.kind\s*=/.test(html), '记录行没写 data-kind，按下时不会按类别变色');
    assert.ok(/\.me-rec\[data-kind="lost"\]:active/.test(html), 'CSS 里的按下描边不见了');
  });

  it('㉕ 菜单是从编辑页跳回来的「已保存」提示挂在这儿，不是编辑页弹的', function () {
    /* 页面一跳转，编辑页弹的吐司就跟着没了 —— 提示必须由落地页来弹 */
    const html = read('mine.html');
    assert.ok(/saved/.test(html) && /toast\(/.test(html), 'mine.html 没有接「修改已保存」的提示');
  });
});

/* ==========================================================================
 * 六、共用的进场动画
 * ======================================================================== */

describe('页面进场动画', function () {

  it('㉖ 详情页和编辑页整机滑入，且是显式开关而不是全局默认', function () {
    const css = read('shared/app.css');
    assert.ok(/\.app\.is-page-enter\s*\{/.test(css), 'app.css 里没有 .app.is-page-enter 这条');
    assert.ok(/@keyframes page-enter/.test(css), '少了 page-enter 关键帧');

    ['detail.html', 'edit.html'].forEach(function (p) {
      assert.ok(/class="app is-page-enter"/.test(read(p)), p + ' 没打开进场动画');
    });

    /* 首页是入口，第一次打开不该滑 —— 加了 is-page-enter 就说明有人图省事全局开了 */
    assert.ok(!/class="app is-page-enter"/.test(read('index.html')),
      'index.html 不该有进场动画，它是入口页');
  });

  it('㉗ 尊重「减少动态效果」的系统设置', function () {
    /* 用户开了减弱动态效果，动画和过渡都必须停 —— app.css 末尾那条兜底还在不在 */
    const css = read('shared/app.css');
    assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(css),
      'app.css 少了 prefers-reduced-motion 兜底');
    assert.ok(/animation:\s*none\s*!important/.test(css), '兜底里没有把动画关掉');
  });
});
