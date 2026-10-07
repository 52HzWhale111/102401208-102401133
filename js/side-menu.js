/* ============================================================================
 * 拾光校园 · 侧滑菜单（原型画板 14）
 * ----------------------------------------------------------------------------
 * 每个品牌顶栏右上角都有个「☰ 菜单」按钮，layout.js 把它挂成了
 * data-action="menu"，但只在 onAction() 里 console.info 了一句，
 * 并且特意写成「页面里有 #sideMenu 就不再提示」——留给人接手的钩子。
 * 这个文件就是接上去的那只手。
 *
 * 用法：在页面里加一行
 *   <script src="js/side-menu.js"></script>
 * 放在 js/layout.js 之后（吐司要借 LF.layout.toast）。
 * 不需要在 HTML 里写任何容器，DOM 由这个文件自己注入。
 *
 * ⚠️ 为什么样式也从 JS 里注入，而不是写进 shared/app.css？
 *    因为按分工约定，shared/ 是队友的文件、不许改；抽屉又要在好几个页面里
 *    长得一模一样，复制到每页的 <style> 里就得维护 N 份。
 *    所以退而求其次，让它自包含：DOM 和样式一起注入，用哪个页面哪页就有一份。
 *    将来如果有机会收进 shared/app.css 和 js/layout.js，把这个文件删掉即可。
 *
 * ⚠️ 注意不要照抄交接文档 6.5 的示例：
 *      <div class="sheet-mask" data-action="close-sheet">
 *    layout.js 里 data-action="close-sheet" 被写死成关 #postChoice 那个弹层
 *   （closeSheet() 里只认 getElementById('postChoice')），
 *    套在抽屉上会「点遮罩没反应」。所以这里用自己的 data-sm 标记。
 * ========================================================================== */
(function (root) {
  'use strict';

  var LF = root.LF = root.LF || {};
  if (typeof document === 'undefined') return;

  /* 页面自己已经放了 #sideMenu 就撒手，别注入第二份 */
  if (document.getElementById('sideMenu')) return;

  /* 导航项。href 为空的还没有对应的页面，点了给个提示 */
  var NAV = [
    { icon: '🏠', label: '首页',     href: 'index.html' },
    { icon: '🔍', label: '搜索',     href: 'search.html' },
    { icon: '🗒️', label: '我的发布', href: 'mine.html' },
    { icon: '📖', label: '使用说明' },
    { icon: '❓', label: '帮助与反馈' },
    { icon: '⚙️', label: '设置' }
  ];

  var STYLE = ''
    /* 整个抽屉层跟 .app（max-width:430px，居中）对齐，而不是铺满浏览器窗口。
       之前写的是 inset:0，在电脑上会出两个怪相：
         1. 遮罩把窗口左右两边的留白也压暗了，看着不像手机里的东西；
         2. 面板从 translateX(100%) 滑入，那 0.22 秒里它是从手机列**外面**
            横着飞进来的，在宽窗口上非常明显。
       left:50% + translateX(-50%) 是 .sheet-panel 用的同一招（见 shared/app.css），
       430px 这个数也就是照着它抄的。 */
    + '.side-menu {'
    +   'position: fixed; top: 0; bottom: 0;'
    +   'left: 50%; width: 100%; max-width: 430px;'
    +   'transform: translateX(-50%);'
    +   'z-index: 80;'
    /* 滑入时面板整个在盒子右侧，裁掉它，别让它跑到手机列外面去。
       ⚠️ 这里必须用 clip 而不是 hidden：overflow:hidden 会让这个盒子变成
       滚动容器，而 open() 里会 .focus() 关闭按钮 —— 它此刻还在 translateX(100%)
       的位置（动画刚开始），浏览器为了「把聚焦元素滚进视野」就把容器滚了 251px，
       遮罩和面板跟着一起被拖偏，手机上就会看到抽屉错位。
       clip 只裁剪、不建立滚动容器，这类问题从根上没有了。
       y 轴保持 visible：面板本来就是 top:0/bottom:0，不存在纵向溢出。 */
    +   'overflow-x: clip; overflow-y: visible;'
    + '}'
    /* .side-menu 本身不是 flex 容器，但 [hidden] 还是显式补一条更保险 */
    + '.side-menu[hidden] { display: none; }'

    + '.side-mask {'
    +   'position: absolute; inset: 0;'
    +   'background: rgba(0, 0, 0, .38);'
    +   'animation: sm-fade .18s ease-out;'
    + '}'

    /* 抽屉层已经跟手机列同宽了，贴右边缘直接 right:0 就行 */
    + '.side-panel {'
    +   'position: absolute; top: 0; bottom: 0; right: 0;'
    +   'display: flex; flex-direction: column;'
    +   'width: min(280px, 78%);'
    +   'background: var(--surface);'
    +   'box-shadow: -8px 0 32px rgba(0, 0, 0, .12);'
    +   'animation: sm-in .22s ease-out;'
    + '}'

    + '@keyframes sm-fade { from { opacity: 0 } to { opacity: 1 } }'
    + '@keyframes sm-in { from { transform: translateX(100%) } to { transform: translateX(0) } }'

    + '.side-head {'
    +   'display: flex; align-items: center; justify-content: space-between;'
    +   'padding: 14px 20px;'
    + '}'
    /* 原型里那个 ✕ 是蓝灰色底的小圆，不是透明图标按钮 */
    + '.side-close {'
    +   'display: flex; align-items: center; justify-content: center;'
    +   'width: 32px; height: 32px; flex: none;'
    +   'font-size: 15px; color: #475569;'
    +   'background: #EEF2F7; border-radius: 50%;'
    +   'transition: background .15s, transform .15s;'
    + '}'
    + '.side-close:hover { background: #E2E8F0; }'
    + '.side-close:active { transform: scale(.92); }'

    + '.side-tag {'
    +   'padding: 5px 12px;'
    +   'font-size: 12px; font-weight: 600; line-height: 16px;'
    +   'color: var(--amber-800); background: var(--yellow-100);'
    +   'border-radius: 999px;'
    + '}'

    /* 原型里两条分隔线都是左右各缩进 20px，不到头 */
    + '.side-rule { border: 0; border-top: 1px solid var(--line); margin: 0 20px; }'

    + '.side-brand { padding: 22px 20px 4px; }'
    + '.side-brand-name {'
    +   'display: flex; align-items: center; gap: 8px;'
    +   'font-size: 20px; font-weight: 600;'
    + '}'
    + '.side-brand-name em { font-size: 22px; font-style: normal; line-height: 1; }'
    + '.side-brand-slogan {'
    +   'display: block; margin-top: 9px;'
    +   'font-size: 13px; font-weight: 600; color: var(--amber-800);'
    + '}'

    + '.side-nav { display: flex; flex-direction: column; padding: 14px 0 0; }'
    + '.side-item {'
    +   'display: flex; align-items: center; gap: 14px; width: 100%;'
    +   'padding: 14px 20px;'
    +   'font-size: 15px; font-weight: 500; text-align: left;'
    +   'transition: background .15s;'
    + '}'
    + '.side-item:hover  { background: var(--field); }'
    + '.side-item:active { background: var(--yellow-100); }'
    /* 定宽是为了让六个图标和文字左边缘对齐 —— emoji 实际宽度不齐 */
    + '.side-item-icon {'
    +   'flex: none; width: 24px; text-align: center;'
    +   'font-size: 18px; line-height: 24px;'
    + '}'

    /* margin-top:auto 把「小提示」顶到抽屉底部 */
    + '.side-foot { margin-top: auto; padding-bottom: 18px; }'
    + '.side-tip {'
    +   'margin: 16px 20px 0; padding: 13px 14px;'
    +   'background: var(--yellow-100);'
    +   'border: 1px solid var(--yellow-300);'
    +   'border-radius: 16px;'
    + '}'
    + '.side-tip-title {'
    +   'display: flex; align-items: center; gap: 6px;'
    +   'font-size: 14px; font-weight: 700; color: var(--amber-800);'
    + '}'
    + '.side-tip-text {'
    +   'margin: 7px 0 0;'
    +   'font-size: 12.5px; line-height: 19px; color: var(--amber-800);'
    + '}';

  function navHtml() {
    return NAV.map(function (item) {
      var icon = '<span class="side-item-icon" aria-hidden="true">' + item.icon + '</span>';
      var label = '<span>' + item.label + '</span>';

      /* 还没有对应页面的，用 <button> 而不是 <a>，
         href="#" 会污染地址栏、还会被当成能跳转的链接 */
      return item.href
        ? '<a class="side-item" href="' + item.href + '">' + icon + label + '</a>'
        : '<button class="side-item" type="button" data-soon="' + item.label + '">' + icon + label + '</button>';
    }).join('');
  }

  var HTML = ''
    + '<div class="side-mask" data-sm="close"></div>'
    + '<aside class="side-panel" role="dialog" aria-modal="true" aria-label="菜单">'
    +   '<div class="side-head">'
    +     '<button class="side-close" type="button" data-sm="close" aria-label="关闭菜单">✕</button>'
    +     '<span class="side-tag">菜单索引</span>'
    +   '</div>'
    +   '<hr class="side-rule">'
    +   '<div class="side-brand">'
    +     '<div class="side-brand-name"><em aria-hidden="true">🐕</em>拾光校园</div>'
    +     '<span class="side-brand-slogan">先找找，再发布</span>'
    +   '</div>'
    +   '<nav class="side-nav">' + navHtml() + '</nav>'
    +   '<div class="side-foot">'
    +     '<hr class="side-rule">'
    +     '<div class="side-tip">'
    +       '<div class="side-tip-title"><span aria-hidden="true">💡</span>小提示</div>'
    +       '<p class="side-tip-text">“先找找，说不定已经有人帮你捡到了！”</p>'
    +     '</div>'
    +   '</div>'
    + '</aside>';

  document.head.insertAdjacentHTML('beforeend', '<style>' + STYLE + '</style>');
  document.body.insertAdjacentHTML('beforeend', '<div class="side-menu" id="sideMenu" hidden>' + HTML + '</div>');

  var el = document.getElementById('sideMenu');
  var lastTrigger = null;        /* 从哪个「菜单」按钮点开的，关掉后焦点还给谁 */

  function open(trigger) {
    lastTrigger = trigger || null;
    el.hidden = false;
    document.body.classList.add('is-locked');    /* 公共样式，挡掉背后页面的滚动 */
    el.querySelector('.side-close').focus();
  }

  function close() {
    el.hidden = true;
    document.body.classList.remove('is-locked');
    if (lastTrigger) lastTrigger.focus();
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    /* 开：顶栏那个「☰ 菜单」。layout.js 也监听同一个点击，
       但它的 menu 分支发现 #sideMenu 存在就什么都不做，两边不打架。 */
    var trigger = target.closest('[data-action="menu"]');
    if (trigger) { open(trigger); return; }

    /* 关：✕ 和遮罩 */
    if (target.closest('[data-sm="close"]')) { close(); return; }

    /* 还没有页面的那几项 */
    var soon = target.closest('[data-soon]');
    if (soon && el.contains(soon)) {
      close();
      if (LF.layout && LF.layout.toast) {
        LF.layout.toast('「' + soon.dataset.soon + '」演示版本暂未接入');
      }
      return;
    }

    /* 点空白处（抽屉里非按钮的区域）不关，只有遮罩才关 —— 和弹层的习惯一致 */
  });

  /* layout.js 里也挂了一个 Esc，但它只管「选择发布类型」那个弹层，管不到这里 */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !el.hidden) close();
  });

  LF.sideMenu = { open: open, close: close, el: el };
})(window);
