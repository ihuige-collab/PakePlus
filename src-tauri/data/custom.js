window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});/**
 * PakePlus 自定义注入脚本 — 隐藏页脚元素（无闪烁版）
 * 
 * 放置路径: {应用exe同级目录}/config/inject/custom.js
 * 例如: YourApp/config/inject/custom.js
 * 
 * 工作原理:
 *   双层策略消除闪烁 ——
 *   ① CSS 预注入：初始化脚本执行时立即创建 <style> 标签，在渲染管线
 *      介入之前声明 display:none，从源头阻止 footer 被绘制。
 *   ② MutationObserver 兜底：处理 SPA 路由切换等场景下动态插入的 footer。
 * 
 * 目标元素: <footer class="border-t border-gray-200 bg-white/80 backdrop-blur-sm mt-auto">
 */

(function () {
  'use strict';

  // ============================================================
  // 配置区 — 根据实际页脚元素调整选择器
  // ============================================================

  // 精确 class 匹配（CSS 版本，/ 需转义为 \/）
  var FOOTER_SELECTOR_CSS = 'footer.border-t.border-gray-200.bg-white\\/80.backdrop-blur-sm.mt-auto';

  // JS querySelector 版本（与 CSS 版本保持一致的语义，写法不同）
  var FOOTER_SELECTOR_JS = 'footer.border-t.border-gray-200.bg-white\\/80.backdrop-blur-sm.mt-auto';

  // 隐藏方式: "display" | "remove" | "visibility"
  //   - "display":    display: none（CSS 预注入 = 零闪烁，推荐）
  //   - "remove":     从 DOM 移除（CSS 无法移除，会退化为 MutationObserver）
  //   - "visibility": visibility: hidden（CSS 预注入 = 零闪烁，但占空间）
  var HIDE_MODE = 'display';

  // 是否启用调试日志（打包发布时建议设为 false）
  var DEBUG = false;

  function log() {
    if (DEBUG && console && console.log) {
      console.log.apply(console, ['[PakePlus-FooterHide]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================================
  // 第一层：CSS 预注入 — 在渲染管线前阻止元素绘制（消除闪烁的核心）
  // ============================================================

  function injectStyleSheet() {
    var style = document.createElement('style');
    style.setAttribute('data-pakeplus-footer-hide', '');

    var cssRule;
    switch (HIDE_MODE) {
      case 'visibility':
        cssRule = FOOTER_SELECTOR_CSS + ' { visibility: hidden !important; }';
        break;
      case 'remove':
        // CSS 无法做 DOM 移除，退化为 display:none 的 CSS 预隐藏，
        // 真正的 remove 交给 MutationObserver 执行
        cssRule = FOOTER_SELECTOR_CSS + ' { display: none !important; }';
        break;
      case 'display':
      default:
        cssRule = FOOTER_SELECTOR_CSS + ' { display: none !important; }';
        break;
    }

    style.textContent = cssRule;

    // 此时 document.head 可能尚未构建完成，直接挂到 documentElement (<html>) 上
    // 浏览器会将 <style> 作为 HTML 文档的子节点处理，样式规则同样生效
    if (document.documentElement) {
      document.documentElement.appendChild(style);
      log('CSS style injected to documentElement (pre-render block)');
    } else {
      // 极端兜底：documentElement 都不存在（理论上不会发生）
      // 轮询等待后注入
      log('documentElement not ready, polling...');
      var poll = setInterval(function () {
        if (document.documentElement) {
          document.documentElement.appendChild(style);
          log('CSS style injected to documentElement (delayed)');
          clearInterval(poll);
        }
      }, 1);
    }
  }

  // ============================================================
  // 第二层：MutationObserver 兜底 — 处理 SPA 路由切换后的动态元素
  // ============================================================

  function hideElement(el) {
    if (!el) return;
    switch (HIDE_MODE) {
      case 'remove':
        if (el.parentNode) {
          el.parentNode.removeChild(el);
          log('Footer element removed from DOM');
        }
        break;
      case 'visibility':
        el.style.setProperty('visibility', 'hidden', 'important');
        log('Footer element visibility set to hidden');
        break;
      case 'display':
      default:
        // CSS 层已经处理了，这里作为二次保障
        el.style.setProperty('display', 'none', 'important');
        break;
    }
  }

  function checkAndHide() {
    var footer = document.querySelector(FOOTER_SELECTOR_JS);
    if (footer) {
      hideElement(footer);
      return true;
    }
    return false;
  }

  function startObserver() {
    // 先尝试立即查找
    if (checkAndHide()) {
      log('Footer found and hidden immediately');
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;
        for (var j = 0; j < addedNodes.length; j++) {
          var node = addedNodes[j];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // 情况1: 新增节点本身就是目标
          if (node.matches && node.matches(FOOTER_SELECTOR_JS)) {
            hideElement(node);
            log('Footer detected and hidden (direct match)');
            return;
          }
          // 情况2: 新增节点的后代中包含目标
          if (node.querySelectorAll) {
            var nestedFooter = node.querySelector(FOOTER_SELECTOR_JS);
            if (nestedFooter) {
              hideElement(nestedFooter);
              log('Footer detected and hidden (nested match)');
              return;
            }
          }
        }
      }
    });

    function attachObserver() {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        log('MutationObserver attached to document.body');
      } else {
        setTimeout(attachObserver, 10);
      }
    }
    attachObserver();

    // 5 秒兜底
    setTimeout(function () {
      if (checkAndHide()) {
        log('Footer found on delayed retry');
      } else {
        log('Footer not found after 5s — page may not have this element');
      }
    }, 5000);
  }

  // ============================================================
  // 入口
  // ============================================================

  // 第一层：CSS 预注入（必须在所有其他逻辑之前执行）
  injectStyleSheet();

  // 第二层：MutationObserver 兜底
  startObserver();
})();
