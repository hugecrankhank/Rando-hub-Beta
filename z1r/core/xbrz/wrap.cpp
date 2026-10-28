// Rando Hub: xBRZ for the browser. RGB565 in, RGBA bytes out (what WebGL
// uploads), scaled 2..6 times. Everything else is Zenju's xbrz.cpp, unchanged.
#include "xbrz.h"
#include <cstdlib>
#include <cstring>
static uint16_t* in565 = nullptr; static uint32_t* src = nullptr; static uint32_t* dst = nullptr;
static int capIn = 0, capOut = 0;
extern "C" {
__attribute__((export_name("xb_input"))) uint16_t* xb_input(int w, int h) {
  int n = w * h;
  if (n > capIn) { free(in565); free(src); in565 = (uint16_t*)malloc(n * 2); src = (uint32_t*)malloc(n * 4); capIn = n; }
  return in565;
}
__attribute__((export_name("xb_scale"))) uint32_t* xb_scale(int factor, int w, int h) {
  int n = w * h, m = n * factor * factor;
  if (m > capOut) { free(dst); dst = (uint32_t*)malloc(m * 4); capOut = m; }
  for (int i = 0; i < n; i++) {   // RGB565 -> 0xFFRRGGBB (xBRZ's ARGB)
    unsigned p = in565[i], r = (p >> 11) & 31, g = (p >> 5) & 63, b = p & 31;
    src[i] = 0xFF000000u | ((r << 3 | r >> 2) << 16) | ((g << 2 | g >> 4) << 8) | (b << 3 | b >> 2);
  }
  xbrz::scale(factor, src, dst, w, h, xbrz::ColorFormat::RGB);
  for (int i = 0; i < m; i++) {   // 0xAARRGGBB -> bytes R,G,B,A in memory (little-endian 0xAABBGGRR)
    unsigned p = dst[i];
    dst[i] = 0xFF000000u | ((p & 0xFF) << 16) | (p & 0xFF00) | ((p >> 16) & 0xFF);
  }
  return dst;
}
}
