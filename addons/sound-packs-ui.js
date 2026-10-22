/*
 * Rando Hub — sound pack controls (addon, see sound-packs.js).
 *
 *  Item Sounds window (bcast-sounds.html): a "Sound Pack" bar under the
 *    profile tabs — pick a pack, step to the next one, import a folder from
 *    the computer, delete an imported pack, pack volume.
 *  Broadcast view (broadcast.html): a "♪ Pack" button beside "♪ Item Sounds"
 *    that steps to the next pack (Off → each pack → Mix → Off…).
 */
(function () {
  'use strict';
  var SP = window.RandoSoundPacks;
  if (!SP) return;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    if (text) e.textContent = text;
    return e;
  }

  // ── Broadcast view button ─────────────────────────────────────────────────
  var soundsBtn = document.getElementById('item-sounds-btn');
  if (soundsBtn) {
    var packBtn = el('button', { class: soundsBtn.className, id: 'rh-sound-pack-btn', type: 'button' });
    var paint = function () {
      packBtn.textContent = '♪ Pack: ' + SP.activeName().replace(' (Item Sounds profile)', '');
      packBtn.title = 'Item sound pack — click for the next one';
    };
    packBtn.onclick = function () { SP.next(); };
    soundsBtn.parentNode.insertBefore(packBtn, soundsBtn.nextSibling);
    SP.onChange(paint);
    paint();
  }

  // ── Item Sounds window ────────────────────────────────────────────────────
  var profileBar = document.querySelector('.profile-bar');
  if (!profileBar || !document.getElementById('item-list')) return;

  var css = el('style');
  css.textContent =
    '.rh-pack{padding:8px 14px;border-bottom:1px solid #222;display:flex;flex-direction:column;gap:6px;flex-shrink:0}' +
    '.rh-pack-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
    '.rh-pack select{background:#22242a;border:1px solid #3a3d45;color:#e6e8eb;border-radius:4px;padding:3px 6px;font-size:12px;max-width:190px}' +
    '.rh-pack .rh-note{font-size:11px;color:#888;line-height:1.5}' +
    '.rh-pack .rh-msg{font-size:11px;color:#8c8}.rh-pack .rh-msg.err{color:#c66}' +
    '.rh-pack input[type=range]{width:70px;accent-color:#88c}';
  document.head.appendChild(css);

  var box = el('div', { class: 'rh-pack' });
  var row1 = el('div', { class: 'rh-pack-row' });
  row1.appendChild(el('span', { class: 'profile-label' }, 'Sound Pack'));
  var sel = el('select', { title: 'Which pack plays on item pickups' });
  var nextBtn = el('button', { type: 'button', title: 'Next pack' }, 'Next ▸');
  var importBtn = el('button', { type: 'button', title: 'Pick a pack folder from this computer' }, 'Import folder…');
  var delBtn = el('button', { type: 'button', class: 'btn-clear', title: 'Delete this imported pack' }, 'Delete');
  row1.appendChild(sel); row1.appendChild(nextBtn); row1.appendChild(importBtn); row1.appendChild(delBtn);

  var row2 = el('div', { class: 'rh-pack-row' });
  row2.appendChild(el('span', { class: 'profile-label' }, 'Pack volume'));
  var vol = el('input', { type: 'range', min: '0', max: '100' });
  row2.appendChild(vol);
  var info = el('span', { class: 'rh-note' });
  row2.appendChild(info);

  var note = el('div', { class: 'rh-note' },
    'A pack is a folder with one folder per item (hookshot, fire rod, master sword…) holding as many sounds as you like; ' +
    'each pickup plays one at random. Items the pack doesn’t cover use this profile’s sound. ' +
    'Crowd Control can switch packs too (sound_pack_next / sound_pack_random).');
  var msg = el('div', { class: 'rh-msg' });

  var picker = el('input', { type: 'file', multiple: '', style: 'display:none' });
  picker.setAttribute('webkitdirectory', '');
  picker.setAttribute('directory', '');

  box.appendChild(row1); box.appendChild(row2); box.appendChild(note); box.appendChild(msg); box.appendChild(picker);
  profileBar.parentNode.insertBefore(box, profileBar.nextSibling);

  function say(text, bad) { msg.textContent = text || ''; msg.className = 'rh-msg' + (bad ? ' err' : ''); }

  function render() {
    var active = SP.getActive();
    sel.innerHTML = '';
    SP.choices().forEach(function (id) {
      var p = null;
      SP.packs().forEach(function (x) { if (x.id === id) p = x; });
      var label = SP.activeName(id) + (p ? (p.kind === 'builtin' ? '  (built-in)' : '  (imported)') : '');
      var o = el('option', { value: id }, label);
      if (id === active) o.selected = true;
      sel.appendChild(o);
    });
    if (active && SP.choices().indexOf(active) === -1) sel.value = '';
    var cur = null;
    SP.packs().forEach(function (x) { if (x.id === active) cur = x; });
    delBtn.style.display = cur && cur.kind === 'local' ? '' : 'none';
    vol.value = Math.round(SP.volume() * 100);
    if (cur) {
      var keys = Object.keys(cur.items), n = 0;
      keys.forEach(function (k) { n += cur.items[k].length; });
      info.textContent = n + ' sounds for ' + keys.length + ' items';
    } else if (active === SP.MIX) {
      info.textContent = SP.packs().length + ' packs mixed';
    } else {
      info.textContent = SP.packs().length ? '' : 'No packs yet';
    }
  }

  sel.onchange = function () { SP.setActive(sel.value); say(''); };
  nextBtn.onclick = function () { SP.next(); say(''); };
  vol.oninput = function () { SP.setVolume(parseInt(vol.value, 10)); };
  importBtn.onclick = function () { picker.value = ''; picker.click(); };
  picker.onchange = function () {
    say('Importing…');
    SP.importFiles(picker.files).then(function (r) {
      var made = r.packs.map(function (p) { return p.name + ' (' + p.sounds + ')'; }).join(', ');
      if (r.packs.length) SP.setActive(r.packs[r.packs.length - 1].id);
      say('Imported ' + made + (r.skipped.length ? '. Skipped folders not named after an item: ' + r.skipped.slice(0, 6).join(', ') + (r.skipped.length > 6 ? '…' : '') : ''));
    }).catch(function (e) { say(e.message || String(e), true); });
  };
  delBtn.onclick = function () {
    var id = SP.getActive();
    if (!confirm('Delete the imported pack "' + SP.activeName(id) + '"?')) return;
    SP.removePack(id).then(function () { say('Pack deleted'); }).catch(function (e) { say(e.message, true); });
  };

  SP.onChange(render);
  SP.ready().then(render);
  render();
})();
