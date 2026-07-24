(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return root.dataset.theme || (media.matches ? 'dark' : 'light');
  }

  function updateToggle() {
    if (!toggle) return;
    var isDark = currentTheme() === 'dark';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.setAttribute('aria-pressed', String(isDark));
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
      updateToggle();
    });
    updateToggle();
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealItems = document.querySelectorAll('[data-reveal]');

  if (!reducedMotion && 'IntersectionObserver' in window) {
    root.classList.add('has-reveal');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px' });

    revealItems.forEach(function (item, index) {
      item.style.setProperty('--reveal-delay', (index % 3) * 70 + 'ms');
      observer.observe(item);
    });
  }

  var articleImages = document.querySelectorAll('.post-content img');

  if (articleImages.length && typeof HTMLDialogElement !== 'undefined') {
    var lightbox = document.createElement('dialog');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('aria-label', 'Image preview');
    lightbox.innerHTML = '<button class="lightbox__close" type="button" aria-label="Close image preview">&times;</button>' +
      '<figure><img class="lightbox__image" alt=""><figcaption class="lightbox__caption"></figcaption></figure>';
    document.body.appendChild(lightbox);

    var lightboxImage = lightbox.querySelector('.lightbox__image');
    var lightboxCaption = lightbox.querySelector('.lightbox__caption');
    var closeButton = lightbox.querySelector('.lightbox__close');
    var triggerImage = null;
    var closeTimer = null;

    function openLightbox(image) {
      triggerImage = image;
      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt || '';
      lightboxCaption.textContent = image.alt || '';
      lightboxCaption.hidden = !image.alt;
      lightbox.showModal();
      window.requestAnimationFrame(function () {
        lightbox.classList.add('is-open');
        closeButton.focus();
      });
    }

    function closeLightbox() {
      if (!lightbox.open) return;
      lightbox.classList.remove('is-open');
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function () {
        lightbox.close();
        lightboxImage.removeAttribute('src');
        if (triggerImage) triggerImage.focus();
      }, reducedMotion ? 0 : 220);
    }

    articleImages.forEach(function (image) {
      if (image.closest('a') || image.closest('.no-lightbox')) return;
      image.classList.add('is-zoomable');
      image.setAttribute('tabindex', '0');
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', (image.alt ? 'Enlarge image: ' + image.alt : 'Enlarge image'));
      image.addEventListener('click', function () { openLightbox(image); });
      image.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(image);
        }
      });
    });

    closeButton.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });
    lightbox.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeLightbox();
    });
  }

  var toc = document.querySelector('.post-toc');
  var article = document.querySelector('.post-content');

  if (toc && article) {
    var headings = Array.prototype.slice.call(article.querySelectorAll('h1, h2'));

    if (headings.length > 1) {
      var tocList = toc.querySelector('ol');
      var usedIds = {};

      headings.forEach(function (heading, index) {
        var baseId = heading.id || heading.textContent.toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-');
        var id = baseId || 'section-' + (index + 1);
        var suffix = 2;
        while (usedIds[id] || (document.getElementById(id) && document.getElementById(id) !== heading)) {
          id = baseId + '-' + suffix;
          suffix += 1;
        }
        usedIds[id] = true;
        heading.id = id;

        var item = document.createElement('li');
        item.className = heading.tagName === 'H2' ? 'is-subsection' : 'is-section';
        var link = document.createElement('a');
        link.href = '#' + id;
        var labelSource = heading.cloneNode(true);
        labelSource.querySelectorAll('.katex-mathml').forEach(function (node) { node.remove(); });
        link.textContent = labelSource.textContent.replace(/\s+/g, ' ').trim();
        item.appendChild(link);
        tocList.appendChild(item);
      });

      toc.hidden = false;
      var tocMedia = window.matchMedia('(max-width: 1050px)');
      var syncTocMode = function () { toc.open = !tocMedia.matches; };
      syncTocMode();
      if (tocMedia.addEventListener) tocMedia.addEventListener('change', syncTocMode);

      toc.addEventListener('click', function (event) {
        if (event.target.closest('a') && tocMedia.matches) toc.open = false;
      });

      if ('IntersectionObserver' in window) {
        var tocLinks = Array.prototype.slice.call(toc.querySelectorAll('a'));
        var visibleHeadings = {};
        var setActiveLink = function () {
          var active = headings[0];
          headings.forEach(function (heading) {
            if (visibleHeadings[heading.id] || heading.getBoundingClientRect().top <= 150) active = heading;
          });
          tocLinks.forEach(function (link) {
            var isActive = link.getAttribute('href') === '#' + active.id;
            link.classList.toggle('is-active', isActive);
            if (isActive) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
          });
        };
        var tocObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { visibleHeadings[entry.target.id] = entry.isIntersecting; });
          setActiveLink();
        }, { rootMargin: '-110px 0px -68% 0px' });
        headings.forEach(function (heading) { tocObserver.observe(heading); });
        setActiveLink();
      }
    }
  }
}());
