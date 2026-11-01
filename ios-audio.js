/*
 * ios-audio.js — iPhone / iPad: let go of the audio session in the background.
 *
 * The emulators set navigator.audioSession.type = 'playback' so game sound
 * plays with the mute switch on. iOS then treats the page like a music player:
 * a Now Playing card on the lock screen, kept even after the app is swiped
 * away. So when the page goes to the background (which iOS always does before
 * a force-close) every AudioContext registered here is suspended, the session
 * goes back to 'auto' and Now Playing is cleared; back in front, 'playback'
 * again (the sound itself comes back with the next tap, as iOS requires).
 * Computers are left alone: a stream captures a covered or minimised window.
 *
 *   RHIosAudio.add(audioContext)   each emulator's audio.js registers its context
 */
(function () {
  'use strict';
  if (window.RHIosAudio) return;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  var ctxs = [];
  function set(hidden) {
    try { if (navigator.audioSession) navigator.audioSession.type = hidden ? 'auto' : 'playback'; } catch (e) {}
    try { if (navigator.mediaSession) { navigator.mediaSession.playbackState = hidden ? 'none' : 'playing'; if (hidden) navigator.mediaSession.metadata = null; } } catch (e) {}
    ctxs.forEach(function (c) { try { if (hidden) { if (c.state === 'running') c.suspend(); } else if (c.state === 'suspended') c.resume(); } catch (e) {} });
  }
  if (ios) {
    document.addEventListener('visibilitychange', function () { set(document.visibilityState === 'hidden'); });
    window.addEventListener('pagehide', function () { set(true); });
    window.addEventListener('pageshow', function () { if (document.visibilityState === 'visible') set(false); });
  }
  window.RHIosAudio = { ios: ios, get states() { return ctxs.map(function (c) { return c.state; }); }, add: function (c) { if (c && ctxs.indexOf(c) < 0) ctxs.push(c); if (ios && document.visibilityState === 'hidden') set(true); } };
})();
