# Built-in item sound packs

Each folder here is a pack that everyone gets in the broadcast view's
**♪ Item Sounds → Sound Pack** list. Inside a pack, make one folder per item
and put as many sounds in it as you like; each pickup plays one at random.

```
sounds/packs/
  Hydro/
    hookshot/      grab1.mp3  grab2.mp3
    fire rod/      fwoosh.ogg
    master sword/  ...          (a level folder beats the plain "sword" one)
    sword/         ...
```

Folder names are matched loosely (`Fire Rod`, `fire_rod`, `05 - Fire Rod` all
work). Level folders: `bow only`, `wood arrows`, `silver arrows`,
`fighter sword`, `master sword`, `tempered sword`, `golden sword`,
`power glove`, `titans mitt`, `blue shield`, `fire shield`, `mirror shield`,
`blue mail`, `red mail`. Others: `go mode`, `bottle`, `map`, `compass`,
`big key`, `agahnim`, and every item's own name.

After adding or removing sounds, run `python3 tools/build-sound-packs.py` to
rewrite `index.json`.

Players can also import a pack folder from their own computer in the same
window; those stay in their browser and aren't uploaded anywhere.
