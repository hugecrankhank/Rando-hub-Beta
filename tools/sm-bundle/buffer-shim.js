// Just enough of Node's Buffer for DASH's core: base64 both ways over bytes.
export const Buffer = {
  from(x, enc) {
    if (typeof x === 'string' && enc === 'base64') { const s = atob(x); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return wrap(u); }
    return wrap(x instanceof Uint8Array ? x : new Uint8Array(x));
  },
};
function wrap(u) { u.toString = function (enc) { if (enc === 'base64') { let s = ''; for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]); return btoa(s); } return Uint8Array.prototype.toString.call(this); }; return u; }
