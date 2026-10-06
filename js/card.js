/* ============================================================================
 * 拾光校园 · 信息卡片渲染
 * ----------------------------------------------------------------------------
 * 首页、搜索、广场、我的四个页面都要画信息卡片，样式必须一致，
 * 所以渲染逻辑放这里统一一份。改卡片长相只改这个文件。
 *
 * 用法：
 *   var el = LF.card.render(item);                        // 单列横向卡片
 *   var el = LF.card.render(item, { variant: 'stack' });  // 双列网格卡片
 *   LF.card.renderList(container, items, { variant: 'stack' });
 *
 * 默认整张卡片可点，跳 detail.html?id=<id>；传 href:null 可以让它不可点
 * （「我的」页要自己控制点击行为时用得上）。
 * ========================================================================== */
(function (root) {
  'use strict';

  var LF = root.LF = root.LF || {};
  if (typeof document === 'undefined') return;

  /* 图片加载失败时的兜底：内联 SVG，不联网 */
  var FALLBACK_IMG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
    '<rect width="96" height="96" fill="#EEF2F7"/>' +
    '<text x="48" y="62" font-size="34" text-anchor="middle">🐾</text></svg>'
  );

  var PIN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/>'
    + '<circle cx="12" cy="10" r="2.6"/></svg>';

  /** 列表上那行时间文案：「今天 14:20 拾到」 */
  function timeLine(item) {
    var verb = item.kind === 'found' ? '拾到' : '丢失';
    var text = LF.formatTime(item.happenedAt || item.createdAt);
    return text ? text + ' ' + verb : verb;
  }

  /**
   * 生成卡片 DOM。item 为 null 或字段缺失时会用占位内容，不抛异常。
   */
  function render(item, options) {
    var opts = options || {};
    var variant = opts.variant === 'stack' ? 'stack' : 'row';

    var card = document.createElement(opts.href === null ? 'div' : 'a');
    card.className = 'item-card' + (variant === 'stack' ? ' is-stack' : '');
    card.dataset.id = item.id;
    card.dataset.kind = item.kind === 'found' ? 'found' : 'lost';

    var href = opts.href === undefined ? 'detail.html?id=' + encodeURIComponent(item.id) : opts.href;
    if (href) {
      card.setAttribute('href', href);
    } else {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
    }

    var img = (item.images && item.images[0]) || FALLBACK_IMG;

    card.innerHTML =
      '<div class="thumb">' +
        '<img src="' + LF.escapeHtml(img) + '" alt="' + LF.escapeHtml(item.title) + '" loading="lazy">' +
        (opts.badge === false ? '' :
          '<span class="badge is-' + card.dataset.kind + '">' + LF.kindLabel(item) + '</span>') +
      '</div>' +
      '<div class="item-body">' +
        '<div>' +
          '<h4 class="item-title">' + LF.escapeHtml(item.title) + '</h4>' +
          '<p class="item-place">' + PIN_ICON +
            '<span>' + LF.escapeHtml(item.place || '地点未填写') + '</span></p>' +
        '</div>' +
        '<div class="item-foot">' +
          '<span class="time">' + LF.escapeHtml(timeLine(item)) + '</span>' +
          '<span class="pill is-' + LF.toneOf(item) + '">' + LF.escapeHtml(LF.statusText(item)) + '</span>' +
        '</div>' +
      '</div>';

    var imgEl = card.querySelector('img');
    imgEl.addEventListener('error', function () { imgEl.src = FALLBACK_IMG; }, { once: true });
    /* 图片若在监听挂上之前就已失败（缓存里的 404），error 不会再触发 */
    if (imgEl.complete && imgEl.naturalWidth === 0) imgEl.src = FALLBACK_IMG;

    return card;
  }

  /** 把一组信息渲染进容器，先清空。返回实际渲染的条数。 */
  function renderList(container, items, options) {
    if (!container) return 0;
    container.textContent = '';
    (items || []).forEach(function (item) {
      container.appendChild(render(item, options));
    });
    return (items || []).length;
  }

  LF.card = {
    render: render,
    renderList: renderList,
    timeLine: timeLine,
    FALLBACK_IMG: FALLBACK_IMG
  };
})(window);
