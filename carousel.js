/**
 * 哆啦A梦卡牌收藏站 - 3D Coverflow 圆环预览模块 (carousel.js)
 *
 * 实现：
 *   - 真 3D Coverflow 渲染（perspective + rotateY + translateZ + scale + opacity + blur）
 *   - 鼠标 / 触摸拖拽浏览（浮点 virtualIndex 连续更新，松手吸附）
 *   - 拖拽时禁用 transition（跟手），松手后启用 transition（平滑吸附）
 *   - 键盘导航（← → Esc）
 *   - 左右箭头按钮导航
 *   - 点击非居中卡牌切换到该卡牌
 *   - 居中卡牌拥有标记（与列表页状态同步）
 *
 * 全局对象：window.CoverflowCarousel
 * 依赖：window.AppConfig (config.js), window.CollectionStore, window.App (app.js)
 *
 * 作者：工程师 寇豆码（Kou）
 */

(function (global) {
  'use strict';

  var CoverflowCarousel = {
    /** 当前卡包所有卡牌 */
    cards: [],
    /** 浮点虚拟索引（拖拽时连续变化） */
    virtualIndex: 0,
    /** 是否正在拖拽 */
    isDragging: false,
    /** 刚刚完成拖拽（用于阻止后续 click 事件关闭弹窗） */
    _justDragged: false,
    /** 拖拽起始 X 坐标 */
    dragStartX: 0,
    /** 拖拽起始时的虚拟索引 */
    dragStartIndex: 0,
    /** 弹窗是否打开 */
    isOpen: false,
    /** 自动旋转定时器 ID */
    autoRotateTimer: null,

    /**
     * 打开 3D 圆环预览
     * @param {Object} card - 点击的卡牌对象
     * @param {Array} allCards - 当前卡包所有卡牌
     * @param {number} cardIndex - 卡牌在 allCards 中的索引
     */
    open: function (card, allCards, cardIndex) {
      this.cards = allCards || [];
      if (this.cards.length === 0) return;

      this.virtualIndex = (cardIndex !== undefined && cardIndex >= 0) ? cardIndex : 0;
      this.isOpen = true;

      // 显示弹窗
      var overlay = document.getElementById('modalOverlay');
      overlay.classList.add('active');
      overlay.classList.remove('closing');

      // 禁用 body 滚动
      document.body.style.overflow = 'hidden';

      // 渲染
      this.render();
      this.updateCenterContent();

      // 绑定拖拽事件（只绑定一次）
      this._bindDragEvents();
    },

    /**
     * 关闭弹窗
     */
    close: function () {
      if (!this.isOpen) return;
      this.isOpen = false;

      // 停止自动旋转
      this._stopAutoRotate();

      var overlay = document.getElementById('modalOverlay');
      overlay.classList.add('closing');

      // 动画结束后移除
      var self = this;
      setTimeout(function () {
        overlay.classList.remove('active', 'closing');
        document.body.style.overflow = '';
        // 清空圆环内容
        var track = document.getElementById('coverflowTrack');
        if (track) track.innerHTML = '';
      }, AppConfig.ANIMATION.MODAL_CLOSE_DELAY);
    },

    /**
     * 打开全屏图片查看弹窗
     * @param {string} imgSrc - 图片路径
     */
    openLightbox: function (imgSrc) {
      var overlay = document.getElementById('lightboxOverlay');
      var img = document.getElementById('lightboxImg');
      if (!overlay || !img) return;
      img.src = imgSrc;
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    },

    /**
     * 关闭全屏图片查看弹窗
     */
    closeLightbox: function () {
      var overlay = document.getElementById('lightboxOverlay');
      if (!overlay) return;
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    },

    /**
     * 核心 3D 渲染：遍历所有卡牌，按偏移量计算 3D 变换
     * 采用卡牌复用策略：更新已存在的卡牌样式而非重建 DOM，确保 CSS transition 生效
     */
    render: function () {
      var track = document.getElementById('coverflowTrack');
      if (!track) return;

      var C = AppConfig.COVERFLOW;
      var self = this;

      // 收集当前可见卡牌的索引集合
      var visibleIndices = {};
      this.cards.forEach(function (card, index) {
        var offset = index - self.virtualIndex;
        if (Math.abs(offset) <= C.MAX_VISIBLE + 0.5) {
          visibleIndices[index] = true;
        }
      });

      // 移除不再可见的卡牌 DOM
      var existingCards = track.querySelectorAll('.coverflow-card');
      existingCards.forEach(function (el) {
        var idx = parseInt(el.dataset.cardIndex, 10);
        if (!visibleIndices[idx]) {
          track.removeChild(el);
        }
      });

      // 更新或创建可见卡牌
      this.cards.forEach(function (card, index) {
        var offset = index - self.virtualIndex; // 浮点偏移量
        var absOffset = Math.abs(offset);

        // 超出可见范围则跳过
        if (absOffset > C.MAX_VISIBLE + 0.5) return;

        // 计算 3D 变换参数
        var rotateY = -offset * C.ANGLE_STEP;
        var translateX = offset * C.SPACING;
        var translateZ = -absOffset * C.DEPTH;
        var scale = Math.max(C.MIN_SCALE, 1 - absOffset * 0.12);
        var opacity = Math.max(C.MIN_OPACITY, 1 - absOffset * 0.22);
        var blur = Math.min(C.MAX_BLUR, absOffset * 1.5);
        var zIndex = 100 - Math.floor(absOffset);

        var isCenter = Math.round(offset) === 0 && absOffset < 0.5;
        var isOwned = CollectionStore.isOwned(card.id);

        // 查找已存在的卡牌 DOM（复用）
        var div = track.querySelector('.coverflow-card[data-card-index="' + index + '"]');

        if (!div) {
          // 创建新卡牌 DOM
          div = document.createElement('div');
          div.dataset.cardId = card.id;
          div.dataset.cardIndex = index;

          // 图片（含容错）
          var imgSrc = 'file:///' + card.path;
          div.innerHTML = '<img src="' + imgSrc + '" alt="' + self._escapeHtml(card.name) + '" ' +
            'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
            '<div class="cf-placeholder">' +
            '<span class="placeholder-icon">🃏</span>' +
            '<span>无图片</span>' +
            '</div>';

          // 绑定点击事件（切换到该卡牌）
          div.addEventListener('click', function (e) {
            e.stopPropagation();
            var clickIdx = parseInt(this.dataset.cardIndex, 10);
            var clickOffset = clickIdx - self.virtualIndex;
            if (Math.round(clickOffset) !== 0) {
              self._enableTransition();
              self.virtualIndex = clickIdx;
              self.render();
              self.updateCenterContent();
            }
          });

          track.appendChild(div);
        }

        // 更新卡牌样式（复用 DOM 时 CSS transition 会生效）
        div.className = 'coverflow-card' + (isCenter ? ' center' : '') + (isOwned ? ' owned' : '');

        // 设置 3D 变换 inline style
        div.style.transform = 'rotateY(' + rotateY + 'deg) translateX(' + translateX + 'px) translateZ(' + translateZ + 'px) scale(' + scale + ')';
        div.style.opacity = opacity;
        div.style.filter = 'blur(' + blur + 'px)';
        div.style.zIndex = zIndex;
      });
    },

    /**
     * 更新居中卡牌内容（主图、信息、计数器）
     */
    updateCenterContent: function () {
      var centerIdx = Math.round(this.virtualIndex);
      if (centerIdx < 0) centerIdx = 0;
      if (centerIdx >= this.cards.length) centerIdx = this.cards.length - 1;

      var card = this.cards[centerIdx];
      if (!card) return;

      var imgSrc = 'file:///' + card.path;
      var isOwned = CollectionStore.isOwned(card.id);

      // 更新主图区
      var mainImg = document.getElementById('modalMainImg');
      if (mainImg) {
        mainImg.innerHTML = '<img src="' + imgSrc + '" alt="' + this._escapeHtml(card.name) + '" ' +
          'title="点击查看原图" ' +
          'onclick="CoverflowCarousel.openLightbox(\'' + imgSrc.replace(/'/g, "\\'") + '\')" ' +
          'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
          '<div class="modal-img-placeholder">' +
          '<span class="placeholder-icon">🃏</span>' +
          '<span>图片加载失败</span>' +
          '</div>';
      }

      // 更新信息区
      var info = document.getElementById('modalInfo');
      if (info) {
        var color = global.App._getLevelColor(card.rarity);
        var rarityNameText = card.rarityName ? ' · ' + this._escapeHtml(card.rarityName) : '';
        info.innerHTML =
          '<div class="modal-card-name">' + this._escapeHtml(card.name) + '</div>' +
          '<div class="modal-card-rarity-name">' +
          '<span class="rarity-badge" style="background:' + color.bg + ';color:' + color.text + ';">' +
          this._escapeHtml(card.rarity) + '</span>' +
          '<span style="margin-left:8px;">' + rarityNameText + '</span>' +
          '</div>' +
          '<button class="modal-own-toggle' + (isOwned ? ' owned' : '') + '" id="modalOwnToggle">' +
          (isOwned ? '⭐ 已拥有' : '☆ 标记拥有') +
          '</button>';

        // 绑定拥有按钮事件
        var ownBtn = document.getElementById('modalOwnToggle');
        if (ownBtn) {
          ownBtn.addEventListener('click', function () {
            this.toggleOwned();
          }.bind(this));
        }
      }

      // 更新计数器
      var counter = document.getElementById('coverflowCounter');
      if (counter) {
        counter.innerHTML = '<strong>' + (centerIdx + 1) + '</strong> / ' + this.cards.length;
      }
    },

    /**
     * 切换居中卡牌的拥有状态
     */
    toggleOwned: function () {
      var centerIdx = Math.round(this.virtualIndex);
      if (centerIdx < 0 || centerIdx >= this.cards.length) return;
      var card = this.cards[centerIdx];
      if (!card) return;

      var isNowOwned = CollectionStore.toggle(card.id);

      // 更新弹窗内按钮状态
      var ownBtn = document.getElementById('modalOwnToggle');
      if (ownBtn) {
        ownBtn.classList.toggle('owned', isNowOwned);
        ownBtn.textContent = isNowOwned ? '⭐ 已拥有' : '☆ 标记拥有';
        // 触发弹跳动画
        ownBtn.classList.remove('popping');
        void ownBtn.offsetWidth;
        ownBtn.classList.add('popping');
      }

      // 更新圆环卡牌 owned 类
      var cardEl = document.querySelector('.coverflow-card[data-card-id="' + card.id + '"]');
      if (cardEl) {
        cardEl.classList.toggle('owned', isNowOwned);
      }

      // 回调 App 同步列表页
      if (global.App) {
        global.App.onOwnedChanged(card.id);
      }
    },

    /**
     * 导航到下一张/上一张
     * @param {number} direction - -1 上一张, 1 下一张
     */
    navigate: function (direction) {
      this._enableTransition();
      var newIndex = this.virtualIndex + direction;
      if (newIndex < 0) newIndex = 0;
      if (newIndex > this.cards.length - 1) newIndex = this.cards.length - 1;
      this.virtualIndex = newIndex;
      this.render();
      this.updateCenterContent();
    },

    /* ================================================================
     * 拖拽事件处理
     * ================================================================ */

    /**
     * 绑定拖拽事件（鼠标 + 触摸 + 键盘）
     * 只绑定一次，通过标志位避免重复绑定
     */
    _bindDragEvents: function () {
      if (this._eventsBound) return;
      this._eventsBound = true;

      var self = this;
      var container = document.getElementById('coverflowContainer');

      // 鼠标拖拽
      container.addEventListener('mousedown', function (e) {
        // 如果点击的是箭头按钮，不启动拖拽
        if (e.target.closest('.coverflow-arrow')) return;
        self.onDragStart(e.clientX);
      });
      document.addEventListener('mousemove', function (e) {
        if (self.isDragging) self.onDragMove(e.clientX);
      });
      document.addEventListener('mouseup', function () {
        if (self.isDragging) self.onDragEnd();
      });

      // 触摸拖拽
      container.addEventListener('touchstart', function (e) {
        // 如果点击的是箭头按钮，不启动拖拽
        if (e.target.closest('.coverflow-arrow')) return;
        if (e.touches.length > 0) {
          self.onDragStart(e.touches[0].clientX);
        }
      }, { passive: true });
      document.addEventListener('touchmove', function (e) {
        if (self.isDragging && e.touches.length > 0) {
          self.onDragMove(e.touches[0].clientX);
        }
      }, { passive: true });
      document.addEventListener('touchend', function () {
        if (self.isDragging) self.onDragEnd();
      });

      // 键盘导航
      document.addEventListener('keydown', function (e) {
        if (!self.isOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          self.close();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          self.navigate(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          self.navigate(1);
        }
      });

      // 左右箭头按钮
      var leftBtn = document.getElementById('coverflowLeft');
      var rightBtn = document.getElementById('coverflowRight');
      if (leftBtn) {
        leftBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          self.navigate(-1);
        });
      }
      if (rightBtn) {
        rightBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          self.navigate(1);
        });
      }
    },

    /**
     * 拖拽开始
     * @param {number} clientX - 鼠标/触摸 X 坐标
     */
    onDragStart: function (clientX) {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragStartIndex = this.virtualIndex;
      this._disableTransition();
    },

    /**
     * 拖拽移动
     * @param {number} clientX - 鼠标/触摸 X 坐标
     */
    onDragMove: function (clientX) {
      if (!this.isDragging) return;

      var C = AppConfig.COVERFLOW;
      var deltaX = clientX - this.dragStartX;
      // 像素 → 卡牌单位的换算：拖拽一个卡牌宽度 ≈ 移动 SPACING 像素
      var cardDelta = deltaX / C.SPACING;
      // 向右拖 → 看上一张（virtualIndex 减小）
      this.virtualIndex = this.dragStartIndex - cardDelta;

      // 边界约束
      if (this.virtualIndex < 0) this.virtualIndex = 0;
      if (this.virtualIndex > this.cards.length - 1) this.virtualIndex = this.cards.length - 1;

      // 实时重渲染（无过渡，跟手）
      this.render();
      // 拖拽过程中也更新主图（实时跟随）
      this.updateCenterContent();
    },

    /**
     * 拖拽结束：吸附到最近的卡牌
     */
    onDragEnd: function () {
      if (!this.isDragging) return;
      this.isDragging = false;
      this._justDragged = true;

      // 启用 transition，平滑吸附
      this._enableTransition();

      // 吸附到最近的整数索引
      var snapIndex = Math.round(this.virtualIndex);
      if (snapIndex < 0) snapIndex = 0;
      if (snapIndex > this.cards.length - 1) snapIndex = this.cards.length - 1;
      this.virtualIndex = snapIndex;

      this.render();
      this.updateCenterContent();
    },

    /**
     * 启用 transition（松手后平滑过渡）
     */
    _enableTransition: function () {
      var track = document.getElementById('coverflowTrack');
      if (track) track.classList.remove('no-transition');
    },

    /**
     * 禁用 transition（拖拽时实时跟手）
     */
    _disableTransition: function () {
      var track = document.getElementById('coverflowTrack');
      if (track) track.classList.add('no-transition');
    },

    /**
     * 启动自动旋转（P2 功能）
     */
    _startAutoRotate: function () {
      this._stopAutoRotate();
      var self = this;
      this.autoRotateTimer = setInterval(function () {
        if (!self.isOpen) {
          self._stopAutoRotate();
          return;
        }
        var next = self.virtualIndex + 1;
        if (next > self.cards.length - 1) next = 0;
        self._enableTransition();
        self.virtualIndex = next;
        self.render();
        self.updateCenterContent();
      }, 3000);
    },

    /**
     * 停止自动旋转
     */
    _stopAutoRotate: function () {
      if (this.autoRotateTimer) {
        clearInterval(this.autoRotateTimer);
        this.autoRotateTimer = null;
      }
    },

    /**
     * HTML 转义
     */
    _escapeHtml: function (str) {
      if (!str) return '';
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  };

  /* ================================================================
   * 全局暴露
   * ================================================================ */
  global.CoverflowCarousel = CoverflowCarousel;

})(typeof window !== 'undefined' ? window : this);
