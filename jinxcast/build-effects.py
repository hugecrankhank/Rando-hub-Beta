#!/usr/bin/env python3
"""Rebuild jinxcast/randohub-effects.json from Rando Hub's own effect lists.

    python3 jinxcast/build-effects.py [snack-os/server]

Reads the effect lists straight out of crowd/effects.js (ALTTPR) and
z1r/js/crowd.js (Z1R) with Node, adds the metadata below (icon, category,
blurb), and writes randohub-effects.json. Run it after adding or renaming a
crowd effect; it stops and names any effect that has no metadata yet.

Optional: the path of a Snack OS server/ folder. Then each effect also names
the closest JinxCast effect that already exists (jinxcast_equivalent), and
house: true marks the Rando Hub originals.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUMP = r"""
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.document = { addEventListener() {} };
globalThis.setInterval = () => 0;
const a = require(process.argv[1] + '/crowd/effects.js').list();
require(process.argv[1] + '/z1r/js/crowd.js');
console.log(JSON.stringify({ alttp: a, z1: globalThis.Z1Crowd.list() }));
"""
lists = json.loads(subprocess.run(['node', '-e', DUMP, ROOT], capture_output=True, text=True, check=True).stdout)
alttp, z1 = lists['alttp'], lists['z1']

snack = sys.argv[1] if len(sys.argv) > 1 else None
def ids(name):
    if not snack: return None
    return {e['id'] for e in json.load(open(os.path.join(snack, name), encoding='utf-8'))['effects']}
snack_alttp, snack_z1 = ids('alttp-effects.json'), ids('zelda1-effects.json')
out_path = os.path.join(HERE, 'randohub-effects.json')

# id: (icon, category, blurb, {game: closest JinxCast effect id})
M = {
 'heal_full': ('❤️', 'items', 'Every heart refilled.', {'z1': 'full_heal'}),
 'heal_1': ('💗', 'items', 'One heart back.', {'alttp': 'fill_hearts'}),
 'hurt_2': ('💔', 'items', 'Two hearts gone. Never kills.', {'alttp': 'empty_hearts', 'z1': 'deal_heart'}),
 'hp_1': ('🩸', 'items', 'Straight down to one heart.', {'z1': 'near_death'}),
 'magic_full': ('🧪', 'items', 'Magic meter refilled.', {'alttp': 'fill_magic'}),
 'magic_drain': ('🫗', 'items', 'Magic meter emptied.', {'alttp': 'empty_magic'}),
 'magic_small': ('💧', 'items', 'A quarter of the magic meter back.', {}),
 'rupees_plus': ('💰', 'items', '+50 rupees.', {'z1': 'give_rupees'}),
 'rupees_minus': ('💸', 'items', '-50 rupees.', {'z1': 'steal_rupees'}),
 'bombs_plus': ('💣', 'items', 'More bombs (10 in ALTTP, 4 in Zelda 1).', {'alttp': 'give_bombs', 'z1': 'give_bombs'}),
 'bombs_none': ('🚫', 'items', 'Every bomb gone.', {'alttp': 'take_bombs', 'z1': 'empty_bombs'}),
 'arrows_plus': ('🏹', 'items', '+10 arrows.', {}),
 'arrows_none': ('🚫', 'items', 'Every arrow gone.', {}),
 'fairy': ('🧚', 'items', 'A fairy in the first empty bottle.', {}),
 'bee_bottle': ('🐝', 'items', 'A bee in the first empty bottle.', {}),
 'clock': ('⏱️', 'items', 'The clock item: enemies on screen stand still until Link leaves it.', {}),

 'invert': ('🔄', 'player', 'D-pad turned inside out.', {'alttp': 'reverse_controls'}),
 'no_sword': ('🗡️', 'player', 'The sword button does nothing.', {}),
 'no_item': ('✋', 'player', 'The item button does nothing.', {}),
 'swap_by': ('🔀', 'player', 'Sword and item buttons swapped.', {}),
 'freeze': ('🥶', 'player', 'Link can\'t move.', {'alttp': 'freeze'}),
 'one_hit': ('☠️', 'player', 'One-hit KO: any hit kills (ALTTP: a fairy or the cape still saves him). Zelda 1: one-heart mode.', {}),
 'no_magic': ('🔒', 'player', 'Magic locked.', {}),
 'insta_kill': ('💀', 'player', 'Instant death. A bottled fairy still saves him.', {}),
 'pink_link': ('🩷', 'player', 'Pink Link.', {}),
 'ghost_link': ('👻', 'player', 'Pale ghostly Link.', {}),
 'pumpkin_link': ('🎃', 'player', 'Orange pumpkin Link.', {}),
 'follower_random': ('🚶', 'chaos', 'A random follower tags along (and stays: chaos).', {}),

 'shield_off': ('🛡️', 'equipment', 'Shield gone for a while; the same one comes back.', {}),
 'shield_steal': ('🛡️', 'equipment', 'Shield stolen until Link finds another.', {}),
 'shield_down': ('🛡️', 'equipment', 'Shield one step worse (stops at the Fighter\'s Shield).', {}),
 'shield_up': ('🛡️', 'equipment', 'Shield one step better.', {'alttp': 'upgrade_shield'}),
 'sword_off': ('⚔️', 'equipment', 'Sword gone for a while; the same one comes back.', {'z1': 'lose_sword'}),
 'sword_down': ('⚔️', 'equipment', 'Sword one step worse for a while, then back.', {'alttp': 'debuff_sword'}),
 'sword_up': ('⚔️', 'equipment', 'Sword one step better for good.', {'alttp': 'upgrade_sword', 'z1': 'white_sword'}),
 'sword_steal': ('⚔️', 'equipment', 'Sword stolen until Link finds another. Can make a seed unbeatable.', {}),
 'master_sword': ('🗡️', 'equipment', 'Exactly the Master Sword for a while, whatever Link has (a gift early, a curse late).', {}),
 'master_lock': ('🔐', 'equipment', 'Master Sword for good; swords found are swallowed until unlocked.', {}),
 'master_unlock': ('🔓', 'equipment', 'Lets go of the Master Sword lock.', {}),
 'heart_add': ('➕', 'equipment', '+1 heart container (20 at most).', {'alttp': 'give_heart_container'}),
 'heart_remove': ('➖', 'equipment', '-1 heart container (never below 1).', {'alttp': 'take_heart_container'}),
 'tunic_up': ('👕', 'equipment', 'Tunic one step better (green, blue, red), colours and all.', {}),
 'tunic_down': ('👕', 'equipment', 'Tunic one step worse.', {}),
 'item_off': ('🎒', 'equipment', 'A random item Link has is gone for a while, then back.', {}),
 'ring_off': ('💍', 'equipment', 'Ring gone for a while.', {'z1': 'strip_ring'}),
 'ring_down': ('💍', 'equipment', 'Ring one step worse for a while.', {}),
 'ring_up': ('💍', 'equipment', 'Ring one step better.', {'z1': 'blue_ring'}),
 'candle_off': ('🕯️', 'equipment', 'Candle gone for a while.', {}),
 'bow_off': ('🏹', 'equipment', 'Bow gone for a while.', {}),
 'boomerang_off': ('🪃', 'equipment', 'Boomerang gone for a while.', {}),
 'rod_off': ('🪄', 'equipment', 'Magical Rod gone for a while.', {}),
 'ladder_off': ('🪜', 'equipment', 'Ladder gone for a while.', {}),
 'raft_off': ('🛶', 'equipment', 'Raft gone for a while.', {}),

 'enemy_spawn': ('👾', 'enemies', 'Copies an enemy already in the room.', {'alttp': 'clone_one'}),
 'enemy_random': ('👹', 'enemies', 'A random enemy that fits the area\'s loaded graphics.', {}),
 'enemy_any': ('🐉', 'enemies', 'Any of 74 enemies, anywhere: its graphics are loaded in first.', {}),
 'spooky_monster': ('🦇', 'enemies', 'A Poe, Keese, Gibdo, Stalfos or similar near Link.', {}),
 'haunting': ('🕸️', 'enemies', 'Three spooky monsters.', {}),
 'monster_mash': ('🧟', 'enemies', 'Every enemy on screen becomes a bat or a mummy.', {}),
 'cucco_storm': ('🐔', 'chaos', 'Angry cuccos fly at Link (outdoor time only).', {'alttp': 'cucco_attack'}),
 'ice': ('🧊', 'chaos', 'Slippery floors everywhere.', {'alttp': 'ice_floor'}),
 'trick_or_treat': ('🍬', 'chaos', '50/50: a treat or a trick effect.', {}),
 'reveal_item': ('🔎', 'misc', 'Shows where one go-mode item is, on the game and on the hub\'s map. Hub-made seeds only.', {}),

 'warp_dungeon': ('🏰', 'teleports', 'Drops Link into a random dungeon entrance.', {'alttp': 'warp_random_dungeon'}),
 'warp_flute': ('🐦', 'teleports', 'Flute bird to a random flute spot.', {}),
 'warp_random': ('🌀', 'teleports', 'ALTTP: flute spot or dungeon, 50/50. Zelda 1: whirlwind to a random level.', {'z1': 'warp_random'}),
 'home': ('🏠', 'teleports', 'Back to Link\'s front door (Zelda 1: the start screen).', {'alttp': 'warp_links_house'}),
 'jail': ('⛓️', 'teleports', 'Locked in a cell for a while.', {}),
 'warp_9': ('🏔️', 'teleports', 'Level 9\'s entrance on Death Mountain.', {'z1': 'warp_d9'}),
 'warp_9_in': ('🏔️', 'teleports', 'Straight inside Level 9.', {}),

 'mirror': ('🪞', 'environmental', 'Picture flipped left-right.', {}),
 'upside_down': ('🙃', 'environmental', 'Picture upside down.', {}),
 'wobble': ('🥴', 'environmental', 'Drunk wobble.', {}),
 'tiny': ('🔍', 'environmental', 'Half-size picture.', {}),
 'crt': ('📺', 'environmental', 'Retro CRT filter.', {}),
 'speed_up': ('⏩', 'environmental', 'The whole game at 1.5x speed.', {}),
 'slow_mo': ('🐢', 'environmental', 'The whole game at half speed.', {}),
 'lights_on': ('💡', 'environmental', 'A dark room as bright as with every torch lit.', {}),
 'lights_out': ('🌑', 'environmental', 'Rooms nearly black, outdoors dimmed.', {'alttp': 'blackout'}),
 'spooky_night': ('🌙', 'environmental', 'Every colour but Link\'s turned purple and orange.', {}),
 'fog': ('🌫️', 'environmental', 'Fog rolls over the screen.', {}),
 'rain': ('🌧️', 'environmental', 'Rain over the screen.', {}),
 'haunted_lights': ('⚡', 'environmental', 'Screen dims and flickers, with lightning now and then.', {}),
 'blood_drip': ('🩸', 'environmental', 'Blood runs down from the top of the screen.', {}),
 'spider_web': ('🕷️', 'environmental', 'Spiderwebs in the corners and a dangling spider.', {}),

 'music_roulette': ('🎵', 'audio', 'A random song from the MSU-1 pack.', {'alttp': 'music_swap'}),
 'msu_roll': ('🎶', 'audio', 'A random MSU-1 pack from the streamer\'s favourites.', {}),
 'sound_pack_next': ('🔔', 'audio', 'Next item sound pack.', {}),
 'sound_pack_random': ('🔔', 'audio', 'Random item sound pack.', {}),
 'sprite_roll': ('🎭', 'misc', 'Random sprite from the whole library.', {}),
 'sprite_fav': ('⭐', 'misc', 'Random sprite from the streamer\'s favourites.', {}),
 'spooky_sprite': ('🧛', 'misc', 'Random Halloween-ish sprite.', {}),

 'boss_ganon': ('🐗', 'boss', 'Boss detour: saves, fights Ganon, then carries on where it was.', {}),
 'boss_aga': ('🧙', 'boss', 'Boss detour: Agahnim, then back where it was.', {}),
 'boss_random': ('👑', 'boss', 'A random boss not beaten yet. ALTTP: a detour that returns to where Link was.', {}),
 'boss_aquamentus': ('🦖', 'boss', 'Aquamentus.', {'z1': 'spawn_aquamentus'}),
 'boss_dodongo': ('🦕', 'boss', 'Dodongo.', {'z1': 'spawn_dodongo'}),
 'boss_manhandla': ('🌺', 'boss', 'Manhandla.', {'z1': 'spawn_manhandla'}),
 'boss_gleeok': ('🐲', 'boss', 'Gleeok.', {'z1': 'spawn_gleeok'}),
 'boss_digdogger': ('🦔', 'boss', 'Digdogger.', {'z1': 'spawn_digdogger'}),
 'boss_gohma': ('🕷️', 'boss', 'Gohma.', {'z1': 'spawn_gohma'}),
 'boss_patra': ('👁️', 'boss', 'Patra.', {}),
 'boss_moldorm': ('🐛', 'boss', 'Moldorm.', {}),

 'seed_roll': ('🎲', 'chaos', 'A NEW SEED with the same settings — ends the current game. Off until the streamer allows it in Rando Hub.', {}),
 'seed_preset': ('🎲', 'chaos', 'A new seed from a random saved preset — ends the current game.', {}),
 'seed_chaos': ('💥', 'chaos', 'A CHAOS seed (every menu randomized) — ends the current game.', {}),
}
for n in range(1, 9):
    M['warp_%d' % n] = ('🌪️', 'teleports', 'Whirlwind to Level %d.' % n, {'z1': 'warp_d%d' % n})

def merge():
    out = {}
    for game, lst in (('alttp', alttp), ('z1', z1)):
        for e in lst:
            x = out.setdefault(e['id'], {'id': e['id'], 'names': {}, 'secs': {}, 'good': e['good'], 'warn': None, 'games': []})
            x['games'].append(game)
            x['names'][game] = e['name']
            x['secs'][game] = e['secs']
            if e.get('warn'): x['warn'] = e['warn']
    return out

effects = []
missing = []
for id_, x in merge().items():
    if id_ not in M:
        missing.append(id_); continue
    icon, cat, blurb, eq = M[id_]
    if snack: eq = {g: v for g, v in eq.items() if v in (snack_alttp if g == 'alttp' else snack_z1)}
    # the name a viewer sees: ALTTP's where it has one, else Zelda 1's
    name = x['names'].get('alttp') or x['names']['z1']
    if 'alttp' in x['names'] and 'z1' in x['names'] and x['names']['alttp'] != x['names']['z1']:
        name = {'no_item': 'No item button', 'swap_by': 'Buttons swapped', 'bombs_plus': 'More bombs',
                'one_hit': 'One-hit KO', 'item_off': 'Item gone', 'warp_random': 'Random warp',
                'boss_random': 'Boss: random', 'seed_roll': 'New seed!', 'seed_preset': 'Random preset seed!',
                'seed_chaos': 'CHAOS seed!'}.get(id_, name)
    secs = max(x['secs'].values())
    e = {
        'id': id_, 'name': name, 'category': cat, 'icon': icon,
        'duration_ms': secs * 1000, 'cooldown_ms': 0,
        'games': x['games'],
        'good': x['good'],
        'blurb': blurb,
        # True when JinxCast has nothing like it for that game yet: these are
        # the Rando Hub originals.
        'house': not eq,
    }
    partly = [g for g in x['games'] if g not in eq]
    if eq and partly: e['house_in'] = partly   # an original in that game only
    if len(set(x['names'].values())) > 1: e['names'] = x['names']
    if eq: e['jinxcast_equivalent'] = eq
    if x['warn']: e['warn'] = x['warn']
    if id_.startswith('seed_') or id_ in ('sword_steal', 'master_lock', 'insta_kill'):
        e['caution'] = True
    effects.append(e)

if missing:
    sys.exit('no metadata for: ' + ', '.join(missing))

doc = {
    '_meta': {
        'description': 'Rando Hub effect pack for Snack OS: every crowd effect Rando Hub runs, for A Link to the Past Randomizer and the Zelda 1 Randomizer in its browser emulators. Generated from Rando Hub\'s own lists (crowd/effects.js and z1r/js/crowd.js), so the ids are the hub\'s ids. Nothing here pokes memory: Rando Hub applies each effect itself, in its own emulator, the same way it does for Crowd Control+.',
        'transport': 'Rando Hub dials out to us: WebSocket on 127.0.0.1:43386 (RANDOHUB_PORT). See randohub-connector.js.',
        'games': 'games lists which of Rando Hub\'s two games an effect exists in. Sent while the hub is on the other game, it is refused with that reason rather than lost.',
        'house': 'house = true marks Rando Hub originals: effects JinxCast has no equivalent for in that game. jinxcast_equivalent names the closest existing JinxCast effect where there is one.',
        'durations': 'duration_ms is what Rando Hub ships with. A slider change in Jinx Cast is sent to the hub when it connects.',
        'credit': 'Rando Hub effects by Hank @huge_crank_hank.',
    },
    'effects': effects,
}
json.dump(doc, open(out_path, 'w'), indent=2, ensure_ascii=False)
house = [e for e in effects if e['house']]
print(len(effects), 'effects,', len(house), 'house originals,', sum(1 for e in effects if e.get('house_in')), 'original in one of the two games,', sum(1 for e in effects if not e['house'] and not e.get('house_in')), 'fully covered')
