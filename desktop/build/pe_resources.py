#!/usr/bin/env python3
"""Give a Windows .exe (electron.exe) its own icon and version information
without Windows or Wine: the resource tree is rebuilt with the new icon and
version entries and added as a new section at the end of the file; the old
resources are left in place, unused.

    python3 pe_resources.py IN.exe OUT.exe ICON.ico KEY=VALUE...

KEY=VALUE pairs become the version strings (FileDescription, ProductName,
CompanyName, LegalCopyright, InternalName, OriginalFilename). FileVersion and
ProductVersion come from VERSION=1.2.3.

Needs pefile (https://github.com/erocarrera/pefile) on PYTHONPATH.
"""
import struct, sys
import pefile

RT_ICON, RT_GROUP_ICON, RT_VERSION = 3, 14, 16
LANG = 1033


def align(n, a):
    return (n + a - 1) // a * a


# ── icons ─────────────────────────────────────────────────────────────────────
def read_ico(path):
    data = open(path, 'rb').read()
    _, typ, count = struct.unpack_from('<HHH', data, 0)
    assert typ == 1, 'not an .ico'
    frames = []
    for i in range(count):
        w, h, cc, res, planes, bpp, size, off = struct.unpack_from('<BBBBHHII', data, 6 + 16 * i)
        frames.append(((w, h, cc, res, planes, bpp), data[off:off + size]))
    return frames


def group_icon(frames):
    out = struct.pack('<HHH', 0, 1, len(frames))
    for i, ((w, h, cc, res, planes, bpp), blob) in enumerate(frames):
        out += struct.pack('<BBBBHHIH', w, h, cc, res, planes, bpp, len(blob), i + 1)
    return out


# ── version info ──────────────────────────────────────────────────────────────
def node(key, value=b'', wtype=1, children=(), value_len=None):
    k = (key + '\0').encode('utf-16-le')
    body = struct.pack('<HHH', 0, 0, wtype) + k
    body += b'\0' * (align(len(body), 4) - len(body))
    body += value
    for c in children:
        body += b'\0' * (align(len(body), 4) - len(body))
        body += c
    if value_len is None:
        value_len = len(value) // 2 if wtype == 1 else len(value)
    return struct.pack('<HH', len(body), value_len) + body[4:]


def version_info(strings, version):
    parts = [int(x) for x in (version.split('.') + ['0'] * 4)[:4]]
    ms, ls = (parts[0] << 16) | parts[1], (parts[2] << 16) | parts[3]
    fixed = struct.pack('<13I', 0xFEEF04BD, 0x00010000, ms, ls, ms, ls, 0x3F, 0, 0x00040004, 1, 0, 0, 0)
    entries = [node(k, (v + '\0').encode('utf-16-le')) for k, v in strings.items()]
    table = node('040904b0', children=entries)
    sfi = node('StringFileInfo', children=[table])
    var = node('Translation', struct.pack('<HH', 0x0409, 0x04B0), wtype=0)
    vfi = node('VarFileInfo', children=[var])
    return node('VS_VERSION_INFO', fixed, wtype=0, children=[sfi, vfi])


# ── resource tree ─────────────────────────────────────────────────────────────
def read_tree(pe):
    """{type: {name_or_id: {lang: bytes}}} (ids only: Electron uses no names)."""
    tree = {}
    for t in pe.DIRECTORY_ENTRY_RESOURCE.entries:
        assert t.name is None, 'named resource types not supported'
        for e in t.directory.entries:
            assert e.name is None, 'named resources not supported'
            for l in e.directory.entries:
                d = l.data.struct
                tree.setdefault(t.id, {}).setdefault(e.id, {})[l.id] = pe.get_data(d.OffsetToData, d.Size)
    return tree


def build_tree(tree, base_rva):
    """Serialise: all directories, then data entries, then the data itself."""
    types = sorted(tree)
    # directory layout
    dirs, order = [], []   # order of (level, key) for offsets
    off = 0
    root_size = 16 + 8 * len(types)
    type_dirs = {}
    off = root_size
    for t in types:
        type_dirs[t] = off
        off += 16 + 8 * len(tree[t])
    name_dirs = {}
    for t in types:
        for n in sorted(tree[t]):
            name_dirs[(t, n)] = off
            off += 16 + 8 * len(tree[t][n])
    data_entries = {}
    for t in types:
        for n in sorted(tree[t]):
            for l in sorted(tree[t][n]):
                data_entries[(t, n, l)] = off
                off += 16
    blobs = {}
    for key in data_entries:
        off = align(off, 8)
        t, n, l = key
        blobs[key] = off
        off += len(tree[t][n][l])
    total = off
    buf = bytearray(total)

    def dir_header(at, count):
        struct.pack_into('<IIHHHH', buf, at, 0, 0, 0, 0, 0, count)

    dir_header(0, len(types))
    for i, t in enumerate(types):
        struct.pack_into('<II', buf, 16 + 8 * i, t, 0x80000000 | type_dirs[t])
        names = sorted(tree[t])
        dir_header(type_dirs[t], len(names))
        for j, n in enumerate(names):
            struct.pack_into('<II', buf, type_dirs[t] + 16 + 8 * j, n, 0x80000000 | name_dirs[(t, n)])
            langs = sorted(tree[t][n])
            dir_header(name_dirs[(t, n)], len(langs))
            for k, l in enumerate(langs):
                struct.pack_into('<II', buf, name_dirs[(t, n)] + 16 + 8 * k, l, data_entries[(t, n, l)])
                blob = tree[t][n][l]
                struct.pack_into('<IIII', buf, data_entries[(t, n, l)], base_rva + blobs[(t, n, l)], len(blob), 0, 0)
                buf[blobs[(t, n, l)]:blobs[(t, n, l)] + len(blob)] = blob
    return bytes(buf)


def main():
    src, dst, ico = sys.argv[1:4]
    kv = dict(a.split('=', 1) for a in sys.argv[4:])
    version = kv.pop('VERSION', '1.0.0')
    strings = {'CompanyName': '', 'FileDescription': '', 'FileVersion': version, 'InternalName': '',
               'LegalCopyright': '', 'OriginalFilename': '', 'ProductName': '', 'ProductVersion': version}
    strings.update(kv)

    pe = pefile.PE(src)
    sec_dir = pe.OPTIONAL_HEADER.DATA_DIRECTORY[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_SECURITY']]
    tree = read_tree(pe)
    frames = read_ico(ico)
    tree[RT_ICON] = {i + 1: {LANG: blob} for i, (_, blob) in enumerate(frames)}
    tree[RT_GROUP_ICON] = {1: {LANG: group_icon(frames)}}
    tree[RT_VERSION] = {1: {LANG: version_info(strings, version)}}

    oh = pe.OPTIONAL_HEADER
    fa, sa = oh.FileAlignment, oh.SectionAlignment
    last = pe.sections[-1]
    new_rva = align(last.VirtualAddress + max(last.Misc_VirtualSize, last.SizeOfRawData), sa)
    rsrc = build_tree(tree, new_rva)
    raw = bytearray(pe.__data__)
    if sec_dir.Size:   # drop the signature: it would no longer match anyway
        del raw[sec_dir.VirtualAddress:]
    new_raw_off = align(last.PointerToRawData + last.SizeOfRawData, fa)
    assert len(raw) <= new_raw_off or sec_dir.Size, 'unexpected data after the last section'
    del raw[new_raw_off:]
    raw += b'\0' * (new_raw_off - len(raw))
    raw_size = align(len(rsrc), fa)
    raw += rsrc + b'\0' * (raw_size - len(rsrc))

    # new section header after the last one
    hdr_off = last.get_file_offset() + 40
    assert hdr_off + 40 <= oh.SizeOfHeaders, 'no room for another section header'
    assert raw[hdr_off:hdr_off + 40] == b'\0' * 40, 'section header slot is in use'
    IMAGE_SCN = 0x40000000 | 0x00000040   # MEM_READ | CNT_INITIALIZED_DATA
    struct.pack_into('<8sIIIIIIHHI', raw, hdr_off, b'.rsrc2', len(rsrc), new_rva, raw_size, new_raw_off, 0, 0, 0, 0, IMAGE_SCN)

    fh_off = pe.FILE_HEADER.get_file_offset()
    struct.pack_into('<H', raw, fh_off + 2, pe.FILE_HEADER.NumberOfSections + 1)
    oh_off = oh.get_file_offset()
    pe2 = pefile.PE(data=bytes(raw), fast_load=True)
    pe2.OPTIONAL_HEADER.SizeOfImage = align(new_rva + len(rsrc), sa)
    rd = pe2.OPTIONAL_HEADER.DATA_DIRECTORY[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_RESOURCE']]
    rd.VirtualAddress, rd.Size = new_rva, len(rsrc)
    sd = pe2.OPTIONAL_HEADER.DATA_DIRECTORY[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_SECURITY']]
    sd.VirtualAddress, sd.Size = 0, 0
    out = bytearray(pe2.write())
    pe3 = pefile.PE(data=bytes(out), fast_load=True)
    pe3.OPTIONAL_HEADER.CheckSum = pe3.generate_checksum()
    open(dst, 'wb').write(pe3.write())
    print(f'{dst}: resources {len(rsrc)} bytes at RVA {new_rva:#x}, {len(frames)} icon images')


if __name__ == '__main__':
    main()
