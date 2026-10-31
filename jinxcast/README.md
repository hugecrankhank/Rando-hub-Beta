# Rando Hub ⇄ JinxCast

The link between Rando Hub and **JinxCast** (Snack OS, Kuba's stream engine):
Snack OS hears TikTok gifts and Twitch Bits, and Rando Hub runs the effects in
its own emulators, so any ALTTPR or Z1R seed works with nothing patched.

```
TikTok / Twitch ──► Snack OS ──ws://localhost:43386──► Rando Hub game page ──► its emulator
```

This folder is the Snack OS side, written for and owned by Rando Hub:

| file | what |
|---|---|
| `randohub-connector.js` | the WebSocket listener Rando Hub's pages connect to (port `RANDOHUB_PORT`, default 43386). Only Rando Hub's own pages are let in (`RANDOHUB_ORIGINS` adds more). |
| `randohub-effects.json` | every Rando Hub crowd effect (114: ALTTPR and Z1R), with icon, category, blurb, duration, which game has it, and the closest existing JinxCast effect (`jinxcast_equivalent`; `house: true` = a Rando Hub original) |
| `build-effects.py` | rebuilds `randohub-effects.json` from `crowd/effects.js` and `z1r/js/crowd.js` after an effect is added or renamed |

Both go in Snack OS's `server/` folder. Wiring them into Snack OS itself (the
game list, gift routing, Setup checklist, panels) is a change to Snack OS's
own code and is kept with Snack OS, not here.

The game side is in `crowd/effects.js` and `z1r/js/crowd.js`: ⋯ menu → Crowd
effects → **Connect to: JinxCast**. The messages are described in
[crowd/README.md](../crowd/README.md#jinxcast-snack-os).

Not part of the app download (`tools/make-release.py` leaves this folder out).
