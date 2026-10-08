/* ============================================================================
 * 拾光校园 · 页面外壳
 * ----------------------------------------------------------------------------
 * 每个页面都要有顶栏和底部 TabBar，抄 7 遍迟早抄错，所以统一在这里注入。
 *
 * 页面怎么用：
 *   <div class="app" data-shell="brand" data-tab="home">
 *     <div data-layout="header"></div>
 *     <main class="page"> ... 页面自己的内容 ... </main>
 *     <div data-layout="tabbar"></div>
 *   </div>
 *   <script src="js/core.js"></script>
 *   <script src="js/seed.js"></script>
 *   <script src="js/store.js"></script>
 *   <script src="js/layout.js"></script>
 *
 * data-shell 可选值：
 *   brand（默认）—— 首页那种「头像 + 拾光校园 + 菜单」的品牌顶栏
 *   back          —— 子页面那种「← 返回 + 标题」，标题取 data-title
 * data-tab 可选值：home / search / square / mine / none
 *   none 表示这页不显示底部 TabBar（发布页、发布成功页、信息详情页用它）
 * ========================================================================== */
(function (root) {
  'use strict';

  var LF = root.LF = root.LF || {};
  if (typeof document === 'undefined') return;   // Node 里 require 到时直接跳过

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    square: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11z"/>',
    mine: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6S18.3 16.2 19.5 20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    back: '<path d="M15 4 7 12l8 8"/>'
  };

  function svg(name, width, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (extra || 2)
         + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
         + (width ? ' style="width:' + width + 'px;height:' + width + 'px"' : '') + '>'
         + ICONS[name] + '</svg>';
  }

  var TABS = [
    { key: 'home',   label: '首页', href: 'index.html' },
    { key: 'search', label: '搜索', href: 'search.html' },
    { key: 'fab',    label: '发布', href: null },
    { key: 'square', label: '广场', href: 'square.html' },
    { key: 'mine',   label: '我的', href: 'mine.html' }
  ];

  /* --------------------------------------------------------------- 顶栏 */

  function brandHeader() {
    return ''
      + '<header class="app-header">'
      +   '<div class="brand">'
      +     '<img class="brand-avatar" src="assets/avatar.png" alt="" width="40" height="40">'
      +     '<div class="brand-text">'
      +       '<h1 class="brand-name">拾光校园</h1>'
      +       '<span class="brand-slogan">先找找，再发布</span>'
      +     '</div>'
      +   '</div>'
      +   '<button class="menu-btn" type="button" data-action="menu">'
      +     svg('menu', 14, 2) + '菜单'
      +   '</button>'
      + '</header>';
  }

  function backHeader(title) {
    return ''
      + '<header class="app-header is-slim">'
      +   '<button class="icon-btn" type="button" data-action="back" aria-label="返回">'
      +     svg('back', 18, 2.2)
      +   '</button>'
      +   '<h1 class="page-title">' + LF.escapeHtml(title || '') + '</h1>'
      +   '<span class="header-spacer" aria-hidden="true"></span>'
      + '</header>';
  }

  /* ------------------------------------------------------------- 底部栏 */

  function tabbar(active) {
    /* 中间那个「＋」是绝对定位的，绝对定位元素不参与 grid 自动排布 ——
       如果直接把它当第 3 格，后面两个标签会整体前移，"广场" 被挤到第 5 格之外看不见。
       所以这里放一个空的占位格顶住位置，按钮单独挂在 nav 末尾。 */
    var cells = TABS.map(function (tab) {
      if (tab.key === 'fab') return '<span class="tab-slot" aria-hidden="true"></span>';

      var isActive = tab.key === active;
      return '<a class="tab' + (isActive ? ' is-active' : '') + '" href="' + tab.href + '"'
           + (isActive ? ' aria-current="page"' : '') + '>'
           + svg(tab.key, 20, 2) + '<span>' + tab.label + '</span></a>';
    }).join('');

    var fab = '<button class="fab" type="button" data-action="post-choice" aria-label="发布信息">'
            + svg('plus', 24, 2.2) + '</button>';

    return '<nav class="tabbar" aria-label="主导航">' + cells + fab + '</nav>';
  }

  /* ----------------------------------------------------- 发布选择弹层 */

  function postChoiceSheet() {
    return ''
      + '<div class="sheet" id="postChoice" hidden>'
      +   '<div class="sheet-mask" data-action="close-sheet"></div>'
      +   '<div class="sheet-panel" role="dialog" aria-modal="true" aria-label="选择发布的类型">'
      +     '<div class="sheet-head">'
      +       '<h2 class="sheet-title">选择发布的类型</h2>'
      +       '<button class="icon-btn" type="button" data-action="close-sheet" aria-label="关闭">✕</button>'
      +     '</div>'
      +     '<div class="sheet-choices">'
      +       '<a class="choice is-find" href="publish.html?kind=lost">'
      +         '<span class="choice-icon" aria-hidden="true">🔍</span>'
      +         '<strong>发布寻物</strong>'
      +         '<span class="choice-desc">我丢了东西，想让大家帮忙找</span>'
      +       '</a>'
      +       '<a class="choice is-claim" href="publish.html?kind=found">'
      +         '<span class="choice-icon" aria-hidden="true">🎁</span>'
      +         '<strong>发布招领</strong>'
      +         '<span class="choice-desc">我捡到东西，想找它的主人</span>'
      +       '</a>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  /* ------------------------------------------------------------- 行为 */

  function openSheet() {
    var sheet = document.getElementById('postChoice');
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add('is-locked');
    var first = sheet.querySelector('.choice');
    if (first) first.focus();
  }

  function closeSheet() {
    var sheet = document.getElementById('postChoice');
    if (!sheet) return;
    sheet.hidden = true;
    document.body.classList.remove('is-locked');
  }

  /* --------------------------------------------------- 轻提示 + 一键复制 */

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove('is-on'); }, 1800);
  }

  /**
   * 复制文本到剪贴板。优先用 navigator.clipboard；
   * file:// 下它可能不可用（需要安全上下文），退回 execCommand 的老办法。
   */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function onAction(event) {
    var el = event.target;
    if (!el || !el.closest) return;

    // 任何带 data-copy="要复制的文本" 的元素，点一下就能复制并弹提示。
    // 这个判断要放在 data-action 之前 —— 否则只写了 data-copy 的按钮会被下面的
    // `if (!trigger) return` 挡掉。
    var copyTarget = el.closest('[data-copy]');
    if (copyTarget) {
      event.preventDefault();
      copyText(copyTarget.dataset.copy).then(function (ok) {
        showToast(ok ? '已复制' : '复制失败，请手动选择');
      });
      return;
    }

    var trigger = el.closest('[data-action]');
    if (!trigger) return;
    var action = trigger.dataset.action;

    if (action === 'post-choice') { event.preventDefault(); openSheet(); }
    else if (action === 'close-sheet') { closeSheet(); }
    else if (action === 'back') { event.preventDefault(); history.back(); }
    else if (action === 'menu') {
      // 抽屉本体在 js/side-menu.js 里（队友实现），它自己也挂了 [data-action="menu"] 的监听、
      // 并且会往页面里注入 #sideMenu —— 所以正常情况下两边都会跑到，
      // 而这里判断「已经有了 #sideMenu」就什么都不做，不打架。
      // 留着这个分支是给「某个 brand 页漏引了 side-menu.js」兜底：
      // 那时抽屉不存在，至少给一句控制台提示，别让按钮点了完全没反应。
      if (!document.getElementById('sideMenu')) {
        console.info('[拾光校园] 这一页没引 js/side-menu.js，☰ 菜单按钮点不开。');
      }
    }
  }

  /** 在页面里调用一次：填好顶栏、底部栏，挂上弹层与事件 */
  function init(options) {
    var opts = options || {};
    var app = document.querySelector('.app');
    if (!app) return;

    var shell = app.dataset.shell || 'brand';
    var activeTab = app.dataset.tab || 'none';

    var headerSlot = app.querySelector('[data-layout="header"]');
    if (headerSlot) {
      headerSlot.outerHTML = shell === 'back'
        ? backHeader(app.dataset.title || opts.title || '')
        : brandHeader();
    }

    var tabbarSlot = app.querySelector('[data-layout="tabbar"]');
    if (tabbarSlot) {
      tabbarSlot.outerHTML = activeTab === 'none' ? '' : tabbar(activeTab);
    }

    // 底部 TabBar 存在时才需要「选择发布类型」弹层
    if (activeTab !== 'none' && !document.getElementById('postChoice')) {
      app.insertAdjacentHTML('beforeend', postChoiceSheet());
    }

    if (!document.body.dataset.shellBound) {
      document.body.dataset.shellBound = '1';
      document.addEventListener('click', onAction);
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeSheet();
      });
    }
  }

  LF.layout = {
    init: init,
    openPostChoice: openSheet,
    closePostChoice: closeSheet,
    toast: showToast,
    copyText: copyText,
    brandHeader: brandHeader,
    backHeader: backHeader,
    tabbar: tabbar
  };
})(window);
