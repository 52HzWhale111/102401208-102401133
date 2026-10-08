/* ============================================================================
 * 拾光校园 · 发布 / 编辑表单
 * ----------------------------------------------------------------------------
 * 「发布寻物/招领」和「编辑我发过的信息」用的是**同一张表单**：字段一样、
 * 校验一样、联系人下拉一样。真抄两份的话，以后加一个字段就得记得改两处，
 * 迟早有一边漏掉 —— 所以整个表单（标记 + 状态 + 校验 + 草稿）都收在这里，
 * 页面只负责「拿到一份合法的草稿之后要干什么」。
 *
 * 用法：
 *   var form = LF.form.mount(document.getElementById('formHost'), {
 *     mode: 'create',                        // 'create' 发布页 | 'edit' 编辑页
 *     kind: 'lost',                          // 初始的寻物 / 招领
 *     value: { ... },                        // 编辑时把原信息填进来
 *     onSubmit: function (draft, api) { ... }  // 只有校验通过才会被调用
 *   });
 *
 * mode 决定的差别只有三处：分段控件的字（发布寻物 / 寻物）、按钮的字
 * （确认发布寻物信息 / 保存修改）、以及**要不要自动存草稿**。
 * 编辑页不存草稿：它每次都是从某一条具体信息进来的，存下来的半截内容
 * 下次会跟「这条信息的原值」打架，还会污染发布页那份 shiguang.draft.v1。
 * ========================================================================== */
(function (root) {
  'use strict';

  var LF = root.LF = root.LF || {};
  if (typeof document === 'undefined') return;    // Node 里 require 到时直接跳过

  /* 发布页原来存在这个 key 下，编辑功能上线后沿用，别改 —— 改了老用户的草稿就丢了 */
  var DRAFT_KEY = 'shiguang.draft.v1';

  /* 寻物 / 招领共用一套表单，只是文案不同 —— 原型里两个画板就是同构的 */
  var COPY = {
    lost: {
      place: '丢失地点', placeHolder: '如：二食堂二楼',
      time: '丢失时间', poster: '失主'
    },
    found: {
      place: '拾到地点', placeHolder: '如：图书馆三楼',
      time: '拾到时间', poster: '拾到者'
    }
  };

  var SEG_LABEL = {
    create: { lost: '发布寻物',          found: '发布招领' },
    edit:   { lost: '寻物',              found: '招领' }
  };
  var SUBMIT_LABEL = {
    create: { lost: '确认发布寻物信息',  found: '确认发布招领信息' },
    edit:   { lost: '保存修改',          found: '保存修改' }
  };
  var TITLE_LABEL = {
    create: { lost: '发布寻物信息',      found: '发布招领信息' },
    edit:   { lost: '编辑寻物信息',      found: '编辑招领信息' }
  };

  /* 表单自己的样式。放这儿而不是 shared/app.css，是因为这些类是随着表单一起
     生成的 —— 谁用到这个模块谁就自动有样式，不用记得再去引一份 css。
     两页共用同一段代码，也就不会出现「编辑页的表单长得跟发布页不一样」。 */
  var STYLE = ''
    + '.lf-form .publish-head { margin: 14px 0 18px; }'
    + '.lf-form .publish-head .tip { margin: 10px 0 0; font-size: 12px; color: var(--sub); }'
    + '.lf-form .publish-head .tip b { color: var(--red); }'
    + '.lf-form .contact-row { display: grid; grid-template-columns: 104px 1fr; gap: 8px; }'
    + '.lf-form .form-actions { margin-top: 26px; }'
    + '.lf-form .form-actions .btn { width: 100%; }'
    + '.lf-form .draft-note {'
    +   'display: flex; align-items: center; gap: 6px;'
    +   'margin: 0 0 14px; padding: 9px 12px;'
    +   'font-size: 12px; color: var(--amber-800);'
    +   'background: var(--yellow-100); border: 1px solid var(--yellow-300); border-radius: 12px;'
    + '}'
    /* .draft-note 是 flex，浏览器默认的 [hidden]{display:none} 优先级压不住它 */
    + '.lf-form .draft-note[hidden] { display: none; }'
    + '.lf-form .draft-note button { font-size: 12px; font-weight: 600; text-decoration: underline; }';

  /* ------------------------------------------------------------- 标记 */

  function tpl() {
    return ''
      + '<div class="lf-form">'
      +   '<div class="publish-head">'
      +     '<div class="segmented" role="group" aria-label="发布类型">'
      +       '<button class="seg" type="button" data-kind="lost"></button>'
      +       '<button class="seg" type="button" data-kind="found"></button>'
      +     '</div>'
      +     '<p class="tip">带 <b>*</b> 为必填</p>'
      +   '</div>'

      /* 上次没写完的草稿。只有发布页会亮出来，编辑页永远 hidden */
      +   '<p class="draft-note" hidden>'
      +     '<span>已恢复上次没填完的内容</span>'
      +     '<button type="button" data-action="clear-draft">清空重填</button>'
      +   '</p>'

      +   '<form novalidate>'

      +     '<div class="form-group">'
      +       '<label class="form-label" for="f-title">物品名称<span class="req">*</span></label>'
      +       '<input class="form-input" id="f-title" type="text" maxlength="40" autocomplete="off"'
      +              ' placeholder="如：黑色小罗技无线鼠标">'
      +       '<p class="form-error" id="e-title"></p>'
      +     '</div>'

      +     '<div class="form-group">'
      +       '<span class="form-label" id="l-category">物品类别<span class="req">*</span></span>'
      +       '<div class="chips" id="f-category" role="radiogroup" aria-labelledby="l-category"></div>'
      +       '<p class="form-error" id="e-category"></p>'
      +     '</div>'

      +     '<div class="form-group">'
      /* 地点 / 时间的字随寻物、招领变，所以里面的字单独包一个 <span>，
         改的时候只动它的 textContent，不去碰「选填」那个角标 */
      +       '<label class="form-label" for="f-place" id="l-place">'
      +         '<span class="lf-place-word"></span><span class="opt">选填</span></label>'
      +       '<input class="form-input" id="f-place" type="text" autocomplete="off">'
      +     '</div>'

      +     '<div class="form-group">'
      +       '<label class="form-label" for="f-time" id="l-time">'
      +         '<span class="lf-time-word"></span><span class="opt">选填</span></label>'
      +       '<input class="form-input" id="f-time" type="datetime-local">'
      +       '<p class="form-hint">不填就按现在算。</p>'
      +     '</div>'

      +     '<div class="form-group">'
      +       '<label class="form-label" for="f-desc">详细描述<span class="opt">选填</span></label>'
      +       '<textarea class="form-textarea" id="f-desc"'
      +         ' placeholder="描述特征、外观、有没有特殊标记…"></textarea>'
      +       '<div class="form-counter" id="c-desc">0 / 200</div>'
      +       '<p class="form-error" id="e-desc"></p>'
      +     '</div>'

      +     '<div class="form-group">'
      +       '<label class="form-label" for="f-contact-value">联系方式<span class="req">*</span></label>'
      +       '<div class="contact-row">'
      +         '<select class="form-select" id="f-contact-type" aria-label="联系方式类型"></select>'
      +         '<input class="form-input" id="f-contact-value" type="text" autocomplete="off"'
      +                ' placeholder="如：138-0013-8000">'
      +       '</div>'
      +       '<p class="form-hint" id="contact-hint"></p>'
      +       '<p class="form-error" id="e-contact"></p>'
      +     '</div>'

      +     '<div class="form-actions">'
      +       '<button class="btn btn-primary" type="submit" id="submitBtn"></button>'
      +     '</div>'

      +   '</form>'
      + '</div>';
  }

  /* 样式只注入一次，同页 mount 两个表单也不会重复 */
  function ensureStyle() {
    if (document.getElementById('lf-form-style')) return;
    var el = document.createElement('style');
    el.id = 'lf-form-style';
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  /* ------------------------------------------------------------- 挂载 */

  /** 在 container 里生成表单。opts 见文件头注释。 */
  function mount(container, options) {
    var opts = options || {};
    var mode = opts.mode === 'edit' ? 'edit' : 'create';
    var draftKey = mode === 'edit' ? null : (opts.draftKey || DRAFT_KEY);

    if (!container) return null;
    ensureStyle();
    container.innerHTML = tpl();

    var root      = container.querySelector('.lf-form');

    var elKind    = root.querySelector('.segmented');
    var elForm    = root.querySelector('form');
    var elTitle   = root.querySelector('#f-title');
    var elCategory= root.querySelector('#f-category');
    var elPlace   = root.querySelector('#f-place');
    var elTime    = root.querySelector('#f-time');
    var elDesc    = root.querySelector('#f-desc');
    var elCounter = root.querySelector('#c-desc');
    var elCType   = root.querySelector('#f-contact-type');
    var elCValue  = root.querySelector('#f-contact-value');
    var elSubmit  = root.querySelector('#submitBtn');
    var elNote    = root.querySelector('.draft-note');
    var elHint    = root.querySelector('#contact-hint');

    /* 各字段的错误提示元素，key 与 LF.validateDraft 返回的 errors 的 key 一一对应 */
    var ERRORS = {
      title:    root.querySelector('#e-title'),
      category: root.querySelector('#e-category'),
      desc:     root.querySelector('#e-desc'),
      contact:  root.querySelector('#e-contact')
    };

    var state = {
      kind: 'lost',
      category: '',
      contactType: 'phone'
    };

    /* ---------------------------------------------------------- 渲染 */

    function renderCategories() {
      elCategory.textContent = '';
      LF.CATEGORIES.forEach(function (cat) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (cat.id === state.category ? ' is-active' : '');
        chip.dataset.category = cat.id;
        chip.setAttribute('role', 'radio');
        chip.setAttribute('aria-checked', String(cat.id === state.category));
        chip.textContent = cat.label;
        elCategory.appendChild(chip);
      });
    }

    function renderContactTypes() {
      elCType.textContent = '';
      LF.CONTACT_TYPES.forEach(function (type) {
        var option = document.createElement('option');
        option.value = type.id;
        option.textContent = type.label;
        elCType.appendChild(option);
      });
      elCType.value = state.contactType;
      syncContactPlaceholder();
    }

    function syncContactPlaceholder() {
      var type = LF.CONTACT_TYPES.filter(function (t) { return t.id === state.contactType; })[0];
      elCValue.placeholder = type ? type.hint : '';
    }

    function applyKind() {
      var copy = COPY[state.kind];

      Array.prototype.forEach.call(elKind.querySelectorAll('.seg'), function (seg) {
        var active = seg.dataset.kind === state.kind;
        seg.textContent = SEG_LABEL[mode][seg.dataset.kind];
        seg.classList.toggle('is-active', active);
        seg.setAttribute('aria-pressed', String(active));
      });

      root.querySelector('.lf-place-word').textContent = copy.place;
      root.querySelector('.lf-time-word').textContent  = copy.time;
      elPlace.placeholder = copy.placeHolder;
      elSubmit.textContent = SUBMIT_LABEL[mode][state.kind];

      /* 联系方式的说明跟着 kind 走：寻物帖留的是失主的号，招领帖留的是拾到者的号。
         发布页原来是一句固定的「方便对方找到你」，编辑页上「对方」到底指谁
         说不清楚 —— 这里顺手写明白。 */
      elHint.textContent = '会显示在「信息详情」页，方便' + (state.kind === 'lost' ? '捡到的人' : '失主')
                         + '联系' + copy.poster + '。';

      document.title = TITLE_LABEL[mode][state.kind] + '｜拾光校园';
    }

    function renderCounter() {
      var len = elDesc.value.length;
      elCounter.textContent = len + ' / ' + LF.DESC_MAX;
      elCounter.classList.toggle('is-over', len > LF.DESC_MAX);
    }

    /* ------------------------------------------------------ 错误显示 */

    function clearErrors() {
      Object.keys(ERRORS).forEach(function (key) { ERRORS[key].textContent = ''; });
      [elTitle, elDesc, elCValue].forEach(function (el) { el.classList.remove('is-invalid'); });
    }

    function showErrors(errors) {
      clearErrors();
      Object.keys(errors).forEach(function (key) {
        if (ERRORS[key]) ERRORS[key].textContent = errors[key];
      });
      if (errors.title)   elTitle.classList.add('is-invalid');
      if (errors.desc)    elDesc.classList.add('is-invalid');
      if (errors.contact) elCValue.classList.add('is-invalid');

      // 滚到第一个出错的地方，不然用户不知道哪儿错了
      var first = errors.title ? elTitle : errors.category ? elCategory
                : errors.desc ? elDesc : errors.contact ? elCValue : null;
      if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (first && first.focus) first.focus({ preventScroll: true });
    }

    /* ------------------------------------------------------ 草稿存取 */

    function collectDraft() {
      return {
        kind: state.kind,
        title: elTitle.value,
        category: state.category,
        place: elPlace.value,
        happenedAt: elTime.value,
        desc: elDesc.value,
        contact: { type: state.contactType, value: elCValue.value }
      };
    }

    function saveDraft() {
      if (!draftKey) return;               // 编辑页不存草稿，理由见文件头
      try {
        var draft = collectDraft();
        var hasContent = draft.title || draft.place || draft.desc || draft.contact.value;
        if (hasContent) localStorage.setItem(draftKey, JSON.stringify(draft));
        else localStorage.removeItem(draftKey);
      } catch (e) { /* 存储不可用就不存，不影响填写 */ }
    }

    function loadDraft() {
      if (!draftKey) return null;
      try {
        var raw = localStorage.getItem(draftKey);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }

    function clearDraft() {
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch (e) { /* 忽略 */ } }
      elNote.hidden = true;
    }

    /* ---------------------------------------------------------- 填值 */

    /** 把一份现成的数据填进表单（编辑页的原值、或上次的草稿） */
    function fill(value) {
      var v = value || {};
      var contact = v.contact || {};

      state.kind = v.kind === 'found' ? 'found' : 'lost';
      state.category = v.category || '';

      /* 认不出的联系方式类型回落成手机 —— 数据的 type 一旦是脏值，
         select 上就没有这个 option，赋进去会变成空字符串，下拉会显示成空白 */
      var known = LF.CONTACT_TYPES.some(function (t) { return t.id === contact.type; });
      state.contactType = known ? contact.type : 'phone';

      elTitle.value  = v.title || '';
      elPlace.value  = v.place || '';
      /* 时间要走一遍转换，理由见 js/core.js 的 LF.toLocalInput 注释 */
      elTime.value   = LF.toLocalInput(v.happenedAt);
      elDesc.value   = v.desc || '';
      elCValue.value = contact.value || '';

      renderCategories();
      renderContactTypes();
      applyKind();
      renderCounter();
    }

    function restoreDraft() {
      var draft = loadDraft();
      if (!draft) return;
      fill(draft);
      elNote.hidden = false;
    }

    /* ---------------------------------------------------------- 事件 */

    elKind.addEventListener('click', function (event) {
      var seg = event.target.closest('.seg');
      if (!seg) return;
      state.kind = seg.dataset.kind;
      applyKind();
      saveDraft();
    });

    elCategory.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;
      state.category = chip.dataset.category;
      renderCategories();
      ERRORS.category.textContent = '';
      saveDraft();
    });

    elCType.addEventListener('change', function () {
      state.contactType = elCType.value;
      syncContactPlaceholder();
      saveDraft();
    });

    elDesc.addEventListener('input', function () {
      renderCounter();
      saveDraft();
    });

    [elTitle, elPlace, elTime, elCValue].forEach(function (el) {
      el.addEventListener('input', saveDraft);
    });

    /* 「清空重填」。原来挂在 document 上，现在收进容器里 —— 页面上可能不止一个表单，
       挂 document 的话点哪个按钮都会把当前这份清掉 */
    root.addEventListener('click', function (event) {
      if (!event.target.closest('[data-action="clear-draft"]')) return;
      elTitle.value = ''; elPlace.value = ''; elTime.value = '';
      elDesc.value = ''; elCValue.value = ''; state.category = '';
      renderCategories(); renderCounter(); clearErrors(); clearDraft();
      elTitle.focus();
    });

    /* 校验在这里统一做，页面只管「拿到合法草稿之后要干什么」——
       发布是 store.add，编辑是 store.update，两边都不需要再抄一遍校验 */
    elForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var draft = collectDraft();
      var result = LF.validateDraft(draft);

      if (!result.ok) { showErrors(result.errors); return; }
      clearErrors();

      if (opts.onSubmit) opts.onSubmit(draft);
    });

    /* ---------------------------------------------------------- 启动 */

    /* value（编辑时的原值）优先；没有就只看 kind（发布页从 ?kind= 带进来的初始类型） */
    fill(opts.value || { kind: opts.kind });
    if (mode === 'edit') elNote.hidden = true;     // 编辑页永远不显示「恢复草稿」
    else restoreDraft();

    return {
      el: root,
      mode: mode,
      getDraft: collectDraft,
      showErrors: showErrors,
      clearErrors: clearErrors,
      clearDraft: clearDraft,
      setKind: function (kind) {
        state.kind = kind === 'found' ? 'found' : 'lost';
        applyKind();
      }
    };
  }

  LF.form = {
    mount: mount,
    DRAFT_KEY: DRAFT_KEY
  };
})(window);
