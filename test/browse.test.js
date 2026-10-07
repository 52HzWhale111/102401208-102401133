/* ============================================================================
 * 拾光校园 · 浏览链路的结构自检
 * 覆盖 search.html / square.html / browse.html / detail.html / mine.html
 * 和 js/side-menu.js。
 * ----------------------------------------------------------------------------
 * 为什么是「读文件 + 断言结构」而不是行为测试：
 *   这五页的逻辑全写在各页自己的内联 <script> 里，Node 里没有 DOM，
 *   在 mocha 里根本挂不起来。引 jsdom 能把 html 真跑起来，但会给课设仓库
 *   拖进几十个依赖 —— 别人把仓库 clone 下来、没 npm install 就 npm test 红一片，
 *   对一份「双击 html 就能验收」的作业来说，代价比收益大。
 *   所以这里只读文本，盯的是**这几个坑会不会回来**，一条一条都对应真踩过的事故，
 *   不是为凑数写的。纯逻辑（LF.search / LF.store / LF.markDone 那些）由
 *   队友的 core.test.js 覆盖，这里不重复。
 *
 * ⚠️ 改这几个页面的时候如果这里红了，先看清楚它拦的是不是上面说的那种坑，
 *    别顺手把断言删了。
 * ========================================================================== */

'use strict';

var fs   = require('fs');
var path = require('path');
var assert = require('assert');

var ROOT = path.join(__dirname, '..');

/* 我负责的五个页面 */
var MY_PAGES = ['search.html', 'square.html', 'browse.html', 'detail.html', 'mine.html'];

/* 全站页面：顶栏接线那几条需要对整个站成立，不只我这五页 */
var ALL_PAGES = ['index.html', 'search.html', 'square.html', 'browse.html',
                 'detail.html', 'mine.html', 'publish.html', 'publish-done.html'];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* <style> 里的内容，压掉空白 —— 后面全是往里面找选择器，不比字符位置 */
function styleOf(html) {
  var m = html.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1].replace(/\s+/g, '') : '';
}

/* 页面里所有 <script> 之前的「页内 JS」：外链脚本读不到，也不需要 */
function inlineJs(html) {
  var out = [];
  var re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  var m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join('\n');
}

/* 剥掉 JS 注释。凡是要断言「不许出现某某写法」的地方都得先过这一道 ——
   side-menu.js 的注释里为了说明「别这么写」，原样引用了 data-action="close-sheet"
   和 overflow:hidden，不剥注释的话这些警告会被当成真代码，测试反过来冤枉自己。 */
function stripComments(js) {
  return js.replace(/\/\*[\s\S]*?\*\//g, '')          /* 块注释 */
           .replace(/(^|[^:])\/\/[^\n]*/g, '$1');     /* 行注释（[^:] 是为了放过 https://） */
}

function shellOf(html) {
  var m = html.match(/data-shell="(\w+)"/);
  return m ? m[1] : null;
}

/* ---------------------------------------------------------------- 外壳 */

describe('页面外壳', function () {

  it('① 我负责的五页都引了公共样式 shared/app.css', function () {
    MY_PAGES.forEach(function (p) {
      var html = read(p);
      assert.ok(/<link[^>]+href="shared\/app\.css"/.test(html), p + ' 没引 shared/app.css');
      assert.ok(html.indexOf('shared/app.css') < html.indexOf('</head>'),
        p + ' 的 app.css 没放在 <head> 里，会闪一下没样式的内容');
    });
  });

  it('② 每个品牌顶栏的页面都引了 js/side-menu.js', function () {
    /* 品牌头的「☰ 菜单」由 layout.js 的 brandHeader() 画出来，点击只挂了一句
       console.info；真正的抽屉在 js/side-menu.js 里。哪个 brand 页漏引，
       那个按钮就是个死按钮 —— 点了完全没反应，肉眼还看不出哪里错。 */
    ALL_PAGES.forEach(function (p) {
      var html = read(p);
      if (shellOf(html) !== 'brand') return;
      assert.ok(/<script src="js\/side-menu\.js"><\/script>/.test(html),
        p + ' 是 brand 顶栏（有 ☰ 按钮）却没引 js/side-menu.js，那个按钮点了没反应');
    });
  });

  it('③ 下钻页（back 顶栏）不该引侧滑菜单', function () {
    /* backHeader() 里没有菜单按钮，引进来就是一段永远不会跑的死代码。
       detail.html 原来自己补过一行品牌头，所以那时是引着的；砍掉之后跟着删了。 */
    ALL_PAGES.forEach(function (p) {
      var html = read(p);
      if (shellOf(html) !== 'back') return;
      assert.ok(!/js\/side-menu\.js/.test(html),
        p + ' 是 back 顶栏、没有 ☰ 按钮，不该引 js/side-menu.js');
    });
  });

  it('④ 页面脚本顺序是 core → seed → store → layout → card', function () {
    /* store.js 建库时要调 LF.seed / LF.uid，layout.js 要调 LF.CURRENT_USER，
       顺序错了会直接 ReferenceError 白屏。 */
    var ORDER = ['js/core.js', 'js/seed.js', 'js/store.js', 'js/layout.js', 'js/card.js'];
    ALL_PAGES.forEach(function (p) {
      var html = read(p);
      var at = ORDER.map(function (f) {
        var i = html.indexOf('"' + f + '"');
        assert.ok(i > -1, p + ' 没引 ' + f);
        return i;
      });
      for (var i = 1; i < at.length; i++) {
        assert.ok(at[i] > at[i - 1],
          p + ' 的脚本顺序错了：' + ORDER[i - 1] + ' 必须排在 ' + ORDER[i] + ' 前面');
      }
    });
  });

  it('⑤ 详情页顶栏只有一行，不再自己补品牌头', function () {
    /* 原型画板 05 的顶栏是两行，一度照做了。后来去掉品牌头：
       这一页都是从首页/广场/搜索点进来的，顶上再顶一条「拾光校园 / ☰ 菜单」
       既和来路重复，又白占 71px。别再补回来。 */
    var html = read('detail.html');
    assert.ok(!/brandHeader\s*\(/.test(inlineJs(html)),
      'detail.html 又在调 LF.layout.brandHeader() 了，顶栏会变回两行');
  });
});

/* ------------------------------------------------------- [hidden] 兜底 */

/* 找出这一页里「会被藏起来、而且藏起来要靠 display:none」的元素。
   两条来源都要扫：
     1. 标记里直接写了 hidden 属性的；
     2. 页内 JS 里给 `.hidden = ` 赋过值的（这些才是大多数）。
   JS 那条要先把 `var elBar = document.getElementById('resultBar')`
   这种赋值翻成 id，才能回头去 <style> 里找它的选择器。 */
function hideTargets(html) {
  var js = inlineJs(html);

  var byId = {};                       /* 变量名 → id */
  var reVar = /var\s+(\w+)\s*=\s*document\.getElementById\('([^']+)'\)/g;
  var m;
  while ((m = reVar.exec(js))) byId[m[1]] = m[2];

  var ids = {};
  var add = function (id) { if (id) ids[id] = true; };

  /* 来源 1：标记里的 hidden 属性（注意别把 aria-hidden 当成 hidden） */
  var reTag = /<(\w+)([^>]*)>/g;
  while ((m = reTag.exec(html))) {
    var attrs = m[2];
    if (!/(^|\s)hidden(\s|=|$)/.test(attrs)) continue;
    var id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    add(id);
  }

  /* 来源 2：JS 里的 `.hidden = xxx` */
  var reSet = /(?:(\w+)|document\.getElementById\('([^']+)'\))\.hidden\s*=/g;
  while ((m = reSet.exec(js))) add(m[1] ? byId[m[1]] : m[2]);

  return Object.keys(ids);
}

/* 某个 id 在 <style> 里被设成 flex / grid 了吗 */
function displayIsFlexy(html, id) {
  var css = styleOf(html);
  var tag = html.match(new RegExp('<\\w+[^>]*\\bid="' + id + '"[^>]*>'));
  var classes = tag ? (tag[0].match(/\bclass="([^"]+)"/) || [])[1] : null;
  var sels = ['#' + id].concat(classes ? classes.split(/\s+/).map(function (c) { return '.' + c; }) : []);

  return sels.filter(function (s) {
    var rule = css.match(new RegExp(s.replace(/[.#]/g, '\\$&') + '\\{([^}]*)\\}'));
    return rule && /display:(inline-)?(flex|grid)/.test(rule[1].replace(/\s+/g, ''));
  });
}

describe('[hidden] 兜底', function () {

  it('⑥ 会被藏起来的 flex/grid 元素，各自都补了 [hidden] { display: none }', function () {
    /* 浏览器默认样式里是 [hidden] { display: none }，但作者写的 display:flex
       优先级更高，会把它盖掉 —— 元素明明设了 hidden 还是杵在那儿。
       search.html 输入框右边那个 ✕（.search-clear 是 display:flex）就栽在这上面：
       输入框空着的时候它也一直显示。凡是 display 不是默认值的、又会被藏的元素，
       页面都得自己补一条。 */
    ALL_PAGES.forEach(function (p) {
      var html = read(p);
      var css = styleOf(html);

      hideTargets(html).forEach(function (id) {
        var flexy = displayIsFlexy(html, id);
        if (!flexy.length) return;      /* display 是默认值，浏览器自己会藏，不用管 */

        var ok = flexy.some(function (s) {
          return css.indexOf(s + '[hidden]') > -1;
        });
        assert.ok(ok, p + ' 的 #' + id + '（' + flexy.join(' / ')
          + ' 是 flex/grid）缺 [hidden] 兜底，设了 hidden 也藏不住');
      });
    });
  });
});

/* ----------------------------------------------------------- 搜索页 */

describe('搜索页 · 空状态（原型画板 13）', function () {

  it('⑦ 空状态给的是「重新搜索」+「发布寻物」两颗按钮', function () {
    var html = read('search.html');
    var block = html.slice(html.indexOf('id="empty"'), html.indexOf('</main>'));

    assert.ok(/id="emptyReset"/.test(block), '空状态少了「重新搜索」');
    assert.ok(/href="publish\.html\?kind=lost"/.test(block),
      '空状态少了指向 publish.html?kind=lost 的「发布寻物」');
  });

  it('⑧ 点「重新搜索」会把焦点送回输入框', function () {
    /* resetFilters() 会把 #empty 整个藏起来，而那颗按钮就在 #empty 里面。
       不显式转移焦点的话，焦点会留在一个 display:none 的元素上 ——
       接下来按 Tab 会从看不见的地方继续数。mine.html 的确认框踩过同一个坑。 */
    var js = inlineJs(read('search.html'));
    var m = js.match(/getElementById\('emptyReset'\)[\s\S]{0,400}?\}/);
    assert.ok(m, '找不到 emptyReset 的点击处理');
    assert.ok(/elQ\.focus\(\)/.test(m[0]),
      'emptyReset 的处理里没有 elQ.focus()，焦点会卡在藏起来的按钮上');
  });
});

/* ----------------------------------------------------------- 详情页 */

describe('详情页', function () {

  it('⑨ id 认不出来时走空状态、认得出时才渲染正文', function () {
    var html = read('detail.html');
    var js   = inlineJs(html);

    assert.ok(/getElementById\('notFound'\)\.hidden\s*=\s*false/.test(js),
      'detail.html 少了「找不到这条信息」的分支，脏 id 会让页面白屏');
    assert.ok(/if\s*\(\s*!item\s*\)/.test(js), 'notFound 分支没有拿 item 做守卫');
    assert.ok(/id="notFound"[\s\S]{0,80}hidden/.test(html),
      '#notFound 初始必须是 hidden，否则正常打开详情页也会闪一下空状态');
  });
});

/* ------------------------------------------------------------- 我的页 */

describe('我的页', function () {

  it('⑩ 「我的发布记录」和空状态互斥', function () {
    var js = inlineJs(read('mine.html'));
    assert.ok(/elRecordCard\.hidden\s*=\s*!hasAny/.test(js), '记录卡没跟着条数收起来');
    assert.ok(/elEmpty\.hidden\s*=\s*hasAny/.test(js), '空状态没跟着条数收起来');
  });

  it('⑪ 标记完成用自绘弹层，不再用原生 confirm()', function () {
    /* 原生 confirm() 在小程序风格的界面上很出戏，而且取消后下拉框不会自己拨回去。
       已经换成 #confirmModal，别再退回去。 */
    var js = inlineJs(read('mine.html'));
    assert.ok(!/(^|[^-\w])confirm\s*\(/.test(js),
      'mine.html 又用回原生 confirm() 了');
    assert.ok(/id="confirmModal"/.test(read('mine.html')), '自绘确认框不见了');
  });

  it('⑫ 「恢复演示数据」用红色危险样式，和普通操作分开', function () {
    /* 这一页唯一一个「会丢东西」的动作：新发的、标记过的全没了。
       得和「标记完成」在视觉上分得开。 */
    var js = inlineJs(read('mine.html'));
    assert.ok(/danger:\s*true/.test(js), '重置数据的确认框没标 danger');
    var css = styleOf(read('mine.html'));
    assert.ok(/is-danger/.test(css), 'CSS 里没有 .is-danger 的红色样式');
  });
});

/* --------------------------------------------------------- 侧滑菜单 */

describe('侧滑菜单 js/side-menu.js', function () {

  it('⑬ 没照抄交接文档里那句 data-action="close-sheet"', function () {
    /* layout.js 的 closeSheet() 写死了 getElementById('postChoice')，
       这个 data-action 只认「选择发布类型」那个弹层。套在抽屉上会点了没反应 ——
       交接文档 6.5 的示例在这儿是错的，抽屉得用自己的 data-sm 标记。 */
    var js = stripComments(read('js/side-menu.js'));
    assert.ok(js.indexOf('close-sheet') === -1,
      'side-menu.js 用了 data-action="close-sheet"，那个分支只认 #postChoice，点遮罩不会有反应');
    assert.ok(/data-sm="close"/.test(js), '抽屉自己的关闭标记不见了');
  });

  it('⑭ 抽屉层用 overflow-x: clip，不能用 hidden', function () {
    /* overflow:hidden 会让这个盒子变成滚动容器，而 open() 里要 .focus() 关闭按钮 ——
       那一刻它还在 translateX(100%) 的位置，浏览器为了把聚焦元素滚进视野，
       会把整个容器滚 251px，遮罩和面板跟着一起偏。clip 只裁剪、不建立滚动容器。 */
    var js = stripComments(read('js/side-menu.js'));
    assert.ok(/overflow-x:\s*clip/.test(js), '抽屉层没用 overflow-x: clip');
    assert.ok(!/overflow(-x)?:\s*hidden/.test(js),
      '抽屉层又用回 overflow: hidden 了，.focus() 会把整个抽屉滚偏');
  });
});

/* --------------------------------------------------------- 空状态插画 */

describe('空状态插画', function () {

  it('⑮ 三处空状态用的是同一枚插画', function () {
    /* 画板 13 只画了「搜索无结果」，另外两处是照它统一过去的。
       结构必须一致，不然三页空状态会长得不一样。 */
    ['search.html', 'detail.html', 'mine.html'].forEach(function (p) {
      var html = read(p);
      assert.ok(/class="empty-art"/.test(html), p + ' 的空状态没用 .empty-art 插画');
      assert.ok(/empty-art-dog/.test(html) && /empty-art-badge/.test(html),
        p + ' 的插画缺了小狗或箱子角标');
      /* 末尾不能写成 \} —— width/height 后面还有 background、border 一堆属性，
         得允许继续跟分号 */
      assert.ok(/\.empty-art\{[^}]*width:112px;height:112px[;}]/.test(styleOf(html)),
        p + ' 的圆盘尺寸被改动了（画板 13 上是 112×112）');
    });
  });
});
