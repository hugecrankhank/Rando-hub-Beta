/*
 * ui.js — draws an EmoTracker pack's layouts (emo.js holds the model).
 *
 * Layout types: container, dock, array, group, itemgrid, item, layout,
 * map, recentpins, button_popup, tabbed, text, image, canvas.
 * Items: left click / right click as in EmoTracker. Map locations: click for
 * the location's sections (click a chest to mark it, right click to undo),
 * right click a location to clear it, 📌 to pin it.
 */
(function () {
  'use strict';
  var E = window.EmoWeb, A = E.A;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  // ── bits ──────────────────────────────────────────────────────────────────
  function thickness(s) {
    if (s === undefined || s === null || s === '') return null;
    var p = String(s).split(',').map(function (x) { return parseFloat(x) || 0; });
    if (p.length === 1) return [p[0], p[0], p[0], p[0]];
    if (p.length === 2) return [p[0], p[1], p[0], p[1]];
    return [p[0], p[1], p[2] || 0, p[3] || 0];
  }
  function px(t) { return t ? t[1] + 'px ' + t[2] + 'px ' + t[3] + 'px ' + t[0] + 'px' : ''; }
  // "#AARRGGBB" (XAML) → rgba
  function color(c) {
    if (!c) return '';
    c = String(c).trim();
    var m = /^#([0-9a-f]{8})$/i.exec(c);
    if (m) {
      var h = m[1], a = parseInt(h.slice(0, 2), 16) / 255;
      return 'rgba(' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + parseInt(h.slice(6, 8), 16) + ',' + a.toFixed(3) + ')';
    }
    return c;
  }
  var CHEST = {
    closed: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="5" width="14" height="10" rx="1" fill="#a0632b" stroke="#3b2210"/><rect x="1" y="3" width="14" height="5" rx="2" fill="#c27c3a" stroke="#3b2210"/><rect x="6.5" y="6.5" width="3" height="3" fill="#f2d14b" stroke="#3b2210" stroke-width=".6"/></svg>'),
    open: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="7" width="14" height="8" rx="1" fill="#6b4520" stroke="#2a180b"/><rect x="2" y="8" width="12" height="2" fill="#1b1209"/><path d="M1 7 L3 1 H13 L15 7 Z" fill="#8a5a2b" stroke="#2a180b"/></svg>'),
  };

  function paintIcon(box, ic, size) {
    var sig = ic ? JSON.stringify(ic) : '';
    if (box.__sig === sig) return;
    box.__sig = sig;
    box.textContent = '';
    if (!ic) return;
    if (ic.chest) {
      var c = el('img'); c.src = CHEST[ic.chest]; c.draggable = false;
      if (ic.dim) c.style.filter = 'grayscale(1) brightness(.55)';
      box.appendChild(c); return;
    }
    var i = el('img'); i.src = ic.src; i.draggable = false;
    if (ic.filter && ic.filter.length) i.style.filter = ic.filter.join(' ');
    box.appendChild(i);
    (ic.overlays || []).forEach(function (o) { var x = el('img', 'ov'); x.src = o; x.draggable = false; box.appendChild(x); });
  }

  var itemViews = [];
  function itemView(it, w, h, badgeSize) {
    // Item size (the menu's "Items"): the pack's sizes times E.itemScale,
    // whole pixels so the pixel art stays sharp
    var k = E.itemScale || 1;
    w = Math.round(w * k); h = Math.round(h * k);
    if (badgeSize) badgeSize = Math.round(badgeSize * Math.min(k, 1.5));
    var v = el('div', 'it');
    v.style.width = w + 'px'; v.style.height = h + 'px';
    if (!it) { v.classList.add('blank'); return v; }
    v.title = it.Name;
    var pic = el('div', 'pic'), badge = el('span', 'badge');
    if (badgeSize) badge.style.fontSize = badgeSize + 'px';
    v.appendChild(pic); v.appendChild(badge);
    if (it.type === 'static') v.classList.add('static');
    v.addEventListener('click', function (e) { e.preventDefault(); it.left(); });
    v.addEventListener('contextmenu', function (e) { e.preventDefault(); it.right(); });
    var view = { it: it, pic: pic, badge: badge, size: w };
    itemViews.push(view);
    paintItem(view);
    return v;
  }
  function paintItem(view) {
    var it = view.it;
    paintIcon(view.pic, it.icon(), view.size);
    var b = it.badgeOf ? it.badgeOf() : null;
    var t = b ? b.text : '';
    if (view.badge.textContent !== t) view.badge.textContent = t;
    view.badge.style.color = b ? b.color : '';
  }

  // ── layouts ───────────────────────────────────────────────────────────────
  function common(node, d) {
    var m = thickness(d.margin);
    if (m) node.style.margin = px(m);
    if (d.background) node.style.background = color(d.background);
    if (d.width > 0) node.style.width = d.width + 'px';
    if (d.height > 0) node.style.height = d.height + 'px';
    if (d.min_width > 0) node.style.minWidth = d.min_width + 'px';
    if (d.min_height > 0) node.style.minHeight = d.min_height + 'px';
    if (d.max_width > 0) node.style.maxWidth = d.max_width + 'px';
    if (d.max_height > 0) node.style.maxHeight = d.max_height + 'px';
    if (d.h_alignment) node.dataset.h = String(d.h_alignment).toLowerCase();
    if (d.v_alignment) node.dataset.v = String(d.v_alignment).toLowerCase();
    if (d.dropshadow) node.classList.add('shadow');
    return node;
  }
  function build(d, depth) {
    depth = depth || 0;
    if (!d || depth > 40) return el('div');
    if (Array.isArray(d)) return build({ type: 'array', content: d }, depth);
    var f = BUILD[String(d.type || '').toLowerCase()];
    if (!f) { var x = el('div', 'unsupported'); x.title = 'Layout type not supported: ' + d.type; return x; }
    return common(f(d, depth + 1), d);
  }
  var BUILD = {};
  BUILD.container = function (d, depth) {
    var n = el('div', 'l-container');
    if (d.content) n.appendChild(build(d.content, depth));
    return n;
  };
  // WPF DockPanel: each child takes an edge (dock, default left); the last fills.
  BUILD.dock = function (d, depth) {
    var kids = (d.content || []).slice();
    function nest(list) {
      if (list.length === 1) { var only = build(list[0], depth); only.classList.add('fill'); return only; }
      var first = list[0], side = String(first.dock || 'left').toLowerCase();
      var box = el('div', 'l-dock ' + (side === 'left' || side === 'right' ? 'row' : 'col'));
      var a = build(first, depth); a.classList.add('docked');
      var rest = el('div', 'l-dock-rest');
      rest.appendChild(nest(list.slice(1)));
      if (side === 'right' || side === 'bottom') { box.appendChild(rest); box.appendChild(a); }
      else { box.appendChild(a); box.appendChild(rest); }
      return box;
    }
    if (!kids.length) return el('div', 'l-dock');
    var n = el('div', 'l-dock-root');
    n.appendChild(nest(kids));
    return n;
  };
  BUILD.array = function (d, depth) {
    var n = el('div', 'l-array ' + (String(d.orientation).toLowerCase() === 'horizontal' ? 'row' : 'col'));
    if (String(d.style).toLowerCase() === 'wrap') n.classList.add('wrap');
    (d.content || []).forEach(function (c) { n.appendChild(build(c, depth)); });
    return n;
  };
  BUILD.group = function (d, depth) {
    var n = el('div', 'l-group'), head = el('div', 'l-head');
    head.style.background = color(d.header_background || '#212121');
    head.appendChild(el('span', 'l-title', d.header || ''));
    if (d.header_content) { var hc = build(d.header_content, depth); hc.classList.add('l-headc'); head.appendChild(hc); }
    if (d.header !== undefined || d.header_content) n.appendChild(head);
    var body = el('div', 'l-body');
    if (d.content) body.appendChild(build(d.content, depth));
    n.appendChild(body);
    return n;
  };
  BUILD.itemgrid = function (d) {
    var size = d.item_size || 32, w = d.item_width || size, h = d.item_height || size;
    var im = thickness(d.item_margin !== undefined ? d.item_margin : '5');
    var n = el('div', 'l-grid');
    (d.rows || []).forEach(function (row) {
      var r = el('div', 'l-row');
      (row || []).forEach(function (code) {
        var v = itemView(code ? E.findItem(code) : null, w, h, d.badge_font_size);
        v.style.margin = px(im);
        r.appendChild(v);
      });
      n.appendChild(r);
    });
    return n;
  };
  BUILD.item = function (d) {
    var size = d.item_size || 32;
    return itemView(E.findItem(d.item), d.item_width || d.width || size, d.item_height || d.height || size);
  };
  BUILD.layout = function (d, depth) { return build(E.layouts[d.key], depth); };
  BUILD.text = function (d) { var n = el('div', 'l-text', d.text || ''); if (d.font_size > 0) n.style.fontSize = d.font_size + 'px'; return n; };
  BUILD.image = function (d) {
    var n = el('div', 'l-image'), ic = E.imageRef(d.image, d.image_filter);
    paintIcon(n, ic);
    return n;
  };
  BUILD.canvas = function (d, depth) {
    var n = el('div', 'l-canvas');
    (d.content || []).forEach(function (c) {
      var k = build(c, depth); k.style.position = 'absolute';
      if (c.canvas_left >= 0) k.style.left = c.canvas_left + 'px';
      if (c.canvas_top >= 0) k.style.top = c.canvas_top + 'px';
      n.appendChild(k);
    });
    return n;
  };
  BUILD.tabbed = function (d, depth) {
    var n = el('div', 'l-tabs'), bar = el('div', 'l-tabbar'), body = el('div', 'l-tabbody');
    var tabs = d.tabs || [];
    tabs.forEach(function (t, i) {
      var b = el('button', 'l-tab', t.title || ('Tab ' + (i + 1)));
      var c = build(t.content, depth); c.hidden = i !== 0; body.appendChild(c);
      if (!i) b.classList.add('on');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(body.children, function (x, j) { x.hidden = j !== i; });
        Array.prototype.forEach.call(bar.children, function (x, j) { x.classList.toggle('on', j === i); });
        refitMaps();
      });
      bar.appendChild(b);
    });
    n.appendChild(bar); n.appendChild(body);
    return n;
  };
  BUILD.button_popup = function (d, depth) {
    var n = el('div', 'l-popbtn'), b = el('button', 'l-gear', String(d.style).toLowerCase() === 'settings' ? '⚙' : '▾');
    b.title = 'Settings';
    var pop = el('div', 'l-popup'); pop.hidden = true;
    pop.style.background = color(d.popup_background || '#ff212121');
    pop.appendChild(build(E.layouts[d.layout], depth));
    b.addEventListener('click', function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; });
    document.addEventListener('click', function (e) { if (!pop.contains(e.target)) pop.hidden = true; });
    n.appendChild(b); n.appendChild(pop);
    return n;
  };
  BUILD.recentpins = function (d) {
    var n = el('div', 'l-pins ' + (String(d.orientation).toLowerCase() === 'horizontal' ? 'row' : 'col'));
    pinBoxes.push(n);
    paintPins(n);
    return n;
  };
  BUILD.map = function (d) {
    var n = el('div', 'l-maps');
    var names = d.maps || null;
    n.__maps = (names ? names.map(function (k) { return E.maps.filter(function (m) { return m.name === k; })[0]; }) : E.maps).filter(Boolean);
    n.__orient = String(d.orientation || 'auto').toLowerCase();
    n.__views = n.__maps.map(function (m) { var v = mapView(m); n.appendChild(v.box); return v; });
    mapPanels.push(n);
    return n;
  };

  // ── maps ──────────────────────────────────────────────────────────────────
  var SVGNS = 'http://www.w3.org/2000/svg';
  var mapPanels = [], pinBoxes = [];
  function mapView(m) {
    var box = el('div', 'map'), svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var img = document.createElementNS(SVGNS, 'image');
    img.setAttribute('href', m.img.src);
    if (m.img.filter.length) img.style.filter = m.img.filter.join(' ');
    svg.appendChild(img);
    var g = document.createElementNS(SVGNS, 'g');
    svg.appendChild(g);
    box.appendChild(svg);
    var v = { m: m, box: box, svg: svg, g: g, pins: [] };
    var probe = new Image();
    probe.onload = function () {
      m.w = probe.naturalWidth; m.h = probe.naturalHeight;
      svg.setAttribute('viewBox', '0 0 ' + m.w + ' ' + m.h);
      img.setAttribute('width', m.w); img.setAttribute('height', m.h);
      box.style.aspectRatio = m.w + ' / ' + m.h;
      refitMaps();
    };
    probe.src = m.img.src;
    E.locations.forEach(function (loc) {
      loc.mapLocations.forEach(function (ml) {
        if (ml.map !== m.name) return;
        var size = ml.size || m.size, r = document.createElementNS(SVGNS, 'rect');
        r.setAttribute('x', ml.x - size / 2); r.setAttribute('y', ml.y - size / 2);
        r.setAttribute('width', size); r.setAttribute('height', size);
        r.setAttribute('stroke', '#000'); r.setAttribute('stroke-width', m.border);
        r.setAttribute('class', 'pin');
        // the item you've marked as being here, on the square's corner
        var cap = document.createElementNS(SVGNS, 'image');
        cap.setAttribute('x', ml.x - size * 0.05); cap.setAttribute('y', ml.y - size * 1.05);
        cap.setAttribute('width', size * 1.1); cap.setAttribute('height', size * 1.1);
        cap.setAttribute('class', 'cap'); cap.style.display = 'none';
        pinEvents(r, loc);
        g.appendChild(r); g.appendChild(cap);        v.pins.push({ loc: loc, ml: ml, r: r, cap: cap });
      });
    });
    return v;
  }
  function paintMaps() {
    mapPanels.forEach(function (p) {
      p.__views.forEach(function (v) {
        v.pins.forEach(function (pin) {
          var loc = pin.loc;
          var show = (!pin.ml.vis.length || E.ignoreLogic || visOk(pin.ml.vis)) && (loc.hasVisible !== false || !loc.Sections.length);
          if (E.hideCleared && loc.level === A.Cleared) show = false;
          pin.r.style.display = show ? '' : 'none';
          pin.r.setAttribute('fill', E.COLORS[loc.level]);
          var c = null;
          loc.Sections.some(function (sec) { if (sec.captured && sec.visible) { c = E.findItem(sec.captured); return true; } return false; });
          var ic = c && c.activeIcon();
          if (ic && show) {
            if (pin.cap.getAttribute('href') !== ic.src) pin.cap.setAttribute('href', ic.src);
            pin.cap.style.display = '';
          } else pin.cap.style.display = 'none';
        });
      });
    });
  }
  function visOk(rules) {
    return rules.some(function (r) {
      // same as a section's visibility: Normal or better
      return E.ruleLevelFor ? E.ruleLevelFor(r) >= A.Normal : true;
    });
  }
  // Both worlds side by side or stacked, whichever shows them bigger.
  function refitMaps() {
    mapPanels.forEach(function (p) {
      var maps = p.__views.filter(function (v) { return v.m.w; });
      if (!maps.length || !p.isConnected) return;
      var W = p.clientWidth, H = p.clientHeight, n = maps.length, ar = maps[0].m.w / maps[0].m.h;
      if (!W || !H) return;
      var row = p.__orient === 'horizontal' || (p.__orient !== 'vertical' && Math.min(W / n, H * ar) >= Math.min(W, H / n * ar));
      p.classList.toggle('row', row); p.classList.toggle('col', !row);
      var cw = row ? W / n : W, ch = row ? H : H / n;
      var w = Math.floor(Math.min(cw, ch * ar) - 2);
      maps.forEach(function (v) { v.box.style.width = Math.max(40, w) + 'px'; });
    });
  }
  window.addEventListener('resize', function () { clearTimeout(refitMaps.t); refitMaps.t = setTimeout(refitMaps, 60); });

  // ── pointer handling on the map ───────────────────────────────────────────
  // Mouse: pointing at a square shows its checks (they stay while the mouse
  // is on the square or the card); a click keeps the card open. Right click
  // marks which item is there. Touch: tap for the card, hold for the marker.
  var hoverT = null, longT = null, longFired = false;
  var hoverable = (function () { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } })();
  function pinEvents(r, loc) {
    r.addEventListener('click', function (e) {
      e.stopPropagation();
      if (longFired) { longFired = false; return; }
      openPopup(loc, e.clientX, e.clientY, true);
    });
    r.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); openPicker(loc, null, e.clientX, e.clientY); });
    r.addEventListener('mouseenter', function (e) {
      if (!hoverable) return;
      clearTimeout(hoverT);
      if (popup && popup.__sticky) return;
      var x = e.clientX, y = e.clientY;
      hoverT = setTimeout(function () { if (!popup || !popup.__sticky) openPopup(loc, x, y, false); }, 120);
    });
    r.addEventListener('mouseleave', function () { if (hoverable) hoverCloseSoon(); });
    r.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      longFired = false;
      var x = e.clientX, y = e.clientY;
      clearTimeout(longT);
      longT = setTimeout(function () { longFired = true; openPicker(loc, null, x, y); }, 500);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { r.addEventListener(t, function () { clearTimeout(longT); }); });
  }
  function hoverCloseSoon() {
    clearTimeout(hoverT);
    hoverT = setTimeout(function () {
      if (popup && !popup.__sticky && !popup.matches(':hover')) closePopup();
    }, 280);
  }
  // long press on any element (section rows in cards) → fn(x, y)
  function longPress(node, fn) {
    var t = null, fired = false;
    node.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      fired = false;
      var x = e.clientX, y = e.clientY;
      t = setTimeout(function () { fired = true; fn(x, y); }, 500);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (k) { node.addEventListener(k, function () { clearTimeout(t); }); });
    node.addEventListener('click', function (e) { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // ── "what's here?": mark the item at a location ───────────────────────────
  var picker = null;
  function captureCodes() {
    var L = E.layouts.tracker_capture_item, out = [];
    (function walk(d) {
      if (!d) return;
      if (Array.isArray(d)) { d.forEach(walk); return; }
      if (d.rows) d.rows.forEach(function (r) { (r || []).forEach(function (c) { if (c && out.indexOf(c) < 0) out.push(c); }); });
      if (d.content) walk(d.content);
    })(L);
    if (!out.length) E.items.forEach(function (it) { if (it.type !== 'static' && it.type !== 'sectionchests' && it.codes.size) out.push(Array.from(it.codes)[0]); });
    return out;
  }
  function openPicker(loc, sec, x, y) {
    closePicker();
    var secs = loc.Sections.filter(function (s) { return s.visible; });
    if (!secs.length) return;
    sec = sec || secs.filter(function (s) { return s.unclaimed(); })[0] || secs[0];
    picker = el('div', 'pick');
    var head = el('div', 'pop-head');
    head.appendChild(el('span', 'pop-title', 'What\u2019s at ' + loc.Name + '?'));
    var xb = el('button', 'pop-btn', '✕'); xb.addEventListener('click', closePicker); head.appendChild(xb);
    picker.appendChild(head);
    if (secs.length > 1) {
      var sel = el('select', 'pick-sec');
      secs.forEach(function (s, i) { var o = el('option', '', s.Name); o.value = i; if (s === sec) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { sec = secs[+sel.value]; });
      picker.appendChild(sel);
    }
    var grid = el('div', 'pick-grid');
    captureCodes().forEach(function (code) {
      var it = E.findItem(code);
      if (!it) return;
      var b = el('button', 'pick-it'); b.title = it.Name;
      var pic = el('span', 'pic'); paintIcon(pic, it.activeIcon()); b.appendChild(pic);
      b.addEventListener('click', function (e) { e.stopPropagation(); sec.capture(code); closePicker(); });
      grid.appendChild(b);
    });
    picker.appendChild(grid);
    var clr = el('button', 'pop-btn', 'Clear the mark');
    clr.addEventListener('click', function (e) { e.stopPropagation(); sec.capture(null); closePicker(); });
    picker.appendChild(clr);
    picker.addEventListener('click', function (e) { e.stopPropagation(); });
    picker.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.body.appendChild(picker);
    var r = picker.getBoundingClientRect();
    picker.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, x - r.width / 2)) + 'px';
    picker.style.top = Math.max(4, Math.min(window.innerHeight - r.height - 4, y + 12)) + 'px';
  }
  function closePicker() { if (picker) picker.remove(); picker = null; }
  document.addEventListener('click', closePicker);

  // ── location popup and pinned locations ───────────────────────────────────
  var popup = null, popupLoc = null;
  function sectionRows(loc, box, compact) {
    loc.Sections.forEach(function (s) {
      if (!s.visible) return;
      var row = el('div', 'sec');
      var name = el('span', 'sec-name', s.Name || loc.Name);
      name.style.color = s.unclaimed() ? E.COLORS[s.level] : '#888';
      row.appendChild(name);
      var chests = el('span', 'sec-chests');
      var n = s.ChestCount;
      if (n > 0 && n <= 4 && !compact) {
        for (var i = 0; i < n; i++) (function (i) {
          var opened = i >= s.AvailableChestCount;
          var c = el('img', 'chest'); c.src = CHEST[opened ? 'open' : 'closed']; c.draggable = false;
          c.title = opened ? 'Collected (right click to undo)' : 'Click when collected';
          chests.appendChild(c);
        })(i);
      } else if (n > 0) {
        var c1 = el('img', 'chest'); c1.src = CHEST[s.AvailableChestCount ? 'closed' : 'open']; chests.appendChild(c1);
        chests.appendChild(el('span', 'cnt', s.AvailableChestCount + '/' + n));
      }
      var h = s.hosted();
      if (h) {
        var hv = el('span', 'hosted'), pic = el('span', 'pic'); paintIcon(pic, h.icon(), 24); hv.appendChild(pic);
        hv.title = h.Name;
        hv.addEventListener('click', function (e) { e.stopPropagation(); h.left(); });
        hv.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); h.right(); });
        chests.appendChild(hv);
      }
      chests.addEventListener('click', function (e) {
        if (e.target.closest('.hosted')) return;
        e.stopPropagation();
        loc.ModifiedByUser = true;
        if (s.AvailableChestCount > 0) s.AvailableChestCount--; else if (!n) s.clear();
      });
      chests.addEventListener('contextmenu', function (e) {
        if (e.target.closest('.hosted')) return;
        e.preventDefault(); e.stopPropagation();
        loc.ModifiedByUser = true;
        if (s.AvailableChestCount < n) s.AvailableChestCount++;
      });
      // the marked item, or a "+" to mark one
      var mark = el('span', 'mark');
      if (s.captured && E.findItem(s.captured)) {
        var mi = E.findItem(s.captured), mp = el('span', 'pic'); paintIcon(mp, mi.activeIcon()); mark.appendChild(mp);
        mark.title = mi.Name + ' is here (click to change)';
      } else { mark.textContent = '+'; mark.classList.add('empty'); mark.title = 'Mark which item is here'; }
      mark.addEventListener('click', function (e) { e.stopPropagation(); openPicker(loc, s, e.clientX, e.clientY); });
      row.appendChild(chests);
      row.appendChild(mark);
      row.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); openPicker(loc, s, e.clientX, e.clientY); });
      longPress(row, function (x, y) { openPicker(loc, s, x, y); });
      box.appendChild(row);
    });
  }
  function openPopup(loc, x, y, sticky) {
    if (popup && popupLoc === loc) { if (sticky) popup.__sticky = true; return; }
    closePopup();
    popupLoc = loc;
    popup = el('div', 'loc-pop');
    popup.__sticky = !!sticky;
    popup.addEventListener('mouseleave', function () { if (!popup.__sticky) hoverCloseSoon(); });
    popup.addEventListener('mouseenter', function () { clearTimeout(hoverT); });
    // using the card keeps it open
    popup.addEventListener('click', function (e) { e.stopPropagation(); if (popup) popup.__sticky = true; });
    paintPopup();
    document.body.appendChild(popup);
    var r = popup.getBoundingClientRect();
    popup.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, x + 10)) + 'px';
    popup.style.top = Math.max(4, Math.min(window.innerHeight - r.height - 4, y + 10)) + 'px';
  }
  function paintPopup() {
    if (!popup) return;
    var loc = popupLoc, sticky = popup.__sticky;
    popup.textContent = '';
    popup.__sticky = sticky;
    var head = el('div', 'pop-head');
    var t = el('span', 'pop-title', loc.Name); t.style.color = E.COLORS[loc.level]; head.appendChild(t);
    var pinned = E.pinned.indexOf(loc) >= 0;
    var pb = el('button', 'pop-btn' + (pinned ? ' on' : ''), '📌'); pb.title = pinned ? 'Unpin' : 'Pin to Pinned Locations';
    pb.addEventListener('click', function (e) { e.stopPropagation(); togglePin(loc); });
    var cb = el('button', 'pop-btn', '✓'); cb.title = 'Mark everything here collected';
    cb.addEventListener('click', function (e) { e.stopPropagation(); loc.clearAll(); });
    var xb = el('button', 'pop-btn', '✕'); xb.title = 'Close';
    xb.addEventListener('click', function (e) { e.stopPropagation(); closePopup(); });
    head.appendChild(pb); head.appendChild(cb); head.appendChild(xb);
    popup.appendChild(head);
    sectionRows(loc, popup, false);
  }
  function closePopup() { if (popup) popup.remove(); popup = null; popupLoc = null; }
  document.addEventListener('click', closePopup);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });
  function togglePin(loc) {
    var i = E.pinned.indexOf(loc);
    if (i >= 0) E.pinned.splice(i, 1); else E.pinned.unshift(loc);
    E.changed();
  }
  function paintPins(box) {
    box.textContent = '';
    if (!E.pinned.length) { box.appendChild(el('div', 'pins-empty', 'Click a location on the map, then 📌 to pin it here.')); return; }
    E.pinned.forEach(function (loc) {
      var card = el('div', 'pin-card'), head = el('div', 'pop-head');
      var t = el('span', 'pop-title', loc.Name); t.style.color = E.COLORS[loc.level]; head.appendChild(t);
      var xb = el('button', 'pop-btn', '✕'); xb.title = 'Unpin';
      xb.addEventListener('click', function () { togglePin(loc); });
      head.appendChild(xb); card.appendChild(head);
      sectionRows(loc, card, true);
      box.appendChild(card);
    });
  }

  // ── repaint on every change ───────────────────────────────────────────────
  function repaint() {
    // pinned locations drop off once cleared (the pack's auto_unpin_on_clear)
    if (E.settings.auto_unpin_on_clear !== false) E.pinned = E.pinned.filter(function (l) { return l.level !== A.Cleared; });
    itemViews.forEach(paintItem);
    paintMaps();
    pinBoxes.forEach(paintPins);
    if (popup) paintPopup();
    if (E.onRepaint) E.onRepaint();
  }

  // ── Rando Hub's dungeon panel ─────────────────────────────────────────────
  // Under the items: each dungeon's chests left (click to count one down),
  // and, where the pack's own grid doesn't already show them, its small keys
  // and big key. Built from the pack's own items.
  var DUNGEON_COLS = [
    ['hc_label', 'escape_chests', 'hc_smallkey', ''], ['at_label', '', 'at_smallkey', ''],
    ['ep_label', 'ep_chests', '', 'ep_bigkey'], ['dp_label', 'dp_chests', 'dp_smallkey', 'dp_bigkey'],
    ['toh_label', 'toh_chests', 'toh_smallkey', 'toh_bigkey'], ['pod_label', 'pod_chests', 'pod_smallkey', 'pod_bigkey'],
    ['sp_label', 'sp_chests', 'sp_smallkey', 'sp_bigkey'], ['sw_label', 'sw_chests', 'sw_smallkey', 'sw_bigkey'],
    ['tt_label', 'tt_chests', 'tt_smallkey', 'tt_bigkey'], ['ip_label', 'ip_chests', 'ip_smallkey', 'ip_bigkey'],
    ['mm_label', 'mm_chests', 'mm_smallkey', 'mm_bigkey'], ['tr_label', 'tr_chests', 'tr_smallkey', 'tr_bigkey'],
    ['gt_label', 'gt_basement_chests', 'gt_smallkey', 'gt_bigkey']];
  function dungeonPanel() {
    if (!E.findItem('ep_label')) return null;
    var keysShown = /key/.test(E.variant || '');
    var rows = keysShown ? [0, 1] : [0, 1, 2, 3];
    var grid = rows.map(function (r) { return DUNGEON_COLS.map(function (c) { return E.findItem(c[r]) ? c[r] : ''; }); });
    if (E.findItem('gt_climb_chests')) grid.splice(2, 0, DUNGEON_COLS.map(function (c) { return c[0] === 'gt_label' ? 'gt_climb_chests' : ''; }));
    return { type: 'group', header: 'Dungeons', header_background: '#3e4b57',
      content: { type: 'itemgrid', h_alignment: 'center', item_width: 22, item_height: 20, item_margin: '1,1', badge_font_size: 10, rows: grid } };
  }
  function withDungeons(def) {
    var extra = dungeonPanel();
    if (!extra) return def;
    var done = false;
    function walk(d) {
      if (!d || typeof d !== 'object') return d;
      if (Array.isArray(d)) return d.map(walk);
      if (d.type === 'layout' && d.key === 'shared_item_grid' && !done) {
        done = true;
        return { type: 'array', orientation: 'vertical', content: [d, extra] };
      }
      var o = {};
      Object.keys(d).forEach(function (k) { o[k] = walk(d[k]); });
      return o;
    }
    var out = walk(def);
    return done ? out : def;
  }

  E.render = function (root, key) {
    itemViews = []; mapPanels = []; pinBoxes = [];
    root.textContent = '';
    var def = E.layouts[key];
    if (key === 'shared_item_grid') def = { type: 'layout', key: 'shared_item_grid' };
    if (def && key !== 'tracker_broadcast') def = withDungeons(def);
    if (!def) { root.appendChild(el('div', 'unsupported', 'This pack has no layout "' + key + '".')); return; }
    var n = build(def);
    n.classList.add('emo-root');
    root.appendChild(n);
    repaint();
    setTimeout(refitMaps, 0);
    if (window.ResizeObserver) new ResizeObserver(function () { refitMaps(); }).observe(root);
  };
  E.onChange = repaint;
  E.refitMaps = refitMaps;
})();
