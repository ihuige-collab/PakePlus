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
 *   ⑤ MutationObserver 兜底：处理 SPA 路由切换、水合重渲染等动态场景，
 *      对文本替换与内容插入做重建，防止被框架覆盖。
 */

(function () {
  'use strict';

  // ============================================================
  // 配置区
  // ============================================================

  // 一、CSS 选择器目标（精确匹配 HTML 元素，零闪烁）
  // 注意：/ 在 CSS 选择器中需反斜杠转义，JS 字符串中写为 \\/
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
    // Logo 区域（含 youliao.info｜年份版本文字）
    'div.logo',
    // 新窗口打开链接（国家基本药物目录 Dashboard）
    'a[href="/dashboards/essential-medicines-2026.html"]',
    // 数据资产状态卡片 - 标题 h2（含 database 图标 + "数据资产状态"）
    'h2.text-sm.font-semibold.text-ink-600.mb-1.flex.items-center.gap-2',
    // 数据资产状态卡片 - 描述段落 p（本 Dashboard 来自 youliao 数据资产库…）
    'p.text-xs.text-ink-400.mb-4',
    // 数据资产状态卡片 - 指标网格 div（数据集代码 / 数据状态 / 入库行数…）
    'div.grid.grid-cols-2.md\\:grid-cols-4.gap-3',
    // 数据资产状态卡片 - 元数据块 div（数据集名称 / 描述 / 入库时间…）
    'div.mt-4.bg-surface-soft.rounded-control.p-4.text-xs.text-ink-600.space-y-1',
    // 数据来源说明（卡片外兄弟节点：youliao_data_assets.db · JSON cache 前端消费层）
    'div.text-center.text-xs.text-ink-400.pb-4',
    // 分享按钮（aria-label="分享"，含分享图标 + "分享"文本）
    'button[aria-label="分享"]',
    // 制剂关联观察模块（整块隐藏）：根容器 .border.rounded-lg.overflow-hidden 且内部含 link-2 关联图标
    // 用 :has(svg.lucide-link-2) 约束特异性——同页「品种概览」「数据分析」等折叠卡虽同为 .border.rounded-lg.overflow-hidden，
    // 但内部是 lucide-database / lucide-trending-up，不含 link-2 图标，不会被误隐藏（已验证全页 link-2 仅此一处）
    // 整块隐藏 button 标题栏 + 折叠内容；之前误用通用动画类 .transition-all...max-h-[2000px] 会连坐品种概览折叠内容，本次已规避
    'div.border.rounded-lg.overflow-hidden:has(svg.lucide-link-2)'
  ];

  // 二、文本关键词目标（按文本内容匹配，隐藏其父元素）
  // 注意：精确匹配，可能产生误伤；优先级低于 CSS 选择器
  var TARGET_TEXTS = [
    '来源：youliao.info',
    '生产数据库',
    'cde_cancelled_records',
    // 数据说明段落（裸 <p> 无 class，走文本匹配）
    '企业名取'
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

    var selectorList = TARGET_SELECTORS.join(', ');
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
      log('CSS injected (' + TARGET_SELECTORS.length + ' selectors)');
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
  // 第四层：MutationObserver
  // ============================================================

  function checkAndHideAll() {
    var hiddenCount = 0;
    for (var i = 0; i < TARGET_SELECTORS.length; i++) {
      var el = document.querySelector(TARGET_SELECTORS[i]);
      if (el) {
        hideElement(el, TARGET_SELECTORS[i]);
        hiddenCount++;
      }
    }
    return hiddenCount;
  }

  function startObserver() {
    var hidden = checkAndHideAll();
    if (hidden > 0) log('Initially hidden ' + hidden + ' element(s) via selectors');

    var observer = new MutationObserver(function (mutations) {
      // 收集新增元素，批量处理选择器匹配
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          var node = addedNodes[j];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // 选择器匹配
          for (var k = 0; k < TARGET_SELECTORS.length; k++) {
            var sel = TARGET_SELECTORS[k];
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

      // SPA 水合/重渲染后重新执行文本替换与内容插入
      performReplacements();
      performInsertions();
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
      if (lateHidden + lateText > 0) {
        log('Delayed retry: hidden ' + (lateHidden + lateText) + ' element(s)');
      }
    }, 5000);
  }

  // ============================================================
  // 入口
  // ============================================================

  injectStyleSheet();
  deferredTextScan();
  deferredTextReplace();
  deferredContentInsert();
  startObserver();
})();
