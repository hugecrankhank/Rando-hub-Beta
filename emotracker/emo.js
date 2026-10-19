/*
 * emo.js — EmoTracker packs in the browser.
 *
 * A web runtime for EmoTracker's game packages (the item, location, map and
 * layout files plus the pack's Lua scripts), so an EmoTracker pack runs inside
 * Rando Hub with no desktop app. Only the tracker itself: items, locations and
 * their logic, maps, layouts and autotracking. (The desktop app's NDI, Twitch,
 * voice and other extras aren't part of it.)
 *
 * Behaviour follows EmoTracker's own source (MIT, EmoTracker Community):
 * access rules, location/section accessibility, item types, and memory watch
 * timing. Pack Lua runs on fengari (Lua 5.3 in JavaScript, MIT).
 *
 * Autotracking reads the emulator's memory directly through Rando Hub's
 * AlttpBridge (bridge/sni-bridge.js), found in a parent or opener window.
 *
 * URL: index.html?pack=alttpr_emosaru&variant=standard&layout=tracker_default
 */
(function () {
  'use strict';

  // ── accessibility levels (EmoTracker's order) ─────────────────────────────
  var A = { None: 0, Partial: 1, Unlockable: 2, Inspect: 3, Glitch: 4, SequenceBreak: 5, Normal: 6, Cleared: 7 };
  var A_NAME = ['None', 'Partial', 'Unlockable', 'Inspect', 'Glitch', 'SequenceBreak', 'Normal', 'Cleared'];
  var COLORS = ['#ff3030', 'darkorange', 'mediumpurple', 'cornflowerblue', '#b399c1', 'yellow', '#00ff00', '#333333'];

  var params = new URLSearchParams(location.search);
  var PACK = (params.get('pack') || 'alttpr_emosaru').replace(/[^\w.-]/g, '');
  var BASE = 'packs/' + PACK + '/';

  var Emo = window.EmoWeb = {
    A: A, A_NAME: A_NAME, COLORS: COLORS,
    pack: PACK, manifest: null, variant: null, settings: {},
    items: [], locations: [], locByName: {}, maps: [], layouts: {},
    pinned: [], log: [],
  };

  // ── files ─────────────────────────────────────────────────────────────────
  var FILES = new Set();
  function norm(p) { return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, ''); }
  // A variant's own copy of a file wins over the pack's shared one.
  function resolve(p) {
    p = norm(p);
    if (Emo.variant && FILES.has(Emo.variant + '/' + p)) return BASE + Emo.variant + '/' + p;
    return BASE + p;
  }
  function exists(p) { p = norm(p); return FILES.has(p) || (Emo.variant && FILES.has(Emo.variant + '/' + p)); }
  function fetchText(p) {
    return fetch(resolve(p)).then(function (r) { if (!r.ok) throw new Error(p + ': ' + r.status); return r.text(); });
  }
  // Pack JSON allows comments and trailing commas (EmoTracker reads it with Newtonsoft).
  function parseLoose(t) {
    t = t.replace(/^﻿/, '');
    var out = '', i = 0, n = t.length, s = false;
    while (i < n) {
      var c = t[i];
      if (s) { out += c; if (c === '\\') { out += t[i + 1]; i += 2; continue; } if (c === '"') s = false; i++; continue; }
      if (c === '"') { s = true; out += c; i++; continue; }
      if (c === '/' && t[i + 1] === '/') { var j = t.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (c === '/' && t[i + 1] === '*') { var k = t.indexOf('*/', i); i = k < 0 ? n : k + 2; continue; }
      out += c; i++;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  }
  function fetchJson(p) { return fetchText(p).then(parseLoose); }

  // ── images ────────────────────────────────────────────────────────────────
  // An image is { src, filter, overlays[] }. Mods: "@disabled" (the pack's
  // disabled filter), "saturation|0|bt601", "brightness|0.75", "grayscale",
  // "dim", "overlay|path".
  function imageRef(path, mods) {
    if (!path) return null;
    var img = { src: resolve(path), filter: [], overlays: [] };
    applyMods(img, mods);
    return img;
  }
  function fromImage(base, mods) {
    if (!base) return null;
    var img = { src: base.src, filter: base.filter.slice(), overlays: base.overlays.slice() };
    applyMods(img, mods);
    return img;
  }
  function applyMods(img, mods) {
    if (mods === undefined || mods === null || mods === '') return;
    String(mods).split(',').forEach(function (m) {
      m = m.trim();
      if (!m) return;
      if (m === '@disabled') { applyMods(img, Emo.settings.disabled_image_filter || 'grayscale,dim'); return; }
      var p = m.split('|').map(function (x) { return x.trim(); });
      var k = p[0].toLowerCase();
      if (k === 'overlay' && p[1]) img.overlays.push(resolve(p[1]));
      else if (k === 'saturation') img.filter.push('saturate(' + (parseFloat(p[1]) || 0) + ')');
      else if (k === 'brightness') img.filter.push('brightness(' + (parseFloat(p[1]) || 0) + ')');
      else if (k === 'grayscale') img.filter.push('grayscale(1)');
      else if (k === 'dim') img.filter.push('brightness(0.5)');
      else if (k === 'opacity') img.filter.push('opacity(' + (parseFloat(p[1]) || 0) + ')');
    });
  }
  function disabledSpec() { return Emo.settings.disabled_image_filter || 'saturation|0|bt601, brightness|0.75'; }

  // ── change notification ───────────────────────────────────────────────────
  var dirty = false, quiet = 0;
  function changed() {
    if (quiet) { dirty = true; return; }
    if (dirty) return;
    dirty = true;
    Promise.resolve().then(flush);
  }
  function flush() {
    dirty = false;
    refreshAccessibility();
    save();
    if (Emo.onChange) Emo.onChange();
  }
  Emo.batch = function (fn) { quiet++; try { fn(); } finally { quiet--; if (!quiet && dirty) { dirty = false; changed(); } } };

  function codesOf(spec) {
    var s = new Set();
    String(spec || '').split(',').forEach(function (c) { c = c.trim().toLowerCase(); if (c) s.add(c); });
    return s;
  }

  // ── items ─────────────────────────────────────────────────────────────────
  function Item(d) {
    this.def = d; this.type = d.type; this.Name = d.name || ''; this.codes = codesOf(d.codes);
    this.badge = null; this.badgeColor = null;
  }
  Item.prototype.canProvide = function (c) { return this.codes.has(c); };
  Item.prototype.provides = function (c) { return 0; };
  Item.prototype.left = function () {}; Item.prototype.right = function () {};
  Item.prototype.icon = function () { return null; };
  Item.prototype.activeIcon = function () { return this.icon(); };
  Item.prototype.saveState = function () { return null; };
  Item.prototype.loadState = function () {};
  Item.prototype.advanceToCode = function () {};

  function prop(obj, name, get, set) { Object.defineProperty(obj, name, { get: get, set: set, enumerable: true, configurable: true }); }

  var TYPES = {};
  TYPES.static = function (it, d) {
    it.img = imageRef(d.img, d.img_mods);
    it.icon = function () { return it.img; };
    it.provides = function (c) { return it.codes.has(c) ? 1 : 0; };
  };
  TYPES.toggle = function (it, d) {
    var on = !!d.initial_active_state;
    it.on_ = imageRef(d.img, d.img_mods);
    var dm = d.disabled_img_mods !== undefined ? d.disabled_img_mods : disabledSpec();
    it.off_ = d.disabled_img ? imageRef(d.disabled_img, dm) : fromImage(it.on_, dm);
    it.loop = !!d.loop;
    prop(it, 'Active', function () { return on; }, function (v) { v = !!v; if (v !== on) { on = v; changed(); } });
    it.icon = function () { return on ? it.on_ : it.off_; };
    it.activeIcon = function () { return it.on_; };
    it.provides = function (c) { return on && it.codes.has(c) ? 1 : 0; };
    it.left = function () { it.Active = it.loop ? !on : true; };
    it.right = function () { it.Active = it.loop ? !on : false; };
    it.advanceToCode = function () { it.Active = true; };
    it.saveState = function () { return { active: on }; };
    it.loadState = function (s) { on = !!s.active; };
  };
  TYPES.progressive = function (it, d) {
    var stages = [], loop = !!d.loop, allowDisabled = d.allow_disabled !== false, codes = '';
    var dmods = d.disabled_img_mods;
    (d.stages || []).forEach(function (sd) {
      if (sd.inherit_codes === false) codes = '';
      var img = imageRef(sd.img, sd.img_mods);
      if (!img) return;
      if (sd.codes) codes = codes + ',' + sd.codes;
      if (!stages.length && allowDisabled) stages.push({ img: fromImage(img, dmods !== undefined && dmods !== null ? dmods : disabledSpec()), codes: new Set() });
      stages.push({ img: img, codes: codesOf(codes) });
    });
    var cur = 0;
    if (typeof d.initial_stage_idx === 'number' && d.initial_stage_idx >= 0 && stages.length)
      cur = (d.initial_stage_idx + (allowDisabled ? 1 : 0)) % stages.length;
    it.stages = stages;
    prop(it, 'CurrentStage', function () { return cur; }, function (v) {
      v = Math.floor(Number(v)); if (v >= 0 && v < stages.length && v !== cur) { cur = v; changed(); }
    });
    it.canProvide = function (c) { return stages.some(function (s) { return s.codes.has(c); }); };
    it.provides = function (c) { return stages[cur] && stages[cur].codes.has(c) ? 1 : 0; };
    it.icon = function () { return stages[cur] ? stages[cur].img : null; };
    it.activeIcon = function () { var s = stages[Math.max(cur, allowDisabled ? 1 : 0)] || stages[stages.length - 1]; return s ? s.img : null; };
    it.left = function () { var n = cur + 1; if (loop) n %= stages.length; if (n < stages.length) it.CurrentStage = n; };
    it.right = function () { var n = cur - 1; if (loop) n = (n + stages.length) % stages.length; if (n >= 0) it.CurrentStage = n; };
    it.advanceToCode = function (code) {
      if (code) {
        for (var i = cur + 1; i < stages.length; i++) if (stages[i].codes.has(code)) { it.CurrentStage = i; return; }
        if (loop) for (var j = 0; j < stages.length; j++) if (stages[j].codes.has(code)) { it.CurrentStage = j; return; }
      }
      it.left();
    };
    it.saveState = function () { return { stage: cur }; };
    it.loadState = function (s) { if (s.stage >= 0 && s.stage < stages.length) cur = s.stage; };
  };
  TYPES.progressive_toggle = function (it, d) {
    var stages = [], on = !!d.initial_active_state, cur = 0, swap = !!d.swap_actions;
    (d.stages || []).forEach(function (sd) {
      var img = imageRef(sd.img, sd.img_mods);
      if (!img) return;
      var dm = sd.disabled_img_mods !== undefined && sd.disabled_img_mods !== null ? sd.disabled_img_mods : disabledSpec();
      var dis = sd.disabled_img ? imageRef(sd.disabled_img, dm) : fromImage(img, dm);
      stages.push({ img: img, dis: dis || img, codes: codesOf(sd.codes), secondary: codesOf(sd.secondary_codes) });
    });
    if (stages.length && typeof d.initial_stage_idx === 'number') cur = d.initial_stage_idx % stages.length;
    it.stages = stages;
    prop(it, 'Active', function () { return on; }, function (v) { v = !!v; if (v !== on) { on = v; changed(); } });
    prop(it, 'CurrentStage', function () { return cur; }, function (v) {
      v = Math.floor(Number(v)); if (stages.length) v = ((v % stages.length) + stages.length) % stages.length;
      if (v !== cur) { cur = v; changed(); }
    });
    it.canProvide = function (c) { return stages.some(function (s) { return s.codes.has(c); }); };
    it.provides = function (c) { return on && stages[cur] && stages[cur].codes.has(c) ? 1 : 0; };
    it.icon = function () { var s = stages[cur]; return s ? (on ? s.img : s.dis) : null; };
    it.activeIcon = function () { var s = stages[cur]; return s ? s.img : null; };
    it.advance = function () { if (stages.length) it.CurrentStage = (cur + 1) % stages.length; };
    it.left = function () { if (!swap) it.Active = !on; else it.advance(); };
    it.right = function () { if (swap) it.Active = !on; else it.advance(); };
    it.advanceToCode = function () { it.Active = true; };
    it.saveState = function () { return { stage: cur, active: on }; };
    it.loadState = function (s) { if (s.stage >= 0 && s.stage < stages.length) cur = s.stage; on = !!s.active; };
  };
  TYPES.consumable = function (it, d) {
    var full = imageRef(d.img, d.img_mods);
    var dm = d.disabled_img_mods !== undefined && d.disabled_img_mods !== null ? d.disabled_img_mods : disabledSpec();
    var empty = d.disabled_img ? imageRef(d.disabled_img, dm) : fromImage(full, dm);
    var max = typeof d.max_quantity === 'number' ? d.max_quantity : Infinity;
    var min = typeof d.min_quantity === 'number' ? d.min_quantity : 0;
    var inc = typeof d.increment === 'number' ? d.increment : 1;
    var acquired = typeof d.initial_quantity === 'number' ? d.initial_quantity : 0, consumed = 0;
    var swap = !!d.swap_actions, frac = !!d.display_as_fraction_of_max;
    function clamp(v) { return Math.max(min, Math.min(max, Math.floor(Number(v) || 0))); }
    prop(it, 'AcquiredCount', function () { return acquired; }, function (v) { v = clamp(v); if (v !== acquired) { acquired = v; changed(); } });
    prop(it, 'ConsumedCount', function () { return consumed; }, function (v) { v = Math.max(0, Math.floor(Number(v) || 0)); if (v !== consumed) { consumed = v; changed(); } });
    prop(it, 'AvailableCount', function () { return Math.max(0, acquired - consumed); });
    prop(it, 'MaxCount', function () { return max; }, function (v) { max = Number(v); changed(); });
    prop(it, 'MinCount', function () { return min; }, function (v) { min = Number(v); changed(); });
    it.provides = function (c) { var a = Math.max(0, acquired - consumed); return a > 0 && it.codes.has(c) ? a : 0; };
    it.icon = function () { return Math.max(0, acquired - consumed) === 0 ? (acquired > 0 ? full : empty) : full; };
    it.activeIcon = function () { return full; };
    it.badgeOf = function () {
      var a = Math.max(0, acquired - consumed);
      if (!a) return null;
      return { text: frac ? a + '/' + max : String(a), color: acquired >= max ? '#00ff00' : 'whitesmoke' };
    };
    it.left = function () { it.AcquiredCount = acquired + (swap ? -inc : inc); };
    it.right = function () { it.AcquiredCount = acquired + (swap ? inc : -inc); };
    it.advanceToCode = function () { it.left(); };
    it.saveState = function () { return { acquired: acquired, consumed: consumed }; };
    it.loadState = function (s) { acquired = clamp(s.acquired); consumed = s.consumed || 0; };
  };
  TYPES.composite_toggle = function (it, d) {
    var icons = {};
    (d.images || []).forEach(function (im) { icons[(!!im.left) + ',' + (!!im.right)] = imageRef(im.img, im.img_mods); });
    function a() { return findItem(d.item_left); }
    function b() { return findItem(d.item_right); }
    it.provides = function (c) { return it.codes.has(c) ? 1 : 0; };
    it.icon = function () { var x = a(), y = b(); return icons[(!!(x && x.Active)) + ',' + (!!(y && y.Active))] || null; };
    it.left = function () { var x = a(); if (x) x.Active = !x.Active; };
    it.right = function () { var y = b(); if (y) y.Active = !y.Active; };
  };
  TYPES.sectionchests = function (it, d) {
    function sec() { return findCode(d.section); }
    prop(it, 'Section', function () { return sec(); });
    it.provides = function (c) { var s = sec(); return it.codes.has(c) && s instanceof Section ? s.AvailableChestCount : 0; };
    function allow() { var s = sec(); return s && s.visible && s.level !== A.None; }
    it.chest = true;
    it.icon = function () { var s = sec(); if (!s) return null; return { chest: s.AvailableChestCount === 0 ? 'open' : 'closed', dim: !allow() }; };
    it.badgeOf = function () { var s = sec(); if (!s) return null; return { text: String(s.AvailableChestCount), color: s.AvailableChestCount >= s.ChestCount ? '#00ff00' : 'whitesmoke' }; };
    it.left = function () { var s = sec(); if (s && allow() && s.AvailableChestCount > 0) { s.Owner.ModifiedByUser = true; s.AvailableChestCount--; } };
    it.right = function () { var s = sec(); if (s && allow() && s.AvailableChestCount < s.ChestCount) { s.Owner.ModifiedByUser = true; s.AvailableChestCount++; } };
  };
  TYPES.toggle_badged = function (it, d) {
    TYPES.toggle(it, d);
    var base = findItem(d.base_item);
    it.badgeImg = imageRef(d.img, d.img_mods);
    it.icon = function () { var b = findItem(d.base_item); return b ? b.icon() : it.on_; };
  };

  function makeItem(d) {
    var it = new Item(d), f = TYPES[d.type];
    if (!f) { Emo.log.push('Item type not supported: ' + d.type + ' (' + d.name + ')'); f = TYPES.static; }
    f(it, d);
    return it;
  }
  var codeCache = new Map();
  function findItem(code) {
    if (!code) return null;
    code = String(code).trim().toLowerCase();
    if (codeCache.has(code)) return codeCache.get(code);
    var found = null;
    for (var i = 0; i < Emo.items.length; i++) if (Emo.items[i].canProvide(code)) { found = Emo.items[i]; break; }
    codeCache.set(code, found);
    return found;
  }
  function itemCount(code) {
    var n = 0;
    for (var i = 0; i < Emo.items.length; i++) n += Emo.items[i].provides(code) || 0;
    return n;
  }

  // ── locations ─────────────────────────────────────────────────────────────
  // A rule set is a list of alternatives; each is comma-separated codes, all
  // needed. [code] = can be skipped (sequence break), {..} = inspect only,
  // code:N = N of it, $fn|args = a Lua function, @Location/Section.
  function parseRules(list) {
    return (list || []).map(function (spec) {
      if (Array.isArray(spec)) spec = spec.join(',');
      spec = String(spec).trim();
      var r = { inspect: false, codes: [] };
      if (spec[0] === '{' && spec[spec.length - 1] === '}') { r.inspect = true; spec = spec.slice(1, -1); }
      spec.split(',').forEach(function (tok) {
        tok = tok.trim();
        if (!tok) return;
        var c = { sb: false, glitch: false, n: 1, code: '' };
        if (tok[0] === '[' && tok[tok.length - 1] === ']') {
          c.sb = true; tok = tok.slice(1, -1);
          if (tok[0] === '[' && tok[tok.length - 1] === ']') { c.glitch = true; tok = tok.slice(1, -1); }
        }
        var parts = tok.split(':');
        c.code = parts[0].trim();
        if (parts.length > 1 && /^\d+$/.test(parts[1].trim())) c.n = parseInt(parts[1], 10);
        r.codes.push(c);
      });
      return r;
    });
  }
  var ruleCache = new Map();
  function countFor(code) {
    if (ruleCache.has(code)) return ruleCache.get(code);
    var res;
    if (code[0] === '$') res = luaRule(code.slice(1));
    else if (code[0] === '@') res = locCount(code.slice(1));
    else res = { n: itemCount(code.toLowerCase()), max: A.Normal };
    ruleCache.set(code, res);
    return res;
  }
  function ruleLevel(r) {
    var level = A.Normal;
    for (var i = 0; i < r.codes.length; i++) {
      var c = r.codes[i], got = countFor(c.code);
      if (!c.sb && got.n < c.n) { level = A.None; break; }
      if (c.sb && got.n < c.n) level = Math.min(level, A.SequenceBreak);
      else level = Math.min(level, got.max);
    }
    if (r.inspect && level >= A.Glitch) level = A.Inspect;
    return level;
  }
  function rulesLevel(rules, noInspect) {
    if (Emo.ignoreLogic) return A.Normal;
    if (!rules.length) return A.Normal;
    var best = A.None;
    rules.forEach(function (r) { var l = ruleLevel(r); if (noInspect && l === A.Inspect) return; if (l > best) best = l; });
    return best;
  }

  function Section(loc, d) {
    var self = this;
    this.Owner = loc; this.def = d; this.Name = d.name || ''; this.ShortName = d.short_name || d.name || '';
    this.rules = parseRules(d.access_rules);
    this.visRules = parseRules(d.visibility_rules);
    this.ChestCount = typeof d.item_count === 'number' ? d.item_count : 0;
    this.hostedCode = d.hosted_item ? String(d.hosted_item).toLowerCase() : null;
    this.clearAsGroup = d.clear_as_group !== false;
    var avail = this.ChestCount;
    prop(this, 'AvailableChestCount', function () { return avail; }, function (v) {
      v = Math.max(0, Math.min(self.ChestCount, Math.floor(Number(v) || 0)));
      if (v !== avail) { avail = v; changed(); }
    });
    this.level = A.None; this.visible = true;
    // the item you've marked as being here (right click / long press on the map)
    this.captured = null;
  }
  Section.prototype.capture = function (code) { this.captured = code || null; changed(); };
  Section.prototype.hosted = function () { return this.hostedCode ? findItem(this.hostedCode) : null; };
  Section.prototype.unclaimed = function () {
    if (this.AvailableChestCount > 0) return true;
    var h = this.hosted();
    return !!(h && !h.provides(this.hostedCode));
  };
  Section.prototype.refresh = function () {
    this.visible = !this.visRules.length || Emo.ignoreLogic || visLevel(this.visRules) >= A.Normal;
    this.level = Math.min(this.Owner.base, rulesLevel(this.rules));
  };
  Section.prototype.clear = function () {
    this.AvailableChestCount = 0;
    var h = this.hosted();
    if (h && !h.provides(this.hostedCode)) h.advanceToCode(this.hostedCode);
  };
  function visLevel(rules) {
    var best = A.None;
    rules.forEach(function (r) { var l = ruleLevel(r); if (l !== A.Inspect && l > best) best = l; });
    return best;
  }

  function Location(d, parent) {
    this.def = d; this.Name = d.name || ''; this.ShortName = d.short_name || '';
    this.Parent = parent || null; this.color = d.color || null;
    this.rules = parseRules(d.access_rules);
    this.mapLocations = (d.map_locations || []).map(function (m) { return { map: m.map, x: m.x, y: m.y, size: m.size, vis: parseRules(m.visibility_rules) }; });
    this.Sections = []; this.Children = [];
    this.base = A.Normal; this.level = A.Normal;
    this.ModifiedByUser = false;
    var self = this;
    (d.sections || []).forEach(function (sd) { self.Sections.push(new Section(self, sd)); });
  }
  Location.prototype.findSection = function (name) {
    name = String(name).toLowerCase();
    for (var i = 0; i < this.Sections.length; i++) if (this.Sections[i].Name.toLowerCase() === name) return this.Sections[i];
    return null;
  };
  Location.prototype.refresh = function () {
    this.base = rulesLevel(this.rules);
    if (this.Parent) this.base = Math.min(this.base, this.Parent.base);
    if (!this.Sections.length) { this.level = this.base; return; }
    var local = A.None, minDone = A.Normal, withItems = 0, accWithItems = 0, accItems = 0, inspItems = 0;
    this.hasVisible = false;
    for (var i = 0; i < this.Sections.length; i++) {
      var s = this.Sections[i];
      s.refresh();
      if (!s.visible) continue;
      this.hasVisible = true;
      if (!s.unclaimed()) continue;
      withItems++;
      if (s.level >= A.SequenceBreak) minDone = Math.min(minDone, s.level);
      if (s.level >= A.Unlockable) {
        local = Math.max(local, s.level);
        accWithItems++;
        if (s.level === A.Inspect) inspItems += s.AvailableChestCount;
        accItems += s.AvailableChestCount;
        var h = s.hosted();
        if (h && !h.provides(s.hostedCode)) accItems++;
      }
    }
    if (accItems > 0) {
      if (accWithItems < withItems || (inspItems > 0 && inspItems < accItems)) this.level = A.Partial;
      else if (local >= A.SequenceBreak) this.level = minDone;
      else this.level = local;
    } else if (withItems > 0) this.level = A.None;
    else this.level = A.Cleared;
  };
  Location.prototype.clearAll = function () {
    this.ModifiedByUser = true;
    var self = this;
    Emo.batch(function () { self.Sections.forEach(function (s) { if (s.visible) s.clear(); }); });
  };
  // Undo: everything here back to not collected (and the hosted items' marks off)
  Location.prototype.reopenAll = function () {
    this.ModifiedByUser = true;
    var self = this;
    Emo.batch(function () { self.Sections.forEach(function (s) { if (s.visible) s.AvailableChestCount = s.ChestCount; }); });
  };
  function locCount(path) {
    var parts = path.split('/'), loc = Emo.locByName[parts[0].trim().toLowerCase()];
    if (!loc) return { n: 0, max: A.Normal };
    if (parts.length >= 2) {
      var s = loc.findSection(parts[1].trim());
      if (!s) return { n: 0, max: A.Normal };
      return { n: s.level >= A.Unlockable ? 1 : 0, max: s.level };
    }
    return { n: loc.base >= A.Unlockable ? 1 : 0, max: loc.base };
  }
  function findCode(code) {
    code = String(code || '').trim();
    if (code[0] === '@') {
      var parts = code.slice(1).split('/'), loc = Emo.locByName[parts[0].trim().toLowerCase()];
      if (!loc) return null;
      return parts.length >= 2 ? loc.findSection(parts[1].trim()) : loc;
    }
    return findItem(code);
  }

  function addLocations(list, parent) {
    (list || []).forEach(function (d) {
      var p = parent;
      if (d.parent) p = Emo.locByName[String(d.parent).replace(/^@/, '').toLowerCase()] || parent;
      var loc = new Location(d, p);
      Emo.locations.push(loc);
      Emo.locByName[loc.Name.toLowerCase()] = loc;
      if (p) p.Children.push(loc);
      addLocations(d.children, loc);
    });
  }

  // Rando Hub's corrections to a pack's logic, for today's randomizer. The
  // official ALTTPR pack (2019) assumes bombs are always on hand; now bombs
  // can run out, so the spots behind a bombable wall need bombs (or a dash
  // with the boots where that works), the same as Hutch's tracker.
  // Each entry: "@Location/Section": [ codes, any one of which is needed ].
  var PATCHES = {
    alttpr_emosaru: {
      '@Chicken House/Bombable Wall': ['bombs'],
      '@Bombable Shack/Downstairs': ['bombs'],
      "@Aginah's Cave/Cave": ['bombs'],
      "@Sahasrala's Hut/Back Room": ['bombs', 'boots'],
      '@The Well/Bombable Wall': ['bombs'],
      "@Blind's House/Bombable Wall": ['bombs'],
      '@Hype Cave/Cave': ['bombs'],
      '@Mini Moldorm Cave/Cave': ['bombs'],
      '@Ice Rod Cave/Cave': ['bombs'],
      '@Race Game/Take This Trash': ['bombs', 'boots'],
    },
  };
  function applyPatches() {
    var P = PATCHES[PACK];
    if (!P) return;
    Object.keys(P).forEach(function (code) {
      var sec = findCode(code);
      if (!(sec instanceof Section)) { Emo.log.push('patch: no ' + code); return; }
      var need = P[code].map(function (c) { return { sb: false, glitch: false, n: 1, code: c }; });
      var base = sec.rules.length ? sec.rules : [{ inspect: false, codes: [] }];
      var out = [];
      base.forEach(function (r) {
        need.forEach(function (c) { out.push({ inspect: r.inspect, codes: r.codes.concat([c]) }); });
      });
      sec.rules = out;
    });
  }

  // Locations that depend on others ("@...") read their last computed level,
  // so a change settles over a pass or two.
  function refreshAccessibility() {
    var before = Emo.locations.map(function (l) { return l.level; }).join();
    for (var pass = 0; pass < 4; pass++) {
      ruleCache.clear();
      Emo.locations.forEach(function (l) { l.refresh(); });
      var now = Emo.locations.map(function (l) { return l.level + '' + l.Sections.map(function (s) { return s.level; }).join(''); }).join();
      if (now === before) break;
      before = now;
    }
  }
  Emo.refresh = function () { codeCache.clear(); changed(); };

  // ── Lua ───────────────────────────────────────────────────────────────────
  var F = window.fengari, L = null;
  function luaInit() {
    var lua = F.lua, lauxlib = F.lauxlib, lualib = F.lualib, interop = F.interop;
    L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);
    lauxlib.luaL_requiref(L, F.to_luastring('js'), interop.luaopen_js, 1);
    lua.lua_pop(L, 1);
    function setGlobal(name, v) { interop.push(L, v); lua.lua_setglobal(L, F.to_luastring(name)); }
    setGlobal('Tracker', TrackerAPI);
    setGlobal('ScriptHost', ScriptHostAPI);
    setGlobal('AutoTracker', AutoTrackerAPI);
    run('AccessibilityLevel = { None = 0, Partial = 1, Unlockable = 2, Inspect = 3, Glitch = 4, SequenceBreak = 5, Normal = 6, Cleared = 7 }\n' +
        'NotificationType = { Message = 0, Celebration = 1, Warning = 2, Error = 3 }\n' +
        'print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring((select(i, ...))) end js.global.EmoWeb:print(table.concat(t, "\\t")) end',
        '=emo');
  }
  Emo.print = function (s) { Emo.log.push(String(s)); if (Emo.debug) console.log('[lua]', s); };
  function run(src, name) {
    var lua = F.lua, lauxlib = F.lauxlib;
    var st = lauxlib.luaL_loadbuffer(L, F.to_luastring(src), null, F.to_luastring(name || '=chunk'));
    if (st === lua.LUA_OK) st = lua.lua_pcall(L, 0, 0, 0);
    if (st !== lua.LUA_OK) {
      var msg = lua.lua_tojsstring(L, -1);
      lua.lua_pop(L, 1);
      Emo.log.push('Lua error in ' + name + ': ' + msg);
      console.warn('Lua error in', name, msg);
      return false;
    }
    return true;
  }
  // "$fn|arg|arg": a Lua function's count (and optionally a level).
  function luaRule(spec) {
    var lua = F.lua;
    var parts = spec.split('|').map(function (s) { return s.trim(); });
    if (!L) return { n: 0, max: A.Normal };
    var top = lua.lua_gettop(L);
    var t = lua.lua_getglobal(L, F.to_luastring(parts[0]));
    if (t !== lua.LUA_TFUNCTION) { lua.lua_settop(L, top); return { n: 0, max: A.Normal }; }
    for (var i = 1; i < parts.length; i++) lua.lua_pushstring(L, F.to_luastring(parts[i]));
    var st = lua.lua_pcall(L, parts.length - 1, 2, 0);
    var res = { n: 0, max: A.Normal };
    if (st === lua.LUA_OK) {
      var v = F.interop.tojs(L, -2), lv = F.interop.tojs(L, -1);
      res.n = v === true ? 1 : (typeof v === 'number' ? Math.max(0, Math.floor(v)) : 0);
      if (typeof lv === 'number') res.max = lv;
    } else {
      var msg = lua.lua_tojsstring(L, -1);
      if (Emo.log.length < 500) Emo.log.push('Lua error in $' + spec + ': ' + msg);
    }
    lua.lua_settop(L, top);
    return res;
  }

  // The objects pack scripts see. (Lua's obj:Method(...) calls these with
  // `this` = the object.)
  var loadQueue = null;   // AddItems/AddLocations/... calls from init.lua, run in order afterwards
  var TrackerAPI = {
    get ActiveVariantUID() { return Emo.variant || ''; },
    AddItems: function (p) { loadQueue.push(['items', p]); },
    AddLocations: function (p) { loadQueue.push(['locations', p]); },
    AddMaps: function (p) { loadQueue.push(['maps', p]); },
    AddLayouts: function (p) { loadQueue.push(['layouts', p]); },
    ProviderCountForCode: function (code) { return countFor(String(code)).n; },
    FindObjectForCode: function (code) { return findCode(String(code)) || undefined; },
    UiHint: function () {},
    get BulkUpdate() { return quiet > 0; },
    set BulkUpdate(v) { if (v) quiet++; else if (quiet) { quiet--; if (!quiet && dirty) { dirty = false; changed(); } } },
  };
  var ScriptHostAPI = {
    LoadScript: function (p) { loadQueue.push(['script', p]); },
    AddMemoryWatch: function (name, addr, len, fn, period) { return addWatch(name, addr, len, fn, period); },
    RemoveMemoryWatch: function (w) { var i = watches.indexOf(w); if (i >= 0) watches.splice(i, 1); },
    AddWatchForCode: function (name, code, fn) { codeWatches.push({ name: name, code: String(code).toLowerCase(), fn: fn }); return name; },
    RemoveWatchForCode: function () {},
    PushMarkdownNotification: function (type, md) { if (Emo.notify) Emo.notify(String(md)); },
    CreateLuaItem: function () { return null; },
  };
  var codeWatches = [];
  var AutoTrackerAPI = {
    ReadU8: function (addr, def) { var b = readMem(addr, 1); return b ? b[0] : (def || 0); },
    ReadU16: function (addr, def) { var b = readMem(addr, 2); return b ? b[0] | (b[1] << 8) : (def || 0); },
    ReadU24: function (addr, def) { var b = readMem(addr, 3); return b ? b[0] | (b[1] << 8) | (b[2] << 16) : (def || 0); },
    ReadU32: function (addr, def) { var b = readMem(addr, 4); return b ? (b[0] | (b[1] << 8) | (b[2] << 16)) + b[3] * 16777216 : (def || 0); },
    get IsConnected() { return !!(bridge() && bridge().ready()); },
  };

  // ── autotracking ──────────────────────────────────────────────────────────
  function bridge() {
    var w = window, seen = [];
    for (var i = 0; i < 6 && w && seen.indexOf(w) < 0; i++) {
      seen.push(w);
      try { if (w.AlttpBridge) return w.AlttpBridge; } catch (e) {}
      try { w = w.parent && w.parent !== w ? w.parent : w.opener; } catch (e) { w = null; }
    }
    return null;
  }
  Emo.bridge = bridge;
  // SNES addresses: $7E0000-$7FFFFF is WRAM; the bridge serves it at $F50000.
  function bridgeAddr(addr) {
    addr = Number(addr);
    var bank = addr >>> 16;
    if (bank === 0x7E || bank === 0x7F) return 0xF50000 + (addr - 0x7E0000);
    if (bank >= 0xE0 && bank < 0xF0) return addr;          // already usb2snes SRAM
    if (bank >= 0xF5 && bank <= 0xF6) return addr;         // already usb2snes WRAM
    if (bank < 0x40 && (addr & 0xFFFF) < 0x2000) return 0xF50000 + (addr & 0x1FFF);   // WRAM mirror
    return null;
  }
  function readMem(addr, len) {
    var b = bridge();
    if (!b || !b.ready()) return null;
    var a = bridgeAddr(addr);
    if (a === null) return null;
    try { return b.read(a, len); } catch (e) { return null; }
  }
  var watches = [];
  function Segment(w) { this.w = w; }
  Segment.prototype.ReadUInt8 = function (addr) {
    var o = Number(addr) - this.w.addr; return o >= 0 && o < this.w.len ? this.w.data[o] : 0;
  };
  Segment.prototype.ReadUInt16 = function (addr) { return this.ReadUInt8(addr) | (this.ReadUInt8(Number(addr) + 1) << 8); };
  Segment.prototype.ReadUInt24 = function (addr) { return this.ReadUInt16(addr) | (this.ReadUInt8(Number(addr) + 2) << 16); };
  Segment.prototype.ReadUInt32 = function (addr) { return this.ReadUInt24(addr) + this.ReadUInt8(Number(addr) + 3) * 16777216; };
  Segment.prototype.ReadInt8 = function (addr) { var v = this.ReadUInt8(addr); return v > 127 ? v - 256 : v; };
  function addWatch(name, addr, len, fn, period) {
    var w = { name: String(name), addr: Number(addr), len: Number(len), fn: fn, period: Number(period) || 500,
      data: new Uint8Array(Number(len)), dirty: true, last: 0 };
    w.seg = new Segment(w);
    // one watch per name
    watches = watches.filter(function (x) { return x.name !== w.name; });
    watches.push(w);
    return w.name;
  }
  // ── run counters and the GT big key ───────────────────────────────────────
  // Checks, deaths and bonks are the randomizer's own counters in save RAM
  // (z3randomizer: $7EF423 items found, $7EF449 deaths, $7EF420 bonks).
  // Ganon's Tower: chests opened (26, not Bob's Torch; the same room flags as
  // Hutch's tracker) and, for the "which chest has the big key?" game, how
  // many were open when the big key turned up (that chest included). Only
  // counted if the key was seen missing first and arrived inside GT.
  var GT_CHESTS = [[0x118, 0x20], [0x118, 0x40], [0x11a, 0x10], [0x13a, 0x10], [0x13a, 0x20], [0x13a, 0x40], [0x13a, 0x80],
    [0x0f6, 0x10], [0x0f6, 0x20], [0x0f6, 0x40], [0x0f6, 0x80], [0x116, 0x10], [0x0fa, 0x10], [0x0f8, 0x10], [0x0f8, 0x20],
    [0x0f8, 0x40], [0x0f8, 0x80], [0x118, 0x80], [0x118, 0x10], [0x038, 0x20], [0x038, 0x40], [0x038, 0x10], [0x07a, 0x10],
    [0x07a, 0x20], [0x07a, 0x40], [0x09a, 0x10]];
  var gt = { armed: false, at: null };
  Emo.stats = null;
  var statT = 0;
  function readStats() {
    var b = readMem(0x7EF000, 0x500), m = readMem(0x7E0010, 1), pal = readMem(0x7E040C, 1);
    if (!b || !m) return;
    if (m[0] < 0x06 || m[0] === 0x14) return;           // title, file select, attract: not in a game
    var opened = 0;
    GT_CHESTS.forEach(function (c) { if (b[c[0]] & c[1]) opened++; });
    var found = !!(b[0x366] & 0x04);
    if (!found) { if (!gt.armed || gt.at !== null) { gt.armed = true; gt.at = null; save(); } }
    else if (gt.armed && gt.at === null) { gt.at = pal && pal[0] === 0x1A ? opened : -1; save(); }
    var st = { checks: b[0x423] | (b[0x424] << 8), deaths: b[0x449], bonks: b[0x420], gtOpened: opened, gtFound: found,
      gtAt: gt.at === null || gt.at < 0 ? null : gt.at };
    var sig = JSON.stringify(st);
    if (sig !== JSON.stringify(Emo.stats)) { Emo.stats = st; if (Emo.onStats) Emo.onStats(st); }
  }

  Emo.autotrack = true;
  Emo.connected = false;
  function tick() {
    var b = bridge(), live = !!(b && b.ready());
    if (live !== Emo.connected) {
      Emo.connected = live;
      if (live) { var g = romHash(b); if (g) { setGame(g); loadRomMaps(b, g); } watches.forEach(function (w) { w.dirty = true; }); }
      if (Emo.onStatus) Emo.onStatus(live);
    }
    if (!live || !L) return;
    var now = Date.now();
    if (now - statT > 500) { statT = now; try { readStats(); } catch (e) {} }
    if (!Emo.autotrack) return;
    watches.slice().forEach(function (w) {
      if (!w.dirty && now - w.last < w.period) return;
      var bytes = readMem(w.addr, w.len);
      if (!bytes) return;
      w.last = now;
      var mod = w.dirty;
      for (var i = 0; !mod && i < w.len; i++) if (bytes[i] !== w.data[i]) mod = true;
      if (!mod) return;
      w.data.set(bytes);
      var ok = false;
      Emo.batch(function () {
        try {
          var r = w.fn && w.fn.invoke ? w.fn.invoke(w.seg, []) : null;
          ok = r && r.length && r[0] !== undefined && r[0] !== null && r[0] !== false;
        } catch (e) { Emo.log.push('Watch ' + w.name + ': ' + e.message); }
      });
      w.dirty = !ok;
    });
  }

  // ── layouts and maps ──────────────────────────────────────────────────────
  function addLayouts(obj) {
    var src = obj && obj.layouts && typeof obj.layouts === 'object' && !obj.layouts.type ? obj.layouts : obj;
    Object.keys(src || {}).forEach(function (k) { Emo.layouts[k] = src[k]; });
  }
  function addMaps(list) {
    (list || []).forEach(function (m) {
      Emo.maps = Emo.maps.filter(function (x) { return x.name !== m.name; });
      Emo.maps.push({ name: m.name, img: imageRef(m.img, m.img_mods), size: m.location_size || 70,
        border: m.location_border_thickness || 8, w: 0, h: 0 });
    });
  }

  // ── saving ────────────────────────────────────────────────────────────────
  // Marks are kept per game: a new seed starts clean, and going back to a
  // game you were playing brings its marks back. (Before a game is running,
  // they're kept under "no game".)
  Emo.game = 'nogame';
  function key() { return 'rhb-emo-' + PACK + '-' + Emo.variant + '-' + Emo.game; }
  var defaults = null;
  function snapshotDefaults() {
    defaults = { items: Emo.items.map(function (it) { return it.saveState(); }),
      sections: Emo.locations.map(function (l) { return l.Sections.map(function (s) { return s.ChestCount; }); }) };
  }
  function applyDefaults() {
    Emo.items.forEach(function (it, i) { if (defaults.items[i]) it.loadState(defaults.items[i]); });
    Emo.locations.forEach(function (l, i) {
      l.ModifiedByUser = false;
      l.Sections.forEach(function (s, j) { s.AvailableChestCount = defaults.sections[i][j]; s.captured = null; });
    });
    Emo.pinned = [];
    gt.armed = false; gt.at = null;
  }
  function rememberGame(g) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('rhb-emo-games') || '[]'); } catch (e) {}
    list = list.filter(function (x) { return x !== g; });
    list.unshift(g);
    // keep the last 12 games' marks
    list.slice(12).forEach(function (old) {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('rhb-emo-') === 0 && k.slice(-old.length - 1) === '-' + old) localStorage.removeItem(k); }); } catch (e) {}
    });
    try { localStorage.setItem('rhb-emo-games', JSON.stringify(list.slice(0, 12))); } catch (e) {}
  }
  function setGame(g) {
    if (!g || g === Emo.game) return;
    save();
    Emo.game = g;
    rememberGame(g);
    Emo.batch(function () { applyDefaults(); restore(); });
    if (Emo.onGame) Emo.onGame(g);
  }
  // ── maps drawn from the ROM (romap.js) ────────────────────────────────────
  // Once per game: both worlds drawn from the running ROM, kept in the
  // browser (IndexedDB) so the next load is instant. Emo.romMaps holds their
  // object URLs; ui.js shows them in place of the pack's pictures.
  Emo.romMaps = null;
  var romMapsFor = null;
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('rhb-emo-maps', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('maps'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res) { var q = db.transaction('maps').objectStore('maps').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function idbPut(k, v) {
    return idb().then(function (db) {
      var st = db.transaction('maps', 'readwrite').objectStore('maps');
      st.put(v, k);
      // keep the last few games' maps only
      var all = st.getAllKeys();
      all.onsuccess = function () { var ks = all.result || []; if (ks.length > 6) ks.slice(0, ks.length - 6).forEach(function (x) { if (x !== k) st.delete(x); }); };
    }).catch(function () {});
  }
  function useRomMaps(m) {
    if (Emo.romMaps) { try { Emo.romMaps.light.concat(Emo.romMaps.dark).forEach(function (u) { URL.revokeObjectURL(u); }); } catch (e) {} }
    Emo.romMaps = null;
    if (m && Array.isArray(m.light) && Array.isArray(m.dark) && m.light.length === 64 && m.dark.length === 64 &&
        m.light.concat(m.dark).every(function (b) { return b && b.size > 0; })) {
      Emo.romMaps = { light: m.light.map(function (b) { return URL.createObjectURL(b); }), dark: m.dark.map(function (b) { return URL.createObjectURL(b); }) };
    }
    if (Emo.onRomMaps) Emo.onRomMaps();
  }
  Emo.romMapsOn = true;
  try { Emo.romMapsOn = localStorage.getItem('rhb-emo-rommaps') !== '0'; } catch (e) {}
  function loadRomMaps(b, g) {
    if (!Emo.romMapsOn || !window.RoMap || !g || romMapsFor === g) return;
    romMapsFor = g;
    idbGet('v2-' + g).then(function (hit) {
      if (romMapsFor !== g) return;
      if (hit && hit.light && hit.dark) { useRomMaps(hit); return; }
      var rom;
      try { rom = b.read(0, 0x200000); } catch (e) { return; }
      // drawn a moment later, so it doesn't hold up the tracker
      setTimeout(function () {
        var job = null;
        try { job = window.RoMap.render(rom); } catch (e) { Emo.log.push('map from ROM: ' + e.message); }
        if (!job) { Emo.log.push('map from ROM: not an ALTTP JP 1.0 based ROM, using the pack\'s maps'); return; }
        job.then(function (m) {
          if (romMapsFor !== g) return;
          if (!m.light.concat(m.dark).every(function (b) { return b && b.size > 0; })) { Emo.log.push('map from ROM: drawing failed, using the pack\'s maps'); return; }
          useRomMaps(m);
          idbPut('v2-' + g, m);
        });
      }, 300);
    });
  }
  Emo.setRomMaps = function (on) {
    Emo.romMapsOn = !!on;
    try { localStorage.setItem('rhb-emo-rommaps', on ? '1' : '0'); } catch (e) {}
    if (!on) { romMapsFor = null; useRomMaps(null); }
    else { var b = bridge(); if (b && b.ready()) loadRomMaps(b, Emo.game); }
  };

  // A fingerprint of the running ROM (FNV-1a over its first 2 MB).
  function romHash(b) {
    try {
      var rom = b.read(0, 0x200000), h = 0x811c9dc5, any = 0;
      for (var i = 0; i < rom.length; i += 1) { h ^= rom[i]; h = Math.imul(h, 0x01000193) >>> 0; any |= rom[i]; }
      return any ? ('00000000' + h.toString(16)).slice(-8) : null;
    } catch (e) { return null; }
  }
  var loaded = false;
  function save() {
    if (!loaded) return;
    var s = { v: 1, items: {}, sections: {}, captured: {}, modified: [], pinned: Emo.pinned.map(function (l) { return l.Name; }),
      gt: { armed: gt.armed, at: gt.at } };
    Emo.items.forEach(function (it, i) { var st = it.saveState(); if (st) s.items[i + ':' + it.Name] = st; });
    Emo.locations.forEach(function (l) {
      l.Sections.forEach(function (sec) {
        if (sec.AvailableChestCount !== sec.ChestCount) s.sections[l.Name + '/' + sec.Name] = sec.AvailableChestCount;
        if (sec.captured) s.captured[l.Name + '/' + sec.Name] = sec.captured;
      });
      if (l.ModifiedByUser) s.modified.push(l.Name);
    });
    try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) {}
  }
  function restore() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (e) {}
    if (!s || s.v !== 1) return;
    Emo.batch(function () {
      Emo.items.forEach(function (it, i) { var st = s.items[i + ':' + it.Name]; if (st) { try { it.loadState(st); } catch (e) {} } });
      Object.keys(s.sections || {}).forEach(function (k) {
        var i = k.indexOf('/'), loc = Emo.locByName[k.slice(0, i).toLowerCase()], sec = loc && loc.findSection(k.slice(i + 1));
        if (sec) sec.AvailableChestCount = s.sections[k];
      });
      Object.keys(s.captured || {}).forEach(function (k) {
        var i = k.indexOf('/'), loc = Emo.locByName[k.slice(0, i).toLowerCase()], sec = loc && loc.findSection(k.slice(i + 1));
        if (sec) sec.captured = s.captured[k];
      });
      if (s.gt) { gt.armed = !!s.gt.armed; gt.at = s.gt.at == null ? null : s.gt.at; }
      (s.modified || []).forEach(function (n) { var l = Emo.locByName[n.toLowerCase()]; if (l) l.ModifiedByUser = true; });
      Emo.pinned = (s.pinned || []).map(function (n) { return Emo.locByName[n.toLowerCase()]; }).filter(Boolean);
    });
  }
  Emo.reset = function () {
    try { localStorage.removeItem(key()); } catch (e) {}
    location.reload();
  };

  // ── loading a pack ────────────────────────────────────────────────────────
  Emo.load = function (variant) {
    return fetch(BASE + 'files.json').then(function (r) { return r.json(); }).then(function (list) {
      list.forEach(function (f) { FILES.add(f); });
      return fetchJson('manifest.json');
    }).then(function (man) {
      Emo.manifest = man;
      var vs = Object.keys(man.variants || {});
      Emo.variant = variant && vs.indexOf(variant) >= 0 ? variant : (vs[0] || '');
      return exists('settings.json') ? fetchJson('settings.json').catch(function () { return {}; }) : {};
    }).then(function (st) {
      Emo.settings = st || {};
      if (!F) throw new Error('Lua runtime missing');
      luaInit();
      loadQueue = [];
      return fetchText('scripts/init.lua');
    }).then(function (src) {
      // init.lua only records what to load; then each step runs in order,
      // including scripts it asked for (whose own requests run right after).
      quiet++;
      run(src, '@scripts/init.lua');
      var queue = loadQueue;
      function next() {
        if (!queue.length) return Promise.resolve();
        var step = queue.shift(), kind = step[0], p = step[1];
        var done;
        if (kind === 'script') {
          done = exists(p) ? fetchText(p).then(function (t) {
            loadQueue = [];
            run(t, '@' + p);
            Array.prototype.unshift.apply(queue, loadQueue);
          }) : Promise.resolve();
        } else {
          done = exists(p) ? fetchJson(p).then(function (j) {
            if (kind === 'items') { (Array.isArray(j) ? j : []).forEach(function (d) { Emo.items.push(makeItem(d)); }); codeCache.clear(); }
            else if (kind === 'locations') addLocations(Array.isArray(j) ? j : []);
            else if (kind === 'maps') addMaps(Array.isArray(j) ? j : []);
            else if (kind === 'layouts') addLayouts(j);
          }).catch(function (e) { Emo.log.push(String(e)); }) : Promise.resolve();
        }
        return done.then(next);
      }
      loadQueue = [];
      return next();
    }).then(function () {
      codeCache.clear();
      applyPatches();
      // Rando Hub's starting settings: item placement Advanced (the
      // randomizer's default), or whatever the app says (?placement=basic)
      var pl = (params.get('placement') || 'advanced').toLowerCase();
      var ipm = findItem('item_placement_mode');
      if (ipm && ipm.stages) ipm.stages.some(function (st, i) { if (st.codes.has('item_placement_' + pl)) { ipm.CurrentStage = i; return true; } return false; });
      snapshotDefaults();
      var b = bridge(), g = b && b.ready() ? romHash(b) : null;
      if (g) { Emo.game = g; rememberGame(g); setTimeout(function () { loadRomMaps(b, g); }, 0); }
      restore();
      loaded = true;
      quiet = 0; dirty = false;
      refreshAccessibility();
      setInterval(tick, 100);
      return Emo;
    });
  };
  Emo.findItem = findItem;
  Emo.ruleLevelFor = ruleLevel;
  Emo.imageRef = imageRef;
  Emo.findCode = findCode;
  Emo.itemCount = itemCount;
  Emo.changed = changed;
  Emo.Section = Section;
  Emo.runLua = function (src) { return run(src, '=console'); };
})();
