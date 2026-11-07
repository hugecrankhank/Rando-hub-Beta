# Z1Z3's ZORA mode: ZORA (https://github.com/tetraly/zora, MIT) as one world of two, through its
# own Archipelago interface (zora/archipelago.py): BUILD rolls a whole ZORA seed and lists the
# places items may go with their access rules; Rando Hub's fill puts Zelda 1's and A Link to the
# Past's items in both games' places; FINISH writes the Zelda 1 side (another game's item: FOREIGN).
import json
from dataclasses import replace
from zora import archipelago as ap
from zora.flags.codec import decode, encode
from zora.flags import zora_flags
from zora.flags.fields import ItemShuffleScope
from zora.generate.logic import model_to_json
from zora.model.item_names import ITEM_NAMES, ITEMS_BY_NAME
from zora.rom import inventory
from zora_web import multiworld as mw
from zora_web.api import flag_form

BUILT = {}


def normalize(flag_string, zora_flag_string):
    """The flags with what a shared seed always needs (as Archipelago: Item Shuffle Full, level
    data not encoded, the wooden sword not shuffled, custom music allowed), and what's left that
    ZORA's multiworld doesn't offer yet, worded for the player."""
    s = decode(flag_string)
    s.options[ap.ITEM_SHUFFLE_SCOPE.id] = ItemShuffleScope.FULL
    s.toggles[ap.FORCED_OFF] = False
    fixed = encode(s)
    z = zora_flags.decode(zora_flag_string or "")
    off = {name: (False if isinstance(getattr(z, name), bool) else type(getattr(z, name))(0))
           for name in ap.ZORA_FORCED_OFF if hasattr(z, name)}
    zfixed = zora_flags.encode(replace(z, **off)) if off else zora_flags.encode(z)
    try:
        mw.option_values(fixed, zfixed)
        reasons = []
    except mw.ExportRefused as e:
        reasons = e.reasons
    return fixed, zfixed, reasons


def check(flag_string, zora_flag_string):
    f, z, reasons = normalize(flag_string, zora_flag_string)
    return json.dumps({"flags": f, "zoraFlags": z, "refused": reasons})


def build(data, seed, flag_string, zora_flag_string):
    f, z, reasons = normalize(flag_string, zora_flag_string)
    if reasons:
        raise ValueError("ZORA can't share a seed with these flags yet: " + "; ".join(reasons))
    r = ap.build_from_strings(f, z, int(seed), bytes(data.to_py()))
    BUILT["r"] = r
    checks = ap.pickup_checks(r)
    rules = ap.give_rules(r)
    codes = {name: int(item) for name, item in ITEMS_BY_NAME.items()}
    enum_names = {item.name: name for item, name in ITEM_NAMES.items()}
    return json.dumps({
        "flags": f, "zoraFlags": z, "seed": int(seed),
        "places": [{"name": p.name, "kind": p.kind, "forbids": list(p.forbids), "hearts": p.hearts,
                    "item": item, "check": [checks[p.name].address, checks[p.name].mask]}
                   for p, item in zip(r.places, r.pool)],
        "logic": model_to_json(r.logic),
        "triforces": [list(t) for t in r.triforces],
        "codes": codes, "enumNames": enum_names,
        "receivable": sorted(ap.RECEIVABLE_ITEMS),
        "slots": list(inventory.item_slots()), "descriptors": list(inventory.item_descriptors()),
        "give": {"progressive": rules.progressive_items, "l4": rules.l4_sword, "fourPotions": rules.four_potions,
                 "boots": rules.pegasus_boots},
    })


def finish(assignment_json, received_json):
    r = BUILT["r"]
    a = {k: (ap.FOREIGN if v is None else v) for k, v in json.loads(assignment_json).items()}
    return ap.finish(r, a, json.loads(received_json), {"foreignItemLook": "rupee"})


def form_metadata():
    return json.dumps(flag_form.metadata())


def form_state(flag_string, zora_flag_string):
    return json.dumps(flag_form.form_state(flag_string, zora_flag_string))


def form_change(previous, values, zora_flag_string):
    return json.dumps(flag_form.form_change(previous, json.loads(values), zora_flag_string))


def zora_form_change(flag_string, zora_values):
    return json.dumps(flag_form.zora_form_change(flag_string, json.loads(zora_values)))
