/**
 * 哆啦A梦卡牌收藏站 - 核心交互逻辑 (app.js)
 *
 * 包含：
 *   - CollectionStore：收藏状态管理（localStorage 持久化）
 *   - App：核心应用对象（数据加载/卡包浏览/收藏/搜索/进度/导入导出）
 *
 * 全局对象：window.App, window.CollectionStore
 * 依赖：window.DORAEMON_DATA (data.js), window.AppConfig (config.js)
 *
 * 作者：工程师 寇豆码（Kou）
 */

(function (global) {
  'use strict';

  /* ================================================================
   * CollectionStore — 收藏状态管理
   * ================================================================ */

  var CollectionStore = {
    /** 已拥有卡牌 ID 集合 */
    ownedIds: null,

    /**
     * 判断卡牌是否已拥有
     * @param {string} cardId - 卡牌 ID
     * @returns {boolean}
     */
    isOwned: function (cardId) {
      return this.ownedIds.has(cardId);
    },

    /**
     * 切换卡牌拥有状态（支持重复图片组联动）
     * @param {string} cardId - 卡牌 ID
     * @returns {boolean} 切换后的状态（true=已拥有）
     */
    toggle: function (cardId) {
      // 检查是否属于重复图片组
      var groupIndex = null;
      if (typeof DUPLICATE_GROUPS !== 'undefined' && DUPLICATE_GROUPS.hasOwnProperty(cardId)) {
        groupIndex = DUPLICATE_GROUPS[cardId];
      }

      if (groupIndex !== null) {
        // 收集同组所有卡牌 ID
        var groupCardIds = [];
        for (var id in DUPLICATE_GROUPS) {
          if (DUPLICATE_GROUPS.hasOwnProperty(id) && DUPLICATE_GROUPS[id] === groupIndex) {
            groupCardIds.push(id);
          }
        }
        // 根据当前卡牌状态决定标记还是取消（整组统一）
        var currentlyOwned = this.ownedIds.has(cardId);
        if (currentlyOwned) {
          this.unmarkAll(groupCardIds);
        } else {
          this.markAll(groupCardIds);
        }
        return !currentlyOwned;
      }

      // 原逻辑：单张卡牌
      var owned = this.ownedIds.has(cardId);
      if (owned) {
        this.ownedIds.delete(cardId);
      } else {
        this.ownedIds.add(cardId);
      }
      this.save();
      return !owned;
    },

    /**
     * 批量标记多张卡牌为已拥有
     * @param {Array<string>} cardIds - 卡牌 ID 数组
     */
    /**
     * 展开卡牌 ID 列表，将属于同一去重组的卡牌全部纳入
     * @param {Array<string>} cardIds - 原始卡牌 ID 数组
     * @returns {Array<string>} 展开后的卡牌 ID 数组
     */
    _expandDuplicateGroups: function (cardIds) {
      if (typeof DUPLICATE_GROUPS === 'undefined') return cardIds;
      var expanded = new Set();
      var groupIds = new Set();
      // 收集所有涉及的 groupIndex
      cardIds.forEach(function (id) {
        if (DUPLICATE_GROUPS.hasOwnProperty(id)) {
          groupIds.add(DUPLICATE_GROUPS[id]);
        }
      });
      // 展开：包括原始 ID + 同组所有 ID
      cardIds.forEach(function (id) {
        expanded.add(id);
      });
      if (groupIds.size > 0) {
        for (var id in DUPLICATE_GROUPS) {
          if (DUPLICATE_GROUPS.hasOwnProperty(id) && groupIds.has(DUPLICATE_GROUPS[id])) {
            expanded.add(id);
          }
        }
      }
      return Array.from(expanded);
    },

    markAll: function (cardIds) {
      var expanded = this._expandDuplicateGroups(cardIds);
      expanded.forEach(function (id) {
        this.ownedIds.add(id);
      }, this);
      this.save();
    },

    /**
     * 批量取消多张卡牌的拥有状态
     * @param {Array<string>} cardIds - 卡牌 ID 数组
     */
    unmarkAll: function (cardIds) {
      var expanded = this._expandDuplicateGroups(cardIds);
      expanded.forEach(function (id) {
        this.ownedIds.delete(id);
      }, this);
      this.save();
    },

    /**
     * 从 localStorage 加载收藏数据
     */
    load: function () {
      this.ownedIds = new Set();
      try {
        var raw = localStorage.getItem(AppConfig.STORAGE_KEY);
        if (raw) {
          var data = JSON.parse(raw);
          if (data && Array.isArray(data.ownedIds)) {
            data.ownedIds.forEach(function (id) {
              this.ownedIds.add(id);
            }, this);
          }
        }
      } catch (e) {
        console.warn('CollectionStore.load: 读取收藏数据失败', e);
      }
    },

    /**
     * 保存收藏数据到 localStorage
     */
    save: function () {
      try {
        var data = {
          ownedIds: Array.from(this.ownedIds),
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('CollectionStore.save: 保存收藏数据失败', e);
      }
    },

    /**
     * 统计卡包内已拥有数量
     * @param {Object} pack - 卡包对象
     * @returns {number}
     */
    getOwnedCount: function (pack) {
      if (!pack || !pack.cards) return 0;
      var count = 0;
      for (var i = 0; i < pack.cards.length; i++) {
        if (this.ownedIds.has(pack.cards[i].id)) count++;
      }
      return count;
    },

    /**
     * 统计全局已拥有总数
     * @returns {number}
     */
    getTotalOwned: function () {
      return this.ownedIds ? this.ownedIds.size : 0;
    },

    /**
     * 导出收藏数据
     * @returns {Object} {version, exportedAt, totalCards, ownedCount, ownedIds}
     */
    exportData: function () {
      var totalCards = 0;
      if (global.DORAEMON_DATA && global.DORAEMON_DATA.packs) {
        global.DORAEMON_DATA.packs.forEach(function (p) {
          totalCards += p.cardCount || (p.cards ? p.cards.length : 0);
        });
      }
      return {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        totalCards: totalCards,
        ownedCount: this.ownedIds.size,
        ownedIds: Array.from(this.ownedIds)
      };
    },

    /**
     * 导入收藏数据（合并模式 — 并集）
     * @param {Object} data - 导入的数据
     * @returns {number} 新增的收藏数量
     */
    importData: function (data) {
      var added = 0;
      if (!data || !Array.isArray(data.ownedIds)) return 0;
      data.ownedIds.forEach(function (id) {
        if (!this.ownedIds.has(id)) {
          this.ownedIds.add(id);
          added++;
        }
      }, this);
      this.save();
      return added;
    }
  };

  /* ================================================================
   * App — 核心应用对象
   * ================================================================ */

  var App = {
    /** 卡牌数据 */
    data: null,
    /** 当前选中的卡包索引 */
    currentPackIndex: 0,
    /** 搜索过滤文本 */
    searchFilter: '',
    /** 当前过滤状态：all / owned / unowned */
    currentFilter: 'all',
    /** 当前级别筛选（空字符串表示不筛选） */
    rarityFilter: '',
    /** IntersectionObserver 实例 */
    cardObserver: null,

    /**
     * 初始化应用
     */
    init: function () {
      // 数据校验
      if (!global.DORAEMON_DATA || !global.DORAEMON_DATA.packs || global.DORAEMON_DATA.packs.length === 0) {
        document.getElementById('packView').innerHTML =
          '<p class="no-result"><span class="no-result-icon">⚠️</span>数据加载失败，请确认 data.js 文件存在且格式正确。</p>';
        return;
      }
      this.data = global.DORAEMON_DATA;

      // 加载收藏数据
      CollectionStore.load();

      // 初始化 IntersectionObserver
      this.cardObserver = new IntersectionObserver(this._onCardIntersect.bind(this), {
        threshold: 0.1,
        root: document.getElementById('mainContent')
      });

      // 注入级别筛选标签的动态颜色 CSS（与下方徽章颜色一致）
      this._injectRarityFilterStyles();

      // 渲染界面
      this.renderSidebar();
      this.renderMobileTabs();
      this.updateAllProgress();
      this.selectPack(0);

      // 绑定事件
      this._bindEvents();

      console.log('哆啦A梦卡牌收藏站 v2.0 初始化完成 · 卡包 ' + this.data.meta.totalPacks +
        ' 个 · 卡牌 ' + this.data.meta.totalCards + ' 张');
    },

    /**
     * IntersectionObserver 回调：卡牌进入视口时添加 .visible 类触发入场动画
     */
    _onCardIntersect: function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          this.cardObserver.unobserve(entry.target);
        }
      }, this);
    },

    /**
     * 绑定全局事件
     */
    _bindEvents: function () {
      var self = this;

      // 搜索框
      document.getElementById('searchInput').addEventListener('input', function (e) {
        self.onSearchInput(e.target.value);
      });

      // 导出
      document.getElementById('btnExport').addEventListener('click', function () {
        self.exportOwned();
      });

      // 导入
      document.getElementById('btnImport').addEventListener('click', function () {
        self.importOwned();
      });

      // 拥有状态过滤：三个平铺按钮（全部显示 / 只看已拥有 / 只看未拥有）
      document.getElementById('btnFilterAll').addEventListener('click', function () {
        var self = global.App || window.App;
        self._applyFilter('all');
      });
      document.getElementById('btnFilterOwned').addEventListener('click', function () {
        var self = global.App || window.App;
        self._applyFilter('owned');
      });
      document.getElementById('btnFilterUnowned').addEventListener('click', function () {
        var self = global.App || window.App;
        self._applyFilter('unowned');
      });

      // 弹窗关闭（拖拽后不触发关闭）
      document.getElementById('modalOverlay').addEventListener('click', function (e) {
        if (e.target === this) {
          var carousel = global.CoverflowCarousel;
          if (carousel && carousel._justDragged) {
            carousel._justDragged = false;
            return;
          }
          if (carousel) carousel.close();
        }
      });
      document.getElementById('modalClose').addEventListener('click', function () {
        if (global.CoverflowCarousel) global.CoverflowCarousel.close();
      });

      // 全屏图片查看弹窗
      document.getElementById('lightboxOverlay').addEventListener('click', function (e) {
        if (e.target === this) {
          if (global.CoverflowCarousel) global.CoverflowCarousel.closeLightbox();
        }
      });
      document.getElementById('lightboxClose').addEventListener('click', function () {
        if (global.CoverflowCarousel) global.CoverflowCarousel.closeLightbox();
      });

      // 全局键盘事件
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var lightbox = document.getElementById('lightboxOverlay');
          if (lightbox && lightbox.classList.contains('active')) {
            if (global.CoverflowCarousel) global.CoverflowCarousel.closeLightbox();
            return;
          }
        }
      });

      // 一键返回顶部悬浮按钮（主视图滚动容器为 window）
      var btnBackTop = document.getElementById('btnBackTop');
      if (btnBackTop) {
        btnBackTop.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        var toggleBackTop = function () {
          var scrolled = window.scrollY || document.documentElement.scrollTop || 0;
          if (scrolled > 300) {
            btnBackTop.classList.add('back-to-top--visible');
          } else {
            btnBackTop.classList.remove('back-to-top--visible');
          }
        };
        window.addEventListener('scroll', toggleBackTop, { passive: true });
        toggleBackTop();
      }
    },

    /**
     * 设置拥有状态过滤，刷新视图并同步按钮高亮
     * @param {'all'|'owned'|'unowned'} filter
     */
    _applyFilter: function (filter) {
      this.currentFilter = filter;
      this._updateFilterButtons();
      this.renderPackView();
    },

    /**
     * 根据当前 currentFilter 更新三个过滤按钮（全部显示 / 只看已拥有 / 只看未拥有）的高亮状态
     */
    _updateFilterButtons: function () {
      var map = {
        all:     { id: 'btnFilterAll',     cls: 'toolbar-btn--active-all' },
        owned:   { id: 'btnFilterOwned',   cls: 'toolbar-btn--active-owned' },
        unowned: { id: 'btnFilterUnowned', cls: 'toolbar-btn--active-unowned' }
      };
      ['btnFilterAll', 'btnFilterOwned', 'btnFilterUnowned'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.classList.remove('toolbar-btn--active-all', 'toolbar-btn--active-owned', 'toolbar-btn--active-unowned');
      });
      var cur = map[this.currentFilter] || map.all;
      var activeBtn = document.getElementById(cur.id);
      if (activeBtn) activeBtn.classList.add(cur.cls);
    },

    /**
     * 渲染侧边栏卡包列表（桌面端）
     */
    renderSidebar: function () {
      var el = document.getElementById('sidebar');
      var self = this;
      var html = '';
      var currentType = '';

      this.data.packs.forEach(function (pack, i) {
        // 按类型分组
        if (pack.type !== currentType) {
          currentType = pack.type;
          html += '<div class="sidebar-group-title">' + currentType + '类</div>';
        }
        var owned = CollectionStore.getOwnedCount(pack);
        html += '<a class="pack-item" data-pack-idx="' + i + '">' +
          '<span class="pack-type-tag">' + pack.type + '</span>' +
          self._escapeHtml(pack.name) +
          '<span class="pack-count">' + owned + '/' + pack.cardCount + '</span>' +
          '</a>';
      });

      el.innerHTML = html;

      // 绑定点击事件
      el.querySelectorAll('.pack-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var idx = parseInt(this.dataset.packIdx, 10);
          self.selectPack(idx);
        });
      });
    },

    /**
     * 渲染移动端横向标签
     */
    renderMobileTabs: function () {
      var el = document.getElementById('mobileTabs');
      var html = '';
      var self = this;

      this.data.packs.forEach(function (pack, i) {
        html += '<span class="mobile-tab" data-pack-idx="' + i + '">' + pack.name + '</span>';
      });

      el.innerHTML = html;

      el.querySelectorAll('.mobile-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var idx = parseInt(this.dataset.packIdx, 10);
          self.selectPack(idx);
        });
      });
    },

    /**
     * 选中卡包
     * @param {number} idx - 卡包索引
     */
    selectPack: function (idx) {
      if (idx < 0 || idx >= this.data.packs.length) return;
      this.currentPackIndex = idx;
      this.searchFilter = '';
      // 保留 rarityFilter 与 currentFilter（拥有状态筛选），跨卡包不重置

      // 清空搜索框
      var searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';

      // 按保留下来的 currentFilter 高亮对应按钮
      this._updateFilterButtons();

      // 更新 active 状态
      document.querySelectorAll('.pack-item').forEach(function (el, i) {
        el.classList.toggle('active', i === idx);
      });
      document.querySelectorAll('.mobile-tab').forEach(function (el, i) {
        el.classList.toggle('active', i === idx);
      });

      this.renderPackView();
    },

    /**
     * 渲染当前卡包视图（按级别分组）
     */
    renderPackView: function () {
      var pack = this.data.packs[this.currentPackIndex];
      if (!pack) return;

      var view = document.getElementById('packView');
      var owned = CollectionStore.getOwnedCount(pack);
      var pct = pack.cardCount > 0 ? Math.round(owned / pack.cardCount * 100) : 0;

      // 过滤卡牌
      var filteredCards = this._filterCards(pack.cards);

      // 按级别分组
      var groups = {};
      filteredCards.forEach(function (card) {
        if (!groups[card.rarity]) groups[card.rarity] = [];
        groups[card.rarity].push(card);
      });

      // 级别按 RARITY_RANK 排序（从低到高）
      var rarityKeys = Object.keys(groups);
      var self = this;
      rarityKeys.sort(function (a, b) {
        var rankA = AppConfig.RARITY_RANK[a] !== undefined ? AppConfig.RARITY_RANK[a] : AppConfig.UNKNOWN_RANK;
        var rankB = AppConfig.RARITY_RANK[b] !== undefined ? AppConfig.RARITY_RANK[b] : AppConfig.UNKNOWN_RANK;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      });

      // 构建 HTML
      var html = '';
      html += '<div class="pack-header">' +
        '<h2>' + this._escapeHtml(pack.name) + '</h2>' +
        '<span class="pack-meta">' + pack.type + '类 · ' + pack.cardCount + ' 张卡牌</span>' +
        '</div>';
      html += '<div class="progress-wrap">' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="progress-text">' + owned + '/' + pack.cardCount + ' (' + pct + '%)</span>' +
        '</div>';

      // 级别筛选标签栏（基于完整卡包统计所有级别）
      var allRarities = {};
      pack.cards.forEach(function (card) {
        if (!allRarities[card.rarity]) allRarities[card.rarity] = 0;
        allRarities[card.rarity]++;
      });
      var allRarityKeys = Object.keys(allRarities);
      allRarityKeys.sort(function (a, b) {
        var rankA = AppConfig.RARITY_RANK[a] !== undefined ? AppConfig.RARITY_RANK[a] : AppConfig.UNKNOWN_RANK;
        var rankB = AppConfig.RARITY_RANK[b] !== undefined ? AppConfig.RARITY_RANK[b] : AppConfig.UNKNOWN_RANK;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      });
      if (allRarityKeys.length > 1) {
        html += '<div class="rarity-filter-bar">';
        html += '<span class="rarity-filter-label">级别：</span>';
        html += '<span class="rarity-filter-tag' + (self.rarityFilter === '' ? ' active' : '') + '" data-rarity="">全部</span>';
        allRarityKeys.forEach(function (r) {
          html += '<span class="rarity-filter-tag' + (self.rarityFilter === r ? ' active' : '') + '" data-rarity="' + self._escapeHtml(r) + '">' + self._escapeHtml(r) + '</span>';
        });
        html += '</div>';
      }

      if (rarityKeys.length === 0) {
        html += '<div class="no-result"><span class="no-result-icon">🔍</span>没有找到匹配的卡牌</div>';
      } else {
        rarityKeys.forEach(function (rarity) {
          var cards = groups[rarity];
          var groupOwned = CollectionStore.getOwnedCount({ cards: cards });
          // 检测该级别是否全部已拥有
          var allOwned = cards.every(function (card) {
            return CollectionStore.isOwned(card.id);
          });
          var batchBtnText = allOwned ? '一键取消' : '一键拥有';
          var batchBtnAction = allOwned ? 'unmark' : 'mark';
          var batchBtnCls = allOwned ? ' owned' : '';

          html += '<div class="rarity-group" data-rarity="' + self._escapeHtml(rarity) + '">';
          html += '<div class="rarity-group-header">' +
            '<span class="rarity-badge">' + self._escapeHtml(rarity) + '</span>' +
            '<span class="rarity-group-count">· ' + cards.length + ' 张</span>' +
            '<span class="rarity-group-progress">' + groupOwned + '/' + cards.length + '</span>' +
            '<button class="rarity-batch-btn' + batchBtnCls + '" ' +
            'data-action="' + batchBtnAction + '" ' +
            'data-rarity="' + self._escapeHtml(rarity) + '" ' +
            'title="' + (allOwned ? '取消该级别所有卡牌' : '标记该级别所有卡牌') + '">' +
            batchBtnText + '</button>' +
            '</div>';
          html += '<div class="card-grid">';
          cards.forEach(function (card) {
            html += self._renderCard(card, pack);
          });
          html += '</div></div>';
        });
      }

      view.innerHTML = html;

      // 绑定卡牌事件 + 级别筛选事件 + 批量操作事件 + IntersectionObserver
      this._bindCardEvents();
      this._bindRarityFilters();
      this._bindBatchButtons();
    },

    /**
     * 按级别筛选卡牌
     * @param {string} rarity - 级别标识，空字符串或与当前相同则取消筛选
     */
    filterByRarity: function (rarity) {
      this.rarityFilter = (this.rarityFilter === rarity) ? '' : rarity;
      this.renderPackView();
    },

    /**
     * 绑定级别筛选标签点击事件
     */
    _bindRarityFilters: function () {
      var self = this;
      var tags = document.querySelectorAll('.rarity-filter-tag');
      tags.forEach(function (tag) {
        tag.addEventListener('click', function () {
          var rarity = this.getAttribute('data-rarity');
          self.filterByRarity(rarity);
        });
      });
    },

    /**
     * 绑定级别批量操作按钮点击事件（一键拥有 / 一键取消）
     */
    _bindBatchButtons: function () {
      var self = this;
      var buttons = document.querySelectorAll('.rarity-batch-btn');
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var rarity = this.dataset.rarity;
          var action = this.dataset.action;
          var pack = self.data.packs[self.currentPackIndex];

          // 获取该级别所有卡牌 ID
          var cardIds = pack.cards
            .filter(function (card) {
              return card.rarity === rarity;
            })
            .map(function (card) {
              return card.id;
            });

          if (action === 'mark') {
            CollectionStore.markAll(cardIds);
          } else {
            CollectionStore.unmarkAll(cardIds);
          }

          // 重新渲染并更新进度
          self.renderPackView();
          self._updateHeaderProgress();
          self._updateSidebarCounts();
        });
      });
    },

    /**
     * 过滤卡牌（搜索 + 拥有状态过滤 + 级别筛选）
     * @param {Array} cards - 卡牌数组
     * @returns {Array} 过滤后的卡牌数组
     */
    _filterCards: function (cards) {
      var self = this;
      return cards.filter(function (card) {
        // 搜索过滤
        if (self.searchFilter) {
          var filter = self.searchFilter.toLowerCase();
          if (card.name.toLowerCase().indexOf(filter) === -1 &&
            (card.rarityName && card.rarityName.toLowerCase().indexOf(filter) === -1) &&
            card.rarity.toLowerCase().indexOf(filter) === -1) {
            return false;
          }
        }
        // 只看已拥有
        if (self.currentFilter === 'owned' && !CollectionStore.isOwned(card.id)) {
          return false;
        }
        // 只看未拥有
        if (self.currentFilter === 'unowned' && CollectionStore.isOwned(card.id)) {
          return false;
        }
        // 级别筛选
        if (self.rarityFilter && card.rarity !== self.rarityFilter) {
          return false;
        }
        return true;
      });
    },

    /**
     * 渲染单张卡牌 HTML
     * @param {Object} card - 卡牌对象
     * @param {Object} pack - 所属卡包
     * @returns {string} HTML 字符串
     */
    _renderCard: function (card, pack) {
      var ownedCls = CollectionStore.isOwned(card.id) ? ' owned' : '';
      var imgSrc = 'file:///' + card.path;
      var safeName = this._escapeHtml(card.name);
      var safeId = this._escapeHtml(card.id);

      return '<div class="card' + ownedCls + '" data-card-id="' + safeId + '">' +
        '<div class="card-img-wrap">' +
        '<img src="' + imgSrc + '" alt="' + safeName + '"' + ' loading="lazy" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="card-placeholder">' +
        '<span class="placeholder-icon">🃏</span>' +
        '<span>无图片</span>' +
        '</div>' +
        '</div>' +
        '<div class="card-body"><div class="card-name">' + safeName + '</div></div>' +
        '<button class="card-own-btn" data-card-id="' + safeId + '" title="标记拥有"></button>' +
        '</div>';
    },

    /**
     * 绑定卡牌事件（点击预览 + 拥有按钮）
     */
    _bindCardEvents: function () {
      var self = this;
      var view = document.getElementById('packView');

      // 卡牌点击 → 打开预览
      view.querySelectorAll('.card').forEach(function (cardEl) {
        cardEl.addEventListener('click', function (e) {
          // 如果点击的是拥有按钮，不打开预览
          if (e.target.closest('.card-own-btn')) return;
          var cardId = this.dataset.cardId;
          self.openCardPreview(cardId);
        });

        // IntersectionObserver 入场动画
        self.cardObserver.observe(cardEl);
      });

      // 拥有按钮点击
      view.querySelectorAll('.card-own-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var cardId = this.dataset.cardId;
          var isNowOwned = CollectionStore.toggle(cardId);

          // 更新同组所有卡牌样式（重复图片组联动）
          if (typeof DUPLICATE_GROUPS !== 'undefined' && DUPLICATE_GROUPS.hasOwnProperty(cardId)) {
            var groupIdx = DUPLICATE_GROUPS[cardId];
            view.querySelectorAll('.card').forEach(function (el) {
              var cid = el.dataset.cardId;
              if (DUPLICATE_GROUPS.hasOwnProperty(cid) && DUPLICATE_GROUPS[cid] === groupIdx) {
                el.classList.toggle('owned', isNowOwned);
              }
            });
          } else {
            var cardEl = this.closest('.card');
            cardEl.classList.toggle('owned', isNowOwned);
          }

          // 重新触发 starPop 动画
          if (isNowOwned) {
            this.style.animation = 'none';
            void this.offsetWidth; // 强制重排
            this.style.animation = '';
          }
          self.onOwnedChanged(cardId);
        });
      });
    },

    /**
     * 搜索输入处理
     * @param {string} text - 搜索文本
     */
    onSearchInput: function (text) {
      this.searchFilter = text.trim();
      this.renderPackView();
    },

    /**
     * 打开卡牌预览（3D 圆环）
     * @param {string} cardId - 卡牌 ID
     */
    openCardPreview: function (cardId) {
      var pack = this.data.packs[this.currentPackIndex];
      if (!pack || !pack.cards) return;

      // 查找卡牌
      var card = null;
      var cardIndex = -1;
      for (var i = 0; i < pack.cards.length; i++) {
        if (pack.cards[i].id === cardId) {
          card = pack.cards[i];
          cardIndex = i;
          break;
        }
      }
      if (!card) return;

      // 调用 CoverflowCarousel 打开弹窗
      if (global.CoverflowCarousel) {
        global.CoverflowCarousel.open(card, pack.cards, cardIndex);
      }
    },

    /**
     * 拥有状态变更回调（列表页或弹窗触发后同步更新）
     * 同步所有重复卡牌的 UI 样式
     * @param {string} cardId - 卡牌 ID
     */
    onOwnedChanged: function (cardId) {
      // 更新 Header 总进度
      this._updateHeaderProgress();
      // 更新侧边栏计数
      this._updateSidebarCounts();
      // 更新当前卡包进度条
      this._updateCurrentPackProgress();
      // 更新级别进度
      this._updateRarityProgress();
      // 同步卡牌样式（支持重复图片组联动）
      if (cardId) {
        if (typeof DUPLICATE_GROUPS !== 'undefined' && DUPLICATE_GROUPS.hasOwnProperty(cardId)) {
          var groupIdx = DUPLICATE_GROUPS[cardId];
          var isOwned = CollectionStore.isOwned(cardId);
          document.querySelectorAll('.card').forEach(function (el) {
            var cid = el.dataset.cardId;
            if (DUPLICATE_GROUPS.hasOwnProperty(cid) && DUPLICATE_GROUPS[cid] === groupIdx) {
              el.classList.toggle('owned', isOwned);
            }
          });
        } else {
          var cardEl = document.querySelector('.card[data-card-id="' + cardId + '"]');
          if (cardEl) {
            cardEl.classList.toggle('owned', CollectionStore.isOwned(cardId));
          }
        }
      }
    },

    /**
     * 更新 Header 总进度
     */
    _updateHeaderProgress: function () {
      var total = this.data.meta.totalCards;
      var owned = CollectionStore.getTotalOwned();
      var pct = total > 0 ? Math.round(owned / total * 100) : 0;
      document.getElementById('headerStats').innerHTML =
        '已收集 <strong>' + owned + '</strong> / ' + total +
        ' <span style="font-size:0.85rem;">(' + pct + '%)</span>';
    },

    /**
     * 更新侧边栏所有卡包计数
     */
    _updateSidebarCounts: function () {
      var self = this;
      var items = document.querySelectorAll('.pack-item');
      items.forEach(function (el, i) {
        var pack = self.data.packs[i];
        if (!pack) return;
        var owned = CollectionStore.getOwnedCount(pack);
        var countEl = el.querySelector('.pack-count');
        if (countEl) countEl.textContent = owned + '/' + pack.cardCount;
      });
    },

    /**
     * 更新当前卡包进度条
     */
    _updateCurrentPackProgress: function () {
      var pack = this.data.packs[this.currentPackIndex];
      if (!pack) return;
      var owned = CollectionStore.getOwnedCount(pack);
      var pct = pack.cardCount > 0 ? Math.round(owned / pack.cardCount * 100) : 0;
      var fill = document.querySelector('.progress-fill');
      var text = document.querySelector('.progress-text');
      if (fill) fill.style.width = pct + '%';
      if (text) text.textContent = owned + '/' + pack.cardCount + ' (' + pct + '%)';
    },

    /**
     * 更新级别进度
     */
    _updateRarityProgress: function () {
      var self = this;
      var groups = document.querySelectorAll('.rarity-group');
      groups.forEach(function (group) {
        var rarity = group.dataset.rarity;
        var cards = group.querySelectorAll('.card');
        var ownedCount = 0;
        cards.forEach(function (cardEl) {
          if (cardEl.classList.contains('owned')) ownedCount++;
        });
        var progressEl = group.querySelector('.rarity-group-progress');
        if (progressEl) {
          progressEl.textContent = ownedCount + '/' + cards.length;
        }
      });
    },

    /**
     * 更新所有进度（初始化时调用）
     */
    updateAllProgress: function () {
      this._updateHeaderProgress();
      this._updateSidebarCounts();
    },

    /**
     * 导出收藏数据为 JSON 文件
     */
    exportOwned: function () {
      var data = CollectionStore.exportData();
      var jsonStr = JSON.stringify(data, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'doraemon-collection-backup-' +
        new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /**
     * 导入收藏数据
     */
    importOwned: function () {
      var self = this;
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          try {
            var data = JSON.parse(ev.target.result);
            if (!data || !Array.isArray(data.ownedIds)) {
              throw new Error('格式不正确');
            }
            var added = CollectionStore.importData(data);
            // 全量重渲染
            self.updateAllProgress();
            self.renderPackView();
            alert('导入成功！新增 ' + added + ' 张收藏卡牌。');
          } catch (err) {
            alert('导入失败：文件格式不正确或已损坏。');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },

    /**
     * HTML 转义
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml: function (str) {
      if (!str) return '';
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    /**
     * 向页面注入级别筛选标签的动态颜色 CSS
     * 根据 config.js 中的 LEVEL_COLORS 生成，确保标签与下方徽章颜色一致
     */
    _injectRarityFilterStyles: function () {
      var css = '';
      var colors = AppConfig.LEVEL_COLORS;
      Object.keys(colors).forEach(function (r) {
        var c = colors[r];
        css += '.rarity-filter-tag[data-rarity="' + r + '"]:not(.active):not(:hover){background:' + c.bg + ';color:' + c.text + ';}\n';
      });
      var style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    },

    /**
     * 获取级别颜色样式
     * @param {string} rarity - 级别代码
     * @returns {Object} {bg, text}
     */
    _getLevelColor: function (rarity) {
      var color = AppConfig.LEVEL_COLORS[rarity];
      if (!color) color = AppConfig.DEFAULT_LEVEL_COLOR;
      return color;
    }
  };

  /* ================================================================
   * 全局暴露
   * ================================================================ */
  global.CollectionStore = CollectionStore;
  global.App = App;

  /* ================================================================
   * 自动初始化（DOM 加载完成后）
   * ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      App.init();
    });
  } else {
    App.init();
  }

})(typeof window !== 'undefined' ? window : this);
