// Minimal libretro frontend for running snes9x inside the browser.
// Built with wasi-sdk as a WASI "reactor": JS calls the exported functions
// below, reads the frame/audio buffers straight out of linear memory, and
// reads WRAM/SRAM/ROM pointers directly for the tracker bridge.

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>
#include "libretro.h"
#include "snes9x.h"
#include "memmap.h"

#define EXPORT(name) __attribute__((export_name(#name)))

// ---------- video ----------
static uint16_t frame_buf[512 * 480];   // packed RGB565, width*height
static unsigned frame_w = 256, frame_h = 224;
static unsigned frame_serial = 0;

static void video_cb(const void *data, unsigned w, unsigned h, size_t pitch) {
  if (!data) return;                     // frame dupe: keep previous
  if (w > 512) w = 512;
  if (h > 480) h = 480;
  const uint8_t *src = (const uint8_t *)data;
  for (unsigned y = 0; y < h; y++)
    memcpy(frame_buf + y * w, src + y * pitch, w * 2);
  frame_w = w; frame_h = h; frame_serial++;
}

// ---------- audio ----------
#define AUDIO_CAP 16384                  // stereo frames
static int16_t audio_buf[AUDIO_CAP * 2];
static unsigned audio_len = 0;           // frames written since last drain

static size_t audio_batch_cb(const int16_t *data, size_t frames) {
  size_t room = AUDIO_CAP - audio_len;
  size_t n = frames < room ? frames : room;
  memcpy(audio_buf + audio_len * 2, data, n * 4);
  audio_len += n;
  return frames;
}
static void audio_cb(int16_t l, int16_t r) {
  int16_t s[2] = { l, r };
  audio_batch_cb(s, 1);
}

// ---------- input ----------
static uint16_t pad_state[2];            // RETRO_DEVICE_ID_JOYPAD_* bitmask

static void input_poll_cb(void) {}
static int16_t input_state_cb(unsigned port, unsigned device, unsigned index, unsigned id) {
  if (port > 1 || (device & RETRO_DEVICE_MASK) != RETRO_DEVICE_JOYPAD) return 0;
  if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)pad_state[port];
  return (pad_state[port] >> id) & 1;
}

// ---------- environment ----------
static enum retro_pixel_format pixfmt = RETRO_PIXEL_FORMAT_0RGB1555;
static struct retro_system_av_info av;

static void log_printf(enum retro_log_level level, const char *fmt, ...) {
  if (level < RETRO_LOG_WARN) return;
  va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap);
}

static bool environ_cb(unsigned cmd, void *data) {
  switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
      pixfmt = *(enum retro_pixel_format *)data;
      return pixfmt == RETRO_PIXEL_FORMAT_RGB565;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
      ((struct retro_log_callback *)data)->log = log_printf;
      return true;
    case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:
      return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE:
      *(bool *)data = true;
      return true;
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
    case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
      *(const char **)data = "/";
      return true;
    case RETRO_ENVIRONMENT_SET_GEOMETRY:
      av.geometry = *(const struct retro_game_geometry *)data;
      return true;
    case RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO:
      av = *(const struct retro_system_av_info *)data;
      return true;
    case RETRO_ENVIRONMENT_GET_CORE_OPTIONS_VERSION:
      *(unsigned *)data = 0;
      return true;
    default:
      return false;                      // variables etc. -> core defaults
  }
}

// ---------- exports ----------
static uint8_t *rom_data = NULL;
static bool loaded = false;

EXPORT(s9x_alloc) void *s9x_alloc(uint32_t n) { return malloc(n); }
EXPORT(s9x_free) void s9x_free(void *p) { free(p); }

EXPORT(s9x_init) void s9x_init(void) {
  retro_set_environment(environ_cb);
  retro_set_video_refresh(video_cb);
  retro_set_audio_sample(audio_cb);
  retro_set_audio_sample_batch(audio_batch_cb);
  retro_set_input_poll(input_poll_cb);
  retro_set_input_state(input_state_cb);
  retro_init();
}

// Takes ownership of a buffer from s9x_alloc. Returns 1 on success.
EXPORT(s9x_load) int s9x_load(uint8_t *data, uint32_t size) {
  if (loaded) { retro_unload_game(); loaded = false; }
  if (rom_data) free(rom_data);
  rom_data = data;
  struct retro_game_info info = { "game.sfc", data, size, NULL };
  if (!retro_load_game(&info)) return 0;
  retro_get_system_av_info(&av);
  retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
  retro_set_controller_port_device(1, RETRO_DEVICE_JOYPAD);
  loaded = true;
  return 1;
}

EXPORT(s9x_reset) void s9x_reset(void) { if (loaded) retro_reset(); }

EXPORT(s9x_run) void s9x_run(uint32_t pad1, uint32_t pad2) {
  if (!loaded) return;
  pad_state[0] = pad1; pad_state[1] = pad2;
  retro_run();
}

EXPORT(s9x_frame_ptr) void *s9x_frame_ptr(void) { return frame_buf; }
EXPORT(s9x_frame_w) unsigned s9x_frame_w(void) { return frame_w; }
EXPORT(s9x_frame_h) unsigned s9x_frame_h(void) { return frame_h; }
EXPORT(s9x_frame_serial) unsigned s9x_frame_serial(void) { return frame_serial; }

EXPORT(s9x_audio_ptr) void *s9x_audio_ptr(void) { return audio_buf; }
EXPORT(s9x_audio_take) unsigned s9x_audio_take(void) { unsigned n = audio_len; audio_len = 0; return n; }
EXPORT(s9x_sample_rate) double s9x_sample_rate(void) { return av.timing.sample_rate; }
EXPORT(s9x_fps) double s9x_fps(void) { return av.timing.fps; }

// Memory regions: 0 = WRAM (128 KB), 1 = SRAM, 2 = ROM
EXPORT(s9x_mem_ptr) void *s9x_mem_ptr(int which) {
  if (!loaded) return NULL;
  if (which == 0) return retro_get_memory_data(RETRO_MEMORY_SYSTEM_RAM);
  if (which == 1) return retro_get_memory_data(RETRO_MEMORY_SAVE_RAM);
  if (which == 2) return Memory.ROM;
  return NULL;
}
EXPORT(s9x_mem_size) uint32_t s9x_mem_size(int which) {
  if (!loaded) return 0;
  if (which == 0) return retro_get_memory_size(RETRO_MEMORY_SYSTEM_RAM);
  if (which == 1) return retro_get_memory_size(RETRO_MEMORY_SAVE_RAM);
  if (which == 2) return Memory.CalculatedSize;
  return 0;
}

// Save states: serialize into a core-owned buffer that JS copies out.
static uint8_t *state_buf = NULL;
static size_t state_cap = 0;
EXPORT(s9x_state_size) uint32_t s9x_state_size(void) { return loaded ? retro_serialize_size() : 0; }
EXPORT(s9x_state_buf) void *s9x_state_buf(void) {
  size_t n = retro_serialize_size();
  if (n > state_cap) { free(state_buf); state_buf = (uint8_t *)malloc(n); state_cap = n; }
  return state_buf;
}
EXPORT(s9x_state_save) int s9x_state_save(void) {
  if (!loaded) return 0;
  void *b = s9x_state_buf();
  return retro_serialize(b, retro_serialize_size()) ? 1 : 0;
}
// JS writes the state into s9x_state_buf() first.
EXPORT(s9x_state_load) int s9x_state_load(uint32_t size) {
  if (!loaded || !state_buf) return 0;
  return retro_unserialize(state_buf, size) ? 1 : 0;
}
