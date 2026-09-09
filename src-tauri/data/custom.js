window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});/**
 * PakePlus 自定义注入脚本 — 隐藏页面元素（无闪烁版）
 * 
 * 放置路径: {应用exe同级目录}/config/inject/custom.js
 * 例如: YourApp/config/inject/custom.js
 * 
 * 工作原理:
 *   多层策略 ——
 *   ① CSS 预注入：初始化脚本执行时立即创建 <style> 标签，在渲染管线
 *      介入之前声明 display:none，从源头阻止元素被绘制。
 *   ② 文本节点扫描：DOM 就绪后遍历文本节点，按关键词匹配隐藏父元素。
 *   ③ 文本替换：按选择器修改元素内文字（如"有料情报局"→"集采情报"）。
 *   ④ 内容插入：在指定锚点元素前/后插入 HTML 片段（如"返回首页"导航）。
 *   ⑤ 链接地址修改：修改匹配元素的 href 属性（如详情页「← 返回首页」指向 intelligence 落地页）。
 *   ⑥ MutationObserver 兜底：处理 SPA 路由切换、水合重渲染等动态场景，
 *      对文本替换、内容插入与链接地址修改做重建，防止被框架覆盖。
 *   ⑦ 自定义右键菜单：拦截原生 contextmenu，弹出自建精简菜单（仅保留"复制"），
 *      以规避原生菜单中"另存为/打印/发送标签页/复制链接"等无法单独隐藏的项。
 *   ⑧ URL 作用域选择器：部分规则（如某页 logo）仅在特定 pathname 下生效，
 *      通过 getActiveSelectors() 在 CSS 预注入与 JS 兜底层动态合并，避免误伤其它页面。
 */

(function () {
  'use strict';

  // ============================================================
  // 配置区
  // ============================================================

  // 一、CSS 选择器目标（精确匹配 HTML 元素，零闪烁）
  // 注意：/ 在 CSS 选择器中需反斜杠转义，JS 字符串中写为 \\/
  // 铁律：:has() 前必须带「专属基类」（如 div.xxx:has(...)），禁止裸 div / * 等通用标签直接接 :has()。
  //   缘由：:has() 的后代匹配是传递的，裸 div:has(X) 会命中 X 的所有祖先 div（含最外层页面包裹容器），
  //   导致整页被 display:none 而全白。本会话已因此整页空白 2 次，务必遵守。
  var TARGET_SELECTORS = [
    // 页脚（浅色主题）
    'footer.border-t.border-gray-200.bg-white\\/80.backdrop-blur-sm.mt-auto',
    // 页脚（带 surface 色系的变体，含公众号二维码等）
    'footer.border-t.border-surface-border.bg-surface-card\\/80.backdrop-blur-sm.mt-auto',
    // 顶部 Logo 链接
    'a.flex.items-center.gap-2[href="/"]',
    // AI助手导航链接
    'a[href="/chat"]',
    // 导出按钮（填充风格）
    'button.bg-white\\/20.hover\\:bg-white\\/30.rounded-lg.text-white',
    // 导出按钮（border 风格，text-white/70）
    'button.text-white\\/70.border.border-white\\/20',
    // 导出按钮（rounded-control 风格，text-white/60）
    'button.rounded-control.border.border-white\\/20',
    // 关闭按钮
    'button[aria-label="关闭"]',
    // 导出按钮 — 图片
    'button[aria-label="导出PNG图片"]',
    // 导出按钮 — CSV表格
    'button[aria-label="导出CSV表格"]',
    // 免责声明（按 class 隐藏）
    'div.text-ink-400',
    // 新窗口打开链接（国家基本药物目录 Dashboard）
    'a[href="/dashboards/essential-medicines-2026.html"]',
    // 数据资产状态卡片（整块隐藏）：根容器 .bg-surface-card.rounded-card.border.border-surface-border.p-6
    // 且内部含 h2 > svg.lucide-database.text-brand-700（品牌色数据库图标的「数据资产状态」标题）。
    // 用 :has() 约束特异性——该前缀类组合偏通用（多卡片共用），仅当含此独有标题图标时才命中，
    // 整块隐藏（标题/描述/指标网格/元数据块全部在内），替代此前 4 条各自偏通用的子选择器，消除误伤与漏隐藏。
    'div.bg-surface-card.rounded-card.border.border-surface-border.p-6:has(h2 svg.lucide-database.text-brand-700)',
    // 数据来源说明（卡片外兄弟节点：youliao_data_assets.db · JSON cache 前端消费层）
    'div.text-center.text-xs.text-ink-400.pb-4',
    // 分享按钮（aria-label="分享"，含分享图标 + "分享"文本）
    'button[aria-label="分享"]',
    // 制剂关联观察模块（整块隐藏）：根容器 .border.rounded-lg.overflow-hidden 且内部含 link-2 关联图标
    // 用 :has(svg.lucide-link-2) 约束特异性——同页「品种概览」「数据分析」等折叠卡虽同为 .border.rounded-lg.overflow-hidden，
    // 但内部是 lucide-database / lucide-trending-up，不含 link-2 图标，不会被误隐藏（已验证全页 link-2 仅此一处）
    // 整块隐藏 button 标题栏 + 折叠内容；之前误用通用动画类 .transition-all...max-h-[2000px] 会连坐品种概览折叠内容，本次已规避
    'div.border.rounded-lg.overflow-hidden:has(svg.lucide-link-2)',
    // 顶部品牌栏（YOULIAO + 原料情报局徽章）：内联 style flex 布局，含 lucide-activity 脉冲图标，整块隐藏
    // 该元素无 class，故用内联 style 子串 display:flex + gap:10px 配合 :has(svg.lucide-activity) 约束特异性
    // ⚠️ 推断性选择器：内联 style 序列化顺序在不同浏览器/页面可能变化导致失效或误伤，请实测；若异常提供品牌栏父容器 class 再精修
    'div[style*="display:flex"][style*="gap:10px"]:has(svg.lucide-activity)',
    // 新窗口打开链接（指向 medicare-formal-review-2026 Dashboard，target=_blank，含 external-link 图标 + "新窗口打开"文本）
    'a[href="/dashboards/medicare-formal-review-2026.html"]',
    // 页脚（内联 style footer：border-top + surface-card 背景，含版权 + 关于我们/数据说明/联系链接）
    // 无 class，用内联 style 子串 border-top:1px solid var(--surface-border) 锚定
    // ⚠️ 内联 style 序列化在个别浏览器/页面可能变化导致失效，请实测；若异常改用 footer 标签或提供父级上下文精修
    'footer[style*="border-top:1px solid var(--surface-border)"]',
    // 底部版权栏（flex flex-col md:flex-row items-center justify-center gap-4）：含版权 + 冀ICP备 + 免责声明按钮 + 协作/反馈建议链接
    // ⚠️ 基类必须锚定版权栏自身 flex 类组合，禁止裸 `div:has(...)`——:has 后代匹配会连坐最外层页面包裹 div 致整页空白（已踩坑）
    // 用 div.flex.flex-col.md:flex-row.items-center.justify-center.gap-4 约束基类（最外层容器无此 flex 组合，不会命中）
    // 再叠加 :has(a[href="https://beian.miit.gov.cn/"]) 二级约束（beian 链接全站唯一），精准整块隐藏该栏；沿用 CSS 预注入层零闪烁
    'div.flex.flex-col.md\\:flex-row.items-center.justify-center.gap-4:has(a[href="https://beian.miit.gov.cn/"])',
    // 协作链接（残留小字链接，独立于上述版权栏之外，故未被整块隐藏带走）：
    //   锚定 a[href="/collab"] + 其专属 class 链 text-xs.text-ink-300.hover:text-ink-400.transition-colors（精确非通用，避免误伤其它链接）
    //   / 在属性选择器字符串内无需转义；: 在 class 名中需 \\: 转义；沿用 CSS 预注入层零闪烁
    'a[href="/collab"].text-xs.text-ink-300.hover\\:text-ink-400.transition-colors',
    // 供需墙导航链接：a[href="/supply-wall"]，内含 lucide-package 包装图标 + 「供需墙」文本
    //   基类锚定专属路由 a[href="/supply-wall"]（非裸 div/*），叠加 :has(svg.lucide-package) 二级约束——
    //   与「数据资产状态」「制剂关联观察」同款 :has 用法，符合铁律（:has 前必带专属基类）；沿用 CSS 预注入层零闪烁
    'a[href="/supply-wall"]:has(svg.lucide-package)',
    // 专栏导航链接：a[href="/articles"]，内含 lucide-book-open 书本图标 + 「专栏」文本
    //   基类锚定专属路由 a[href="/articles"]（非裸 div/*），叠加 :has(svg.lucide-book-open) 二级约束——
    //   与「数据资产状态」「制剂关联观察」「供需墙」同款 :has 用法，符合铁律（:has 前必带专属基类）；沿用 CSS 预注入层零闪烁
    'a[href="/articles"]:has(svg.lucide-book-open)',
    // 「供需速览」区块（section）：aria-labelledby="supply-preview-title" 为全站唯一标识，直接锚定该属性即可精准命中整块
    //   无需 :has()，规避其传递性连坐风险；整块隐藏（标题栏 + 查看全部链接 + 卡片网格全部在内）；沿用 CSS 预注入层零闪烁
    'section[aria-labelledby="supply-preview-title"]',
    // 原料清单导航链接：a[href="/raw-materials"]，内含 lucide-package 包装图标 + 「原料清单」文本
    //   基类锚定专属路由 a[href="/raw-materials"]（非裸 div/*），叠加 :has(svg.lucide-package) 二级约束——
    //   与「数据资产状态」「制剂关联观察」「供需墙」「专栏」同款 :has 用法，符合铁律（:has 前必带专属基类）；沿用 CSS 预注入层零闪烁
    'a[href="/raw-materials"]:has(svg.lucide-package)'
  ];

  // 二、文本关键词目标（按文本内容匹配，隐藏其父元素）
  // 注意：精确匹配，可能产生误伤；优先级低于 CSS 选择器
  var TARGET_TEXTS = [
    '来源：youliao.info',
    '生产数据库',
    'cde_cancelled_records',
    // 数据说明段落（裸 <p> 无 class，走文本匹配）
    '企业名取',
    // 未来升级方向 标题（内联 style div，文本为其直接子节点 → 整块隐藏该 div 含 git-branch 图标）
    '未来升级方向',
    // 下一步关联说明段落（内联 style p，文本为其直接子节点 → 整块隐藏该 p）
    '下一步将关联 CDE 原料药登记'
  ];

  // 三、文本替换（修改元素内的文字内容）
  // 格式: { selector: 'CSS选择器', from: '原文本', to: '新文本' }
  var TARGET_REPLACEMENTS = [
    { selector: 'span.text-ink-600', from: '有料情报局', to: '集采情报' },
    { selector: 'h1.text-\\[28px\\].font-bold.leading-tight.text-ink-900', from: '有料情报局', to: '集采情报' },
    // "AI 综合判断" → "综合判断"
    { selector: 'p.text-sm.font-semibold.mb-2.text-ink-900', from: 'AI 综合判断', to: '综合判断' },
    // "情报局看板基于公开渠道整理..." → "集采情报基于公开渠道整理..."
    { selector: 'p.text-xs.text-ink-400', from: '情报局看板基于公开渠道整理数据，仅供研究参考，不构成投资或采购建议。', to: '集采情报基于公开渠道整理数据，仅供研究参考，不构成投资或采购建议。' }
  ];

  // 四、内容插入（在指定锚点元素前/后插入 HTML 片段）
  // 格式: { anchor: 'CSS选择器', position: 'before'|'after', marker: '唯一标记', html: '插入的HTML' }
  // marker 用于去重与 SPA 水合后重建检测；html 顶层建议为单一元素。
  var TARGET_INSERTIONS = [
    {
      anchor: 'h1.text-xl.font-bold.text-ink-900.flex.items-center.gap-2',
      position: 'before',
      marker: 'pakeplus-back-home',
      html: '<div class="max-w-7xl mx-auto px-4 sm:px-6"><nav class="py-4"><a class="text-sm text-brand-500 hover:underline" href="https://youliao.info/intelligence">← 返回首页</a></nav></div>'
    }
  ];

  // 五、链接地址修改（修改匹配元素的 href 属性，不改变可见文本）
  // 格式: { selector: 'CSS选择器', to: '新链接', text?: '仅当元素文本含此串时修改（可选约束）' }
  // 适用于：页面原生存在的「← 返回首页」导航，原 href="/"（指向站点根），需指向 intelligence 落地页
  var TARGET_HREF_CHANGES = [
    {
      // VBP 等详情页顶部「← 返回首页」导航（a.text-sm.text-brand-500.hover:underline，文本含 ← 返回首页）
      // 原 href="/" 改为 intelligence 落地页；text 约束避免误伤同名 class 的其它链接
      selector: 'a.text-sm.text-brand-500.hover\\:underline',
      to: 'https://youliao.info/intelligence',
      text: '← 返回首页'
    }
  ];

  // 六、URL 作用域选择器（仅当 location.pathname 含指定子串时才应用，其它页面不生效）
  // 格式: { path: '路径子串', selector: 'CSS选择器' }
  // 与全局 TARGET_SELECTORS 不同，此类规则按 URL 隔离，避免误伤其它页面的同类元素。
  var URL_SCOPED_SELECTORS = [
    {
      // 仅「国家基本药物目录 2026 版」页面隐藏其 logo，其它页面（含主站 logo / 其它 Dashboard logo）保留
      path: '/dashboards/essential-medicines-2026',
      selector: 'div.logo:has(span.logoMark)'
    }
  ];

  // 隐藏方式: "display" | "remove" | "visibility"
  var HIDE_MODE = 'display';

  // 是否启用调试日志
  var DEBUG = false;

  function log() {
    if (DEBUG && console && console.log) {
      console.log.apply(console, ['[PakePlus-Hide]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================================
  // 工具函数
  // ============================================================

  // 合并全局选择器与当前 URL 匹配的 URL 作用域选择器
  function getActiveSelectors() {
    var list = TARGET_SELECTORS.slice();
    if (location && location.pathname) {
      for (var i = 0; i < URL_SCOPED_SELECTORS.length; i++) {
        var sc = URL_SCOPED_SELECTORS[i];
        if (sc.path && location.pathname.indexOf(sc.path) !== -1) {
          list.push(sc.selector);
        }
      }
    }
    return list;
  }

  function hideElement(el, reason) {
    if (!el) return;
    // 安全检查：不隐藏 body / html / 过大的容器（>10 个子元素）
    var tag = el.tagName;
    if (tag === 'BODY' || tag === 'HTML' || el === document.documentElement) return;
    if (el.children && el.children.length > 10) return;

    switch (HIDE_MODE) {
      case 'remove':
        if (el.parentNode) {
          el.parentNode.removeChild(el);
          log('Removed: ' + (reason || tag));
        }
        break;
      case 'visibility':
        el.style.setProperty('visibility', 'hidden', 'important');
        break;
      case 'display':
      default:
        el.style.setProperty('display', 'none', 'important');
        break;
    }
  }

  // ============================================================
  // 第一层：CSS 预注入
  // ============================================================

  function injectStyleSheet() {
    var style = document.createElement('style');
    style.setAttribute('data-pakeplus-hide', '');

    var activeSelectors = getActiveSelectors();
    var selectorList = activeSelectors.join(', ');
    var cssRule;

    switch (HIDE_MODE) {
      case 'visibility':
        cssRule = selectorList + ' { visibility: hidden !important; }';
        break;
      default:
        cssRule = selectorList + ' { display: none !important; }';
        break;
    }

    style.textContent = cssRule;

    if (document.documentElement) {
      document.documentElement.appendChild(style);
      log('CSS injected (' + activeSelectors.length + ' selectors)');
    } else {
      var poll = setInterval(function () {
        if (document.documentElement) {
          document.documentElement.appendChild(style);
          log('CSS injected (delayed)');
          clearInterval(poll);
        }
      }, 1);
    }
  }

  // ============================================================
  // 第二层：文本节点扫描（CSS 无法匹配文本内容，走 JS 层）
  // ============================================================

  function scanTextNodes(root) {
    if (!TARGET_TEXTS.length) return 0;
    if (!root) return 0;

    var hiddenCount = 0;
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    var textNode;
    while ((textNode = walker.nextNode())) {
      var text = textNode.nodeValue;
      if (!text || !text.trim()) continue;

      for (var i = 0; i < TARGET_TEXTS.length; i++) {
        if (text.indexOf(TARGET_TEXTS[i]) !== -1) {
          var parent = textNode.parentNode;
          if (parent && parent.nodeType === Node.ELEMENT_NODE) {
            // 避免重复隐藏
            if (parent.style.display === 'none' || parent.style.visibility === 'hidden') continue;
            hideElement(parent, 'text:"' + TARGET_TEXTS[i] + '"');
            hiddenCount++;
          }
          break;
        }
      }
    }
    return hiddenCount;
  }

  function deferredTextScan() {
    // DOM 就绪后执行首次扫描
    function scan() {
      if (document.body) {
        var count = scanTextNodes(document.body);
        if (count > 0) log('Text scan: hidden ' + count + ' element(s)');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scan);
    } else {
      scan();
    }
  }

  // ============================================================
  // 第三层：文本替换
  // ============================================================

  function performReplacements() {
    if (!TARGET_REPLACEMENTS.length) return;

    for (var i = 0; i < TARGET_REPLACEMENTS.length; i++) {
      var cfg = TARGET_REPLACEMENTS[i];
      // 遍历所有匹配元素（避免 querySelector 仅取首个导致漏改）
      var els = document.querySelectorAll(cfg.selector);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (el.textContent.indexOf(cfg.from) !== -1) {
          el.textContent = el.textContent.replace(cfg.from, cfg.to);
          log('Replaced text in "' + cfg.selector + '": ' + cfg.from + ' -> ' + cfg.to);
        }
      }
    }
  }

  function deferredTextReplace() {
    function replace() {
      if (document.body) performReplacements();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', replace);
    } else {
      replace();
    }
  }

  // ============================================================
  // 第三层补充：内容插入
  // ============================================================

  function performInsertions() {
    if (!TARGET_INSERTIONS.length) return;

    for (var i = 0; i < TARGET_INSERTIONS.length; i++) {
      var cfg = TARGET_INSERTIONS[i];

      // 已插入（按 marker 查找）则跳过，避免重复插入
      if (cfg.marker && document.querySelector('[data-pakeplus-insert="' + cfg.marker + '"]')) {
        continue;
      }

      var anchor = document.querySelector(cfg.anchor);
      if (!anchor || !anchor.parentNode) continue;

      // 将 html 解析为 DOM 片段
      var container = document.createElement('div');
      container.innerHTML = cfg.html;
      if (!container.firstChild) continue;

      // 给顶层第一个元素打去重标记
      var firstEl = container.firstChild;
      while (firstEl && firstEl.nodeType !== Node.ELEMENT_NODE) {
        firstEl = firstEl.nextSibling;
      }
      if (!firstEl) continue;
      if (cfg.marker) firstEl.setAttribute('data-pakeplus-insert', cfg.marker);

      var fragment = document.createDocumentFragment();
      while (container.firstChild) {
        fragment.appendChild(container.firstChild);
      }

      try {
        if (cfg.position === 'after') {
          anchor.parentNode.insertBefore(fragment, anchor.nextSibling);
        } else {
          anchor.parentNode.insertBefore(fragment, anchor);
        }
        log('Inserted content ' + (cfg.position || 'before') + ' "' + cfg.anchor + '"');
      } catch (e) {
        log('Insert failed: ' + e.message);
      }
    }
  }

  function deferredContentInsert() {
    function insert() {
      if (document.body) performInsertions();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insert);
    } else {
      insert();
    }
  }

  // ============================================================
  // 第三层补充：链接地址修改
  // ============================================================

  function performHrefChanges() {
    if (!TARGET_HREF_CHANGES.length) return;
    for (var i = 0; i < TARGET_HREF_CHANGES.length; i++) {
      var cfg = TARGET_HREF_CHANGES[i];
      var els = document.querySelectorAll(cfg.selector);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        // 可选文本约束：仅当元素文本含指定串时修改，避免误伤同名 class 的其它链接
        if (cfg.text && el.textContent.indexOf(cfg.text) === -1) continue;

        // 1) 改 DOM href 属性（保证视觉、右键复制、hover 提示正确）
        if (el.getAttribute('href') !== cfg.to) {
          el.setAttribute('href', cfg.to);
          log('Changed href of "' + cfg.selector + '" -> ' + cfg.to);
        }

        // 2) 关键兜底：SPA 框架（如 Next.js <Link>）点击时读取的是 React prop 而非 DOM href，
        //    仅改属性无法改变跳转目标。在捕获阶段拦截点击并强制跳转，对普通 <a> 同样兼容。
        //    用 IIFE 固化 el / target，避免 var 循环闭包捕获到最后一次迭代的值。
        if (!el._pakeplusHrefBound) {
          el._pakeplusHrefBound = true;
          (function (anchorEl, target) {
            anchorEl.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              log('Intercepted click, navigating to ' + target);
              window.location.href = target;
            }, true); // 捕获阶段：先于框架的点击处理执行
          })(el, cfg.to);
        }
      }
    }
  }

  function deferredHrefChange() {
    function change() {
      if (document.body) performHrefChanges();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', change);
    } else {
      change();
    }
  }

  // ============================================================
  // 第四层：MutationObserver
  // ============================================================

  function checkAndHideAll() {
    var sels = getActiveSelectors();
    var hiddenCount = 0;
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (el) {
        hideElement(el, sels[i]);
        hiddenCount++;
      }
    }
    return hiddenCount;
  }

  function startObserver() {
    var hidden = checkAndHideAll();
    if (hidden > 0) log('Initially hidden ' + hidden + ' element(s) via selectors');

    var observer = new MutationObserver(function (mutations) {
      // 收集新增元素，批量处理选择器匹配（URL 作用域在此动态评估）
      var sels = getActiveSelectors();
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          var node = addedNodes[j];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // 选择器匹配
          for (var k = 0; k < sels.length; k++) {
            var sel = sels[k];
            if (node.matches && node.matches(sel)) {
              hideElement(node, sel);
              continue;
            }
            if (node.querySelectorAll) {
              var nested = node.querySelector(sel);
              if (nested) hideElement(nested, sel);
            }
          }

          // 文本节点扫描（仅扫描新增的子树）
          scanTextNodes(node);
        }
      }

      // SPA 水合/重渲染后重新执行文本替换、内容插入与链接地址修改
      performReplacements();
      performInsertions();
      performHrefChanges();
    });

    function attachObserver() {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        log('MutationObserver attached');
      } else {
        setTimeout(attachObserver, 10);
      }
    }
    attachObserver();

    // 5 秒兜底
    setTimeout(function () {
      var lateHidden = checkAndHideAll();
      var lateText = scanTextNodes(document.body);
      performInsertions();
      performHrefChanges();
      if (lateHidden + lateText > 0) {
        log('Delayed retry: hidden ' + (lateHidden + lateText) + ' element(s)');
      }
    }, 5000);
  }

  // ============================================================
  // 第六层补充：自定义右键菜单（替换原生菜单，仅保留「复制」）
  // ============================================================

  function initCustomContextMenu() {
    var menu = null;

    function ensureMenu() {
      if (menu) return menu;
      if (!document.body) return null;
      menu = document.createElement('div');
      menu.id = 'pakeplus-ctx';
      menu.setAttribute('data-pakeplus-ctx', '');
      menu.style.cssText = 'position:fixed;z-index:2147483647;background:#fff;color:#111;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);padding:4px 0;font-size:13px;min-width:120px;';
      var item = document.createElement('div');
      item.textContent = '复制';
      item.style.cssText = 'padding:6px 16px;cursor:pointer;';
      item.addEventListener('click', function () {
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          navigator.clipboard.writeText(sel.toString());
        }
        hideMenu();
      });
      menu.appendChild(item);
      document.body.appendChild(menu);
      return menu;
    }

    function hideMenu() {
      if (menu) menu.style.display = 'none';
    }

    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();                 // 阻止原生菜单（含另存为/打印/发送标签页/复制链接等无法单独隐藏的项）
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) {       // 无选中文本则不弹自定义菜单
        hideMenu();
        return;
      }
      var m = ensureMenu();
      if (!m) return;
      m.style.display = 'block';
      // 防止超出视口右/下边界
      var x = e.clientX, y = e.clientY;
      var rect = m.getBoundingClientRect();
      if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
      if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
      m.style.left = x + 'px';
      m.style.top = y + 'px';
    }, true);

    // 点击别处 / 滚动 / 缩放时收起
    document.addEventListener('click', hideMenu, true);
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu);
  }

  // ============================================================
  // 入口
  // ============================================================

  injectStyleSheet();
  deferredTextScan();
  deferredTextReplace();
  deferredContentInsert();
  deferredHrefChange();
  startObserver();
  initCustomContextMenu();
})();
