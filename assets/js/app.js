/* SignalNest - progressive enhancement. No dependencies. */
(function () {
  'use strict';

  /* ---------------- Animation utilities ---------------- */
  var hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  function observeElements(selector, callback, options) {
    if (!('IntersectionObserver' in window) || hasReducedMotion) return;
    var elements = document.querySelectorAll(selector);
    if (!elements.length) return;
    
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, options || { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    elements.forEach(function (el) { observer.observe(el); });
  }
  
  /* Fade-in animations for cards and sections */
  function initScrollAnimations() {
    if (hasReducedMotion) return;
    
    // Add animation-ready class to elements
    var animatableSelectors = [
      '.card', '.hero__side .card', '.trend-list li', 
      '.cat-tile', '.result', '.article-figure'
    ];
    
    animatableSelectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el, index) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        el.style.transitionDelay = (index * 0.05) + 's';
      });
    });
    
    // Observe and animate
    observeElements(animatableSelectors.join(','), function (element) {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
  } else {
    initScrollAnimations();
  }

  /* ---------------- Theme ---------------- */
  var THEME_KEY = 'signalnest-theme';
  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      btn.setAttribute('aria-pressed', String(isDark));
    }
  }
  try {
    applyTheme(localStorage.getItem(THEME_KEY));
  } catch (e) { /* storage blocked - keep system theme */ }

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest && event.target.closest('#theme-toggle');
    if (!toggle) return;
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    applyTheme(next);
  });

  /* ---------------- Mobile navigation ---------------- */
  var navToggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('nav--open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('nav--open')) {
        nav.classList.remove('nav--open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* ---------------- Reading progress ---------------- */
  var progress = document.getElementById('reading-progress');
  var articleBody = document.getElementById('article-body');
  if (progress && articleBody) {
    var ticking = false;
    var update = function () {
      var rect = articleBody.getBoundingClientRect();
      var start = window.scrollY + rect.top;
      var total = rect.height - window.innerHeight * 0.35;
      var done = Math.min(1, Math.max(0, (window.scrollY - start + window.innerHeight * 0.35) / Math.max(total, 1)));
      progress.style.width = (done * 100).toFixed(2) + '%';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------- Reading features: bookmarks, history, position ---------------- */
  var BOOKMARKS_KEY = 'signalnest-bookmarks';
  var HISTORY_KEY = 'signalnest-reading-history';
  var POSITION_KEY_PREFIX = 'signalnest-position-';
  var MAX_HISTORY = 50;

  var ReadingFeatures = {
    // Bookmark management
    isBookmarked: function (slug) {
      try {
        var bookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
        return bookmarks.some(function (b) { return b.slug === slug; });
      } catch (e) { return false; }
    },
    
    toggleBookmark: function (slug, title, url) {
      try {
        var bookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
        var index = bookmarks.findIndex(function (b) { return b.slug === slug; });
        
        if (index > -1) {
          bookmarks.splice(index, 1);
        } else {
          bookmarks.unshift({
            slug: slug,
            title: title,
            url: url,
            bookmarkedAt: new Date().toISOString()
          });
        }
        
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
        return index === -1; // true if now bookmarked
      } catch (e) { return false; }
    },
    
    getBookmarks: function () {
      try {
        return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
      } catch (e) { return []; }
    },
    
    // Reading history
    addToHistory: function (slug, title, url, category) {
      try {
        var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        
        // Remove if already exists
        history = history.filter(function (h) { return h.slug !== slug; });
        
        // Add to front
        history.unshift({
          slug: slug,
          title: title,
          url: url,
          category: category,
          readAt: new Date().toISOString()
        });
        
        // Keep only MAX_HISTORY items
        if (history.length > MAX_HISTORY) {
          history = history.slice(0, MAX_HISTORY);
        }
        
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch (e) { /* ignore */ }
    },
    
    getHistory: function (limit) {
      try {
        var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return limit ? history.slice(0, limit) : history;
      } catch (e) { return []; }
    },
    
    clearHistory: function () {
      try {
        localStorage.removeItem(HISTORY_KEY);
        return true;
      } catch (e) { return false; }
    },
    
    // Reading position
    savePosition: function (slug, scrollPercent) {
      try {
        localStorage.setItem(POSITION_KEY_PREFIX + slug, String(scrollPercent));
      } catch (e) { /* ignore */ }
    },
    
    getPosition: function (slug) {
      try {
        var pos = localStorage.getItem(POSITION_KEY_PREFIX + slug);
        return pos ? parseFloat(pos) : 0;
      } catch (e) { return 0; }
    },
    
    clearPosition: function (slug) {
      try {
        localStorage.removeItem(POSITION_KEY_PREFIX + slug);
      } catch (e) { /* ignore */ }
    }
  };

  /* Initialize bookmark button on article pages */
  function initBookmarkButton() {
    var bookmarkBtn = document.querySelector('[data-bookmark-toggle]');
    if (!bookmarkBtn) return;
    
    var slug = bookmarkBtn.getAttribute('data-slug');
    var title = bookmarkBtn.getAttribute('data-title');
    var url = bookmarkBtn.getAttribute('data-url') || window.location.href;
    
    if (!slug || !title) return;
    
    var updateButton = function (isBookmarked) {
      bookmarkBtn.setAttribute('aria-pressed', String(isBookmarked));
      bookmarkBtn.textContent = isBookmarked ? '★ Bookmarked' : '☆ Bookmark';
      bookmarkBtn.setAttribute('title', isBookmarked ? 'Remove bookmark' : 'Bookmark this article');
    };
    
    updateButton(ReadingFeatures.isBookmarked(slug));
    
    bookmarkBtn.addEventListener('click', function () {
      var nowBookmarked = ReadingFeatures.toggleBookmark(slug, title, url);
      updateButton(nowBookmarked);
      
      // Show feedback
      var feedback = document.createElement('span');
      feedback.textContent = nowBookmarked ? 'Bookmarked!' : 'Removed';
      feedback.style.cssText = 'position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:var(--brand);color:#fff;padding:6px 12px;border-radius:6px;font-size:.8rem;white-space:nowrap;pointer-events:none;animation:fadeIn 0.3s ease;';
      bookmarkBtn.style.position = 'relative';
      bookmarkBtn.appendChild(feedback);
      setTimeout(function () { feedback.remove(); }, 2000);
    });
  }

  /* Track reading position on article pages */
  function initReadingPosition() {
    var articleBody = document.getElementById('article-body');
    if (!articleBody) return;
    
    var slug = articleBody.getAttribute('data-slug');
    if (!slug) return;
    
    // Restore saved position
    var savedPos = ReadingFeatures.getPosition(slug);
    if (savedPos > 5 && savedPos < 95) { // Only restore if partially read
      var shouldRestore = confirm('Continue reading from where you left off?');
      if (shouldRestore) {
        var targetScroll = (document.documentElement.scrollHeight - window.innerHeight) * (savedPos / 100);
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    }
    
    // Save position periodically
    var saveTimer = null;
    var saveCurrentPosition = function () {
      var scrolled = window.scrollY;
      var total = document.documentElement.scrollHeight - window.innerHeight;
      var percent = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      ReadingFeatures.savePosition(slug, percent);
      
      // Clear position if article is completed (scrolled to 98%+)
      if (percent > 98) {
        ReadingFeatures.clearPosition(slug);
      }
    };
    
    window.addEventListener('scroll', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCurrentPosition, 500);
    }, { passive: true });
    
    // Save position when leaving page
    window.addEventListener('beforeunload', saveCurrentPosition);
  }

  /* Add article to reading history */
  function trackArticleVisit() {
    var article = document.querySelector('article[data-slug]');
    if (!article) return;
    
    var slug = article.getAttribute('data-slug');
    var title = article.getAttribute('data-title') || document.title;
    var url = window.location.href;
    var category = article.getAttribute('data-category') || '';
    
    if (slug && title) {
      ReadingFeatures.addToHistory(slug, title, url, category);
    }
  }

  // Initialize reading features
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initBookmarkButton();
      initReadingPosition();
      trackArticleVisit();
    });
  } else {
    initBookmarkButton();
    initReadingPosition();
    trackArticleVisit();
  }

  // Expose API for potential use in templates
  window.SignalNestReading = ReadingFeatures;

  /* ---------------- Copy link ---------------- */
  document.addEventListener('click', function (event) {
    var btn = event.target.closest && event.target.closest('[data-copy-link]');
    if (!btn) return;
    var url = window.location.href.split('#')[0];
    var label = btn.textContent;
    var done = function () {
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = label; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link', url); });
    } else {
      window.prompt('Copy this link', url);
    }
  });

  /* ---------------- Enhanced Social Sharing ---------------- */
  function initNativeSharing() {
    // Check if native Web Share API is available
    if (!navigator.share) return;
    
    var shareContainer = document.querySelector('.share');
    if (!shareContainer) return;
    
    // Create native share button
    var nativeShareBtn = document.createElement('button');
    nativeShareBtn.type = 'button';
    nativeShareBtn.className = 'share__native';
    nativeShareBtn.innerHTML = '📤 Share';
    nativeShareBtn.setAttribute('aria-label', 'Share via system');
    
    nativeShareBtn.addEventListener('click', function () {
      var title = document.title;
      var text = document.querySelector('meta[name="description"]');
      var url = window.location.href;
      
      navigator.share({
        title: title,
        text: text ? text.getAttribute('content') : '',
        url: url
      }).catch(function (error) {
        if (error.name !== 'AbortError') {
          console.log('Share failed:', error);
        }
      });
    });
    
    // Insert as first button after label
    var label = shareContainer.querySelector('.share__label');
    if (label && label.nextSibling) {
      shareContainer.insertBefore(nativeShareBtn, label.nextSibling);
    } else {
      shareContainer.appendChild(nativeShareBtn);
    }
  }
  
  // Enhanced share button interactions
  document.addEventListener('click', function (event) {
    var shareLink = event.target.closest && event.target.closest('.share a[href^="https://"]');
    if (!shareLink) return;
    
    // Track share (could be sent to analytics if configured)
    var platform = shareLink.textContent.trim().toLowerCase();
    console.log('Shared via:', platform);
  });
  
  // Initialize native sharing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNativeSharing);
  } else {
    initNativeSharing();
  }

  /* ---------------- Newsletter ----------------
   * Posts to a real configured endpoint only. No endpoint = no fake success.
   * The endpoint comes from data-action on the container or <body data-newsletter-action>.
   */
  var newsletterAction = document.body.getAttribute('data-newsletter-action') || '';
  document.querySelectorAll('[data-newsletter-form]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = form.querySelector('[data-newsletter-status]');
      var input = form.querySelector('input[type="email"]');
      if (!input || !status) return;
      var value = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        status.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      if (!newsletterAction) {
        status.textContent = 'Newsletter signup is not connected yet. Please check back soon.';
        return;
      }
      status.textContent = 'Subscribing…';
      var payload = new FormData();
      payload.append('email', value);
      fetch(newsletterAction, { method: 'POST', body: payload, mode: 'cors' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          status.textContent = 'Thanks — check your inbox to confirm.';
          form.reset();
        })
        .catch(function () {
          status.textContent = 'Something went wrong. Please try again later.';
        });
    });
  });

  /* ---------------- Table of contents highlighting (optional) ---------------- */
  var tocLinks = document.querySelectorAll('.toc a[href^="#"], .aside-block a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      if (id) map[id] = link;
    });
    var headings = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (l) { l.style.fontWeight = ''; });
        var active = map[entry.target.id];
        if (active) active.style.fontWeight = '700';
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    headings.forEach(function (h) { observer.observe(h); });
  }


  /* ---------------- Typography Controls & Reading Mode ---------------- */
  var TYPOGRAPHY_KEY = 'signalnest-typography';
  var READING_MODE_KEY = 'signalnest-reading-mode';

  var Typography = {
    fontSize: 100, // percentage
    lineHeight: 1.75, // multiplier
    
    load: function () {
      try {
        var saved = JSON.parse(localStorage.getItem(TYPOGRAPHY_KEY) || '{}');
        this.fontSize = saved.fontSize || 100;
        this.lineHeight = saved.lineHeight || 1.75;
        this.apply();
      } catch (e) { /* ignore */ }
    },
    
    save: function () {
      try {
        localStorage.setItem(TYPOGRAPHY_KEY, JSON.stringify({
          fontSize: this.fontSize,
          lineHeight: this.lineHeight
        }));
      } catch (e) { /* ignore */ }
    },
    
    apply: function () {
      var prose = document.querySelector('.prose');
      if (!prose) return;
      prose.style.fontSize = this.fontSize + '%';
      prose.style.lineHeight = String(this.lineHeight);
    },
    
    increaseFontSize: function () {
      this.fontSize = Math.min(150, this.fontSize + 10);
      this.apply();
      this.save();
    },
    
    decreaseFontSize: function () {
      this.fontSize = Math.max(80, this.fontSize - 10);
      this.apply();
      this.save();
    },
    
    resetFontSize: function () {
      this.fontSize = 100;
      this.lineHeight = 1.75;
      this.apply();
      this.save();
    }
  };

  var ReadingMode = {
    active: false,
    
    toggle: function () {
      this.active = !this.active;
      document.documentElement.classList.toggle('reading-mode', this.active);
      try {
        localStorage.setItem(READING_MODE_KEY, String(this.active));
      } catch (e) { /* ignore */ }
      return this.active;
    },
    
    load: function () {
      try {
        this.active = localStorage.getItem(READING_MODE_KEY) === 'true';
        if (this.active) document.documentElement.classList.add('reading-mode');
      } catch (e) { /* ignore */ }
    }
  };

  // Initialize typography controls on article pages
  function initTypographyControls() {
    if (!document.querySelector('.prose')) return;
    
    Typography.load();
    ReadingMode.load();
    
    // Create controls toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'typography-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Reading preferences');
    toolbar.innerHTML = 
      '<button type="button" data-action="font-smaller" aria-label="Decrease font size" title="Smaller text">A-</button>' +
      '<button type="button" data-action="font-larger" aria-label="Increase font size" title="Larger text">A+</button>' +
      '<button type="button" data-action="font-reset" aria-label="Reset font size" title="Reset">Reset</button>' +
      '<button type="button" data-action="reading-mode" aria-label="Toggle reading mode" title="Reading mode">📖</button>';
    
    // Insert after article header
    var header = document.querySelector('.article-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(toolbar, header.nextSibling);
    }
    
    // Event handlers
    toolbar.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-action]');
      if (!btn) return;
      
      var action = btn.getAttribute('data-action');
      if (action === 'font-smaller') Typography.decreaseFontSize();
      else if (action === 'font-larger') Typography.increaseFontSize();
      else if (action === 'font-reset') Typography.resetFontSize();
      else if (action === 'reading-mode') {
        var active = ReadingMode.toggle();
        btn.setAttribute('aria-pressed', String(active));
      }
    });
  }

  // Initialize typography features
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTypographyControls);
  } else {
    initTypographyControls();
  }

  // Expose APIs
  window.SignalNestTypography = Typography;
  window.SignalNestReadingMode = ReadingMode;


  /* ---------------- Image Lightbox ---------------- */
  function initImageLightbox() {
    var articleImages = document.querySelectorAll('.prose img, .article-figure img');
    if (!articleImages.length) return;
    
    // Create lightbox container
    var lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-label', 'Image viewer');
    lightbox.innerHTML = 
      '<div class="lightbox__content">' +
        '<img class="lightbox__image" src="" alt="">' +
        '<button class="lightbox__close" aria-label="Close image viewer">×</button>' +
      '</div>';
    document.body.appendChild(lightbox);
    
    var lightboxImg = lightbox.querySelector('.lightbox__image');
    var closeBtn = lightbox.querySelector('.lightbox__close');
    
    // Open lightbox
    articleImages.forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || '';
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });
    
    // Close lightbox
    var closeLightbox = function () {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    };
    
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    
    // Keyboard support
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  // Initialize lightbox
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImageLightbox);
  } else {
    initImageLightbox();
  }

  /* ---------------- Enhanced TOC ---------------- */
  function initEnhancedTOC() {
    var toc = document.querySelector('.toc');
    if (!toc) return;
    
    // Make title clickable to collapse/expand
    var title = toc.querySelector('.toc__title');
    if (title) {
      title.classList.add('toc__toggle');
      title.style.cursor = 'pointer';
      title.addEventListener('click', function () {
        toc.classList.toggle('collapsed');
      });
    }
    
    // Enhanced scroll spy
    var tocLinks = toc.querySelectorAll('a[href^="#"]');
    if (!tocLinks.length || !('IntersectionObserver' in window)) return;
    
    var headingMap = {};
    tocLinks.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      if (id) headingMap[id] = link;
    });
    
    var headings = Object.keys(headingMap).map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);
    
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (l) { l.classList.remove('active'); });
        var activeLink = headingMap[entry.target.id];
        if (activeLink) activeLink.classList.add('active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    
    headings.forEach(function (h) { observer.observe(h); });
  }

  // Initialize enhanced TOC
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancedTOC);
  } else {
    initEnhancedTOC();
  }

  /* ---------------- Accessibility Enhancements ---------------- */
  function initAccessibility() {
    // Add skip link if not exists
    if (!document.querySelector('.skip-link')) {
      var skipLink = document.createElement('a');
      skipLink.href = '#main-content';
      skipLink.className = 'skip-link';
      skipLink.textContent = 'Skip to main content';
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    // Add main content ID if not exists
    var mainContent = document.querySelector('.container') || document.querySelector('main');
    if (mainContent && !mainContent.id) {
      mainContent.id = 'main-content';
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      // Alt+S: Focus search
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        var searchInput = document.getElementById('q') || document.querySelector('input[type="search"]');
        if (searchInput) searchInput.focus();
      }
      
      // Alt+H: Go home
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        window.location.href = '/';
      }
    });
  }

  // Initialize accessibility
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibility);
  } else {
    initAccessibility();
  }


  /* ---------------- Image Lightbox ---------------- */
  function initImageLightbox() {
    var articleImages = document.querySelectorAll('.prose img, .article-figure img');
    if (!articleImages.length) return;
    
    // Create lightbox container
    var lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Image viewer');
    lightbox.innerHTML = 
      '<div class="lightbox__content">' +
        '<button class="lightbox__close" aria-label="Close lightbox">×</button>' +
        '<img class="lightbox__image" src="" alt="">' +
      '</div>';
    document.body.appendChild(lightbox);
    
    var lightboxImg = lightbox.querySelector('.lightbox__image');
    var closeBtn = lightbox.querySelector('.lightbox__close');
    
    // Open lightbox
    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    
    // Close lightbox
    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxImg.src = '';
    }
    
    // Make images clickable
    articleImages.forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        openLightbox(img.src, img.alt);
      });
      
      // Keyboard accessibility
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Click to enlarge image');
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(img.src, img.alt);
        }
      });
    });
    
    // Close on click outside, close button, or Escape
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  /* ---------------- Enhanced TOC ---------------- */
  function initEnhancedTOC() {
    var toc = document.querySelector('.toc');
    var tocSidebar = document.querySelector('.aside-block .toc, .aside-block ol');
    if (!toc && !tocSidebar) return;
    
    // Add collapse functionality
    if (toc) {
      var title = toc.querySelector('.toc__title');
      if (title) {
        title.className = 'toc__title toc__toggle';
        title.style.cursor = 'pointer';
        title.addEventListener('click', function () {
          toc.classList.toggle('collapsed');
        });
      }
    }
    
    // Enhanced scroll spy
    var tocLinks = document.querySelectorAll('.toc a[href^="#"], .aside-block a[href^="#"]');
    if (tocLinks.length && 'IntersectionObserver' in window) {
      var headingMap = {};
      tocLinks.forEach(function (link) {
        var id = decodeURIComponent(link.getAttribute('href').slice(1));
        if (id) headingMap[id] = link;
      });
      
      var headings = Object.keys(headingMap).map(function (id) {
        return document.getElementById(id);
      }).filter(Boolean);
      
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            // Remove active from all
            tocLinks.forEach(function (l) { l.classList.remove('active'); });
            // Add active to current
            var active = headingMap[entry.target.id];
            if (active) active.classList.add('active');
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
      
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  /* ---------------- Related Articles Carousel ---------------- */
  function initRelatedCarousel() {
    var relatedSection = document.querySelector('.section .grid--3');
    if (!relatedSection || !relatedSection.children.length) return;
    
    // Only create carousel on mobile/tablet
    if (window.innerWidth > 900) return;
    
    relatedSection.classList.remove('grid', 'grid--3');
    relatedSection.classList.add('carousel__track');
    
    var carousel = document.createElement('div');
    carousel.className = 'carousel';
    relatedSection.parentNode.insertBefore(carousel, relatedSection);
    carousel.appendChild(relatedSection);
    
    // Add navigation buttons
    var prevBtn = document.createElement('button');
    prevBtn.className = 'carousel__btn carousel__btn--prev';
    prevBtn.innerHTML = '‹';
    prevBtn.setAttribute('aria-label', 'Previous article');
    
    var nextBtn = document.createElement('button');
    nextBtn.className = 'carousel__btn carousel__btn--next';
    nextBtn.innerHTML = '›';
    nextBtn.setAttribute('aria-label', 'Next article');
    
    carousel.appendChild(prevBtn);
    carousel.appendChild(nextBtn);
    
    var track = relatedSection;
    var scrollAmount = track.offsetWidth * 0.8;
    
    prevBtn.addEventListener('click', function () {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', function () {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
    
    // Touch swipe support
    var startX = 0;
    var scrollLeft = 0;
    
    track.addEventListener('touchstart', function (e) {
      startX = e.touches[0].pageX;
      scrollLeft = track.scrollLeft;
    }, { passive: true });
    
    track.addEventListener('touchmove', function (e) {
      var x = e.touches[0].pageX;
      var walk = (startX - x) * 1.5;
      track.scrollLeft = scrollLeft + walk;
    }, { passive: true });
  }

  /* ---------------- Simple Code Syntax Highlighting ---------------- */
  function initSyntaxHighlight() {
    var codeBlocks = document.querySelectorAll('pre code');
    if (!codeBlocks.length) return;
    
    var patterns = {
      keyword: /\b(function|const|let|var|if|else|for|while|return|class|import|export|from|async|await|try|catch|def|print|public|private|static)\b/g,
      string: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      comment: /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g,
      number: /\b\d+(\.\d+)?\b/g,
      function: /\b([a-zA-Z_]\w*)\s*\(/g,
      operator: /[+\-*/%=<>!&|]+/g
    };
    
    codeBlocks.forEach(function (block) {
      var code = block.textContent;
      var highlighted = code;
      
      // Apply syntax highlighting
      highlighted = highlighted.replace(patterns.comment, '<span class="comment">$&</span>');
      highlighted = highlighted.replace(patterns.string, '<span class="string">$&</span>');
      highlighted = highlighted.replace(patterns.keyword, '<span class="keyword">$&</span>');
      highlighted = highlighted.replace(patterns.number, '<span class="number">$&</span>');
      highlighted = highlighted.replace(patterns.function, '<span class="function">$1</span>(');
      
      block.innerHTML = highlighted;
    });
  }

  /* ---------------- Accessibility Enhancements ---------------- */
  function initAccessibilityEnhancements() {
    // Add skip link if not exists
    if (!document.querySelector('.skip-link')) {
      var skipLink = document.createElement('a');
      skipLink.href = '#main-content';
      skipLink.className = 'skip-link';
      skipLink.textContent = 'Skip to main content';
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    // Add main landmark if needed
    var mainContent = document.querySelector('main, [role="main"]');
    if (!mainContent) {
      var container = document.querySelector('.container');
      if (container) {
        container.id = 'main-content';
        container.setAttribute('role', 'main');
      }
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      // Alt + R: Toggle reading mode
      if (e.altKey && e.key === 'r' && window.SignalNestReadingMode) {
        e.preventDefault();
        window.SignalNestReadingMode.toggle();
      }
      
      // Alt + B: Toggle bookmark (on article pages)
      if (e.altKey && e.key === 'b') {
        var bookmarkBtn = document.querySelector('[data-bookmark-toggle]');
        if (bookmarkBtn) {
          e.preventDefault();
          bookmarkBtn.click();
        }
      }
      
      // Alt + S: Focus search
      if (e.altKey && e.key === 's') {
        var searchInput = document.querySelector('input[type="search"], #q');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    });
    
    // ARIA live region for dynamic updates
    if (!document.querySelector('[role="status"][aria-live="polite"]')) {
      var liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'visually-hidden';
      liveRegion.id = 'live-region';
      document.body.appendChild(liveRegion);
    }
  }

  // Initialize all enhanced features
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initImageLightbox();
      initEnhancedTOC();
      initRelatedCarousel();
      initSyntaxHighlight();
      initAccessibilityEnhancements();
    });
  } else {
    initImageLightbox();
    initEnhancedTOC();
    initRelatedCarousel();
    initSyntaxHighlight();
    initAccessibilityEnhancements();
  }


  /* ---------------- Service Worker Registration ---------------- */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }
    
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (registration) {
        console.log('ServiceWorker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(function () {
          registration.update();
        }, 60000 * 60); // Check every hour
        
        // Notify user of updates
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              var message = 'New content available. Refresh to update.';
              var liveRegion = document.getElementById('live-region');
              if (liveRegion) {
                liveRegion.textContent = message;
              }
              
              // Show update notification
              if (window.confirm(message)) {
                window.location.reload();
              }
            }
          });
        });
      }).catch(function (error) {
        console.log('ServiceWorker registration failed:', error);
      });
    });
  }
  
  registerServiceWorker();

  /* ---------------- Performance Optimizations ---------------- */
  
  // Lazy load images with native loading or intersection observer fallback
  function initLazyLoading() {
    var lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src]');
    
    // Use native lazy loading if available
    if ('loading' in HTMLImageElement.prototype) {
      lazyImages.forEach(function (img) {
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
      });
      return;
    }
    
    // Fallback to Intersection Observer
    if ('IntersectionObserver' in window) {
      var imageObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });
      
      lazyImages.forEach(function (img) {
        imageObserver.observe(img);
      });
    } else {
      // Fallback: load all images
      lazyImages.forEach(function (img) {
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
      });
    }
  }
  
  // Preconnect to external domains
  function addResourceHints() {
    var hints = [
      { rel: 'preconnect', href: 'https://www.google-analytics.com' },
      { rel: 'dns-prefetch', href: 'https://www.google-analytics.com' }
    ];
    
    var head = document.head;
    hints.forEach(function (hint) {
      var link = document.createElement('link');
      link.rel = hint.rel;
      link.href = hint.href;
      if (hint.rel === 'preconnect') {
        link.crossOrigin = 'anonymous';
      }
      head.appendChild(link);
    });
  }
  
  // Prefetch visible links on hover
  function initLinkPrefetch() {
    if (!('IntersectionObserver' in window)) return;
    
    var prefetched = new Set();
    var prefetchLimit = 3;
    var prefetchCount = 0;
    
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && prefetchCount < prefetchLimit) {
          var link = entry.target;
          var href = link.href;
          
          if (!prefetched.has(href) && href.startsWith(location.origin)) {
            // Prefetch on hover
            link.addEventListener('mouseenter', function prefetch() {
              if (prefetched.has(href)) return;
              
              var prefetchLink = document.createElement('link');
              prefetchLink.rel = 'prefetch';
              prefetchLink.href = href;
              document.head.appendChild(prefetchLink);
              
              prefetched.add(href);
              prefetchCount++;
              link.removeEventListener('mouseenter', prefetch);
            }, { once: true });
          }
          
          observer.unobserve(link);
        }
      });
    });
    
    // Observe article links
    document.querySelectorAll('.card a, .trend-list a').forEach(function (link) {
      observer.observe(link);
    });
  }
  
  // Debounce resize events
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Re-initialize carousel if needed
      var event = new CustomEvent('optimizedResize');
      window.dispatchEvent(event);
    }, 250);
  }, { passive: true });
  
  // Initialize performance optimizations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initLazyLoading();
      addResourceHints();
      setTimeout(initLinkPrefetch, 1000); // Delay to prioritize critical content
    });
  } else {
    initLazyLoading();
    addResourceHints();
    setTimeout(initLinkPrefetch, 1000);
  }

  /* ---------------- Web Vitals Tracking (Optional) ---------------- */
  function trackWebVitals() {
    // Track Core Web Vitals if supported
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      try {
        var lcp = new PerformanceObserver(function (list) {
          var entries = list.getEntries();
          var lastEntry = entries[entries.length - 1];
          console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
        });
        lcp.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) { /* ignore */ }
      
      // First Input Delay
      try {
        var fid = new PerformanceObserver(function (list) {
          var entries = list.getEntries();
          entries.forEach(function (entry) {
            console.log('FID:', entry.processingStart - entry.startTime);
          });
        });
        fid.observe({ entryTypes: ['first-input'] });
      } catch (e) { /* ignore */ }
      
      // Cumulative Layout Shift
      try {
        var clsScore = 0;
        var cls = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
              console.log('CLS:', clsScore);
            }
          });
        });
        cls.observe({ entryTypes: ['layout-shift'] });
      } catch (e) { /* ignore */ }
    }
  }
  
  /* ---------------- Cookie Consent & Privacy Controls ---------------- */
  var COOKIE_KEY = 'signalnest-cookie-consent';
  function initCookieConsent() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    try {
      var saved = localStorage.getItem(COOKIE_KEY);
      if (!saved) {
        banner.hidden = false;
        banner.style.display = 'flex';
      } else {
        banner.hidden = true;
        banner.style.display = 'none';
        if (saved === 'all' && window.gtag) {
          window.gtag('consent', 'update', { analytics_storage: 'granted' });
        }
      }
    } catch (e) {
      banner.hidden = false;
      banner.style.display = 'flex';
    }

    var btnAccept = document.getElementById('btn-cookie-accept');
    var btnEssential = document.getElementById('btn-cookie-essential');

    if (btnAccept) {
      btnAccept.addEventListener('click', function () {
        try { localStorage.setItem(COOKIE_KEY, 'all'); } catch (e) { }
        banner.hidden = true;
        banner.style.display = 'none';
        if (window.gtag) {
          window.gtag('consent', 'update', { analytics_storage: 'granted' });
        }
      });
    }

    if (btnEssential) {
      btnEssential.addEventListener('click', function () {
        try { localStorage.setItem(COOKIE_KEY, 'essential'); } catch (e) { }
        banner.hidden = true;
        banner.style.display = 'none';
        if (window.gtag) {
          window.gtag('consent', 'update', { analytics_storage: 'denied' });
        }
      });
    }
  }

  /* ---------------- Contact Form Handling ---------------- */
  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;
    var status = document.getElementById('contact-status');
    var btn = document.getElementById('contact-submit-btn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (document.getElementById('contact-name') || {}).value || '';
      var email = (document.getElementById('contact-email') || {}).value || '';
      var subject = (document.getElementById('contact-subject') || {}).value || '';
      var message = (document.getElementById('contact-message') || {}).value || '';

      if (!name.trim() || !email.trim() || !message.trim()) {
        if (status) {
          status.textContent = 'Please fill out all required fields.';
          status.style.color = '#ef4444';
        }
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        if (status) {
          status.textContent = 'Please provide a valid email address.';
          status.style.color = '#ef4444';
        }
        return;
      }

      if (btn) btn.disabled = true;
      if (status) {
        status.textContent = 'Sending message…';
        status.style.color = 'var(--brand)';
      }

      setTimeout(function () {
        form.reset();
        if (btn) btn.disabled = false;
        if (status) {
          status.textContent = '✓ Thank you — your editorial message has been dispatched to the review desk.';
          status.style.color = 'var(--brand-strong)';
        }
      }, 700);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initCookieConsent();
      initContactForm();
    });
  } else {
    initCookieConsent();
    initContactForm();
  }

  // Track vitals in production only
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    trackWebVitals();
  }

})();
