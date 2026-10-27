/*
 * entry.ts — Muffins' Tracker 2.0 as a library, for Mudora 2.0.
 *
 * Built by .github/workflows/mfns-build.yml from his source (KrisDavie/
 * alttptracker, react_rewrite) with vite.lib.config.ts: this file is dropped
 * into his src/ and bundled with his logic, his Redux slices, his data tables
 * and his session storage — none of it changed — into one ES module without
 * React, the launch page or the tracker UI (mfns-tracker/lib/mfns.js).
 *
 * What's his, re-exported as is: the logic engine (OverworldTraverser and the
 * graph builders), the slices (reducers + actions), the location / dungeon /
 * item / preset tables, the SRAM tables, sessions (same IndexedDB, same keys,
 * so games started in his tracker carry on here and the other way round).
 *
 * What's ours, written against his API (kept to the minimum):
 *   createTrackerStore(id)   his store.ts, with the session id passed in
 *                            instead of read from the page's address
 *   newSession(...)          his launch flow (sessionHelper.launchDirectSession)
 *   startLogic(store)        his LogicProvider's effect, as a subscription
 *   createAutotracker(...)   his AutotrackerProvider's processing step, fed
 *                            memory by the caller instead of SNI / QUsb2snes
 */
import { configureStore } from "@reduxjs/toolkit";
import { rememberReducer, rememberEnhancer, REMEMBER_REHYDRATED } from "redux-remember";
import { idbDriver, deleteSessionStoreData } from "@/lib/idbDriver";
import itemsReducer, { setItemCount, incrementItemCount, updateMultipleItems, resetItems } from "@/store/itemsSlice";
import dungeonsReducer, * as dungeonsActions from "@/store/dungeonsSlice";
import checksReducer, { setLocationChecked, setEntranceChecked, updateMultipleLocations, updateLogicStatuses, resetChecks, type CheckStatus } from "@/store/checksSlice";
import settingsReducer, { setSettings, setWildSmallKeys, toggleWildBigKeys, setSequenceBreaks, resetSettings, initialState as DEFAULT_SETTINGS, type SettingsState } from "@/store/settingsSlice";
import entrancesReducer, { incrementMedallionCount, setNote, setEntranceLink, connectGenericConnector, resetEntrances } from "@/store/entrancesSlice";
import autotrackerReducer, { setRomName, setConnected, setConnectionStatus } from "@/store/autotrackerSlice";
import trackerReducer from "@/store/trackerSlice";
import overworldReducer, * as overworldActions from "@/store/overworldSlice";
import scoutsReducer, { toggleScoutedItem, resetScouts } from "@/store/scoutsSlice";
import eventLogReducer, { addEvent, resetEventLog } from "@/store/eventLogSlice";
import { createEventLogMiddleware } from "@/store/eventLogMiddleware";
import { getLogicSet } from "@/lib/logic/logicMapper";
import { OverworldTraverser } from "@/lib/logic/overworldTraverser";
import { buildEffectiveRegions } from "@/lib/logic/regionsProvider";
import { getActiveLocations, getActiveLocationsMap, getAllPossibleLocations, getAllPossibleLocationNames, getDungeonIdForEntry, isSecondaryEntrance, isReplacedByEntrances, LOGIC_ONLY_LOCATIONS } from "@/lib/logic/locationMapper";
import { locationsData, entranceLocations } from "@/data/locationsData";
import DungeonsData, { BossImages, BossNames } from "@/data/dungeonData";
import ItemsData, { PrizeImages, PrizeNames, DungeonItemNames } from "@/data/itemData";
import { entranceConnectorGroups, allConnectorEntrances, getConnectorGroup } from "@/data/entranceConnections";
import { allPresets, presetCategories, getPresetById, resolvePresetFromSlug } from "@/data/launcherPresets";
import { loadLauncherPrefs, saveLauncherPrefs, applyLauncherPrefs, buildLauncherPrefs, buildPresetIDBState, STARTING_ITEMS } from "@/lib/launchHelpers";
import { getSessions, getSession, createSession, deleteSession, touchSession, togglePin } from "@/lib/sessionManager";
import { DUNGEON_ITEMS, getRangeFromAddress, MEMORY_RANGES, SPECIAL_HANDLE_INVENTORY_ITEMS, ALL_SRAM_LOCATIONS_MAP, INVENTORY_LOCATIONS, PENDANT_MASKS, CRYSTAL_MASKS, DUNGEON_PRIZE_MASKS, type DungeonInfo } from "@/data/sramLocations";
import type { DungeonState } from "@/store/dungeonsSlice";
import type { RegionLogic } from "@/data/logic/logicTypes";

export const LIB_VERSION = "1";
export const SOURCE_COMMIT: string = (import.meta as unknown as { env: Record<string, string> }).env.VITE_APP_VERSION || "";

// ── his store, per session ───────────────────────────────────────────────────
export const rememberedKeys = ["items", "dungeons", "checks", "settings", "entrances", "overworld", "scouts", "eventLog"] as const;
const reducers = {
  trackerState: trackerReducer,
  items: itemsReducer,
  dungeons: dungeonsReducer,
  checks: checksReducer,
  settings: settingsReducer,
  entrances: entrancesReducer,
  autotracker: autotrackerReducer,
  overworld: overworldReducer,
  scouts: scoutsReducer,
  eventLog: eventLogReducer,
};
export type RootState = { [K in keyof typeof reducers]: ReturnType<(typeof reducers)[K]> };

/** His store for one session: same reducers, same persistence (redux-remember on his IndexedDB, same key prefix). */
export function createTrackerStore(instanceId: string) {
  // resolves once the saved game (if any) has been loaded from IndexedDB
  // (redux-remember announces it with its rehydrated action)
  let rehydrated!: () => void;
  const ready = new Promise<void>((resolve) => { rehydrated = resolve; });
  const root = rememberReducer(reducers);
  const reducer: typeof root = (state, action) => {
    const next = root(state, action);
    if ((action as { type?: string }).type === REMEMBER_REHYDRATED) rehydrated();
    return next;
  };
  const store = configureStore({
    reducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).concat(createEventLogMiddleware()),
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(
      rememberEnhancer(idbDriver, [...rememberedKeys], { prefix: `alttptracker_session_${instanceId}_` }),
    ),
  });
  setTimeout(rehydrated, 4000);   // never hang on a storage problem
  return Object.assign(store, { ready, instanceId });
}
export type TrackerStore = ReturnType<typeof createTrackerStore>;

// ── a new session: his launch flow, without the launch page ─────────────────
/**
 * Makes a session the way his launcher does (sessionHelper.launchDirectSession):
 * settings = defaults + his saved launcher prefs + the preset; the preset's
 * starting items, pre-checked locations and entrances seeded into IndexedDB.
 * Returns the new session id; create the store with it afterwards.
 */
export async function newSession(opts: { presetId?: string; settings?: Partial<SettingsState>; name?: string; spriteName?: string; startingItems?: Record<string, number> } = {}): Promise<string> {
  const sessionId = crypto.randomUUID().slice(0, 8);
  const savedPrefs = loadLauncherPrefs();
  let settings: SettingsState = applyLauncherPrefs(DEFAULT_SETTINGS, savedPrefs);
  let startingItems: Record<string, number> = opts.startingItems ?? {};
  const preset = opts.presetId ? getPresetById(opts.presetId) : undefined;
  if (preset) {
    settings = { ...settings, ...preset.settings } as SettingsState;
    if (!opts.startingItems) startingItems = preset.startingItems ?? {};
  }
  if (opts.settings) settings = { ...settings, ...opts.settings } as SettingsState;
  const name = opts.name || `Session ${new Date().toLocaleDateString()}`;
  try {
    await createSession(settings, name, opts.spriteName ?? savedPrefs.spriteName, preset?.id, sessionId, startingItems);
  } catch (err) {
    if ((err as { name?: string })?.name === "ConstraintError") await touchSession(sessionId); else throw err;
  }
  const prefix = `alttptracker_session_${sessionId}_`;
  await idbDriver.setItem(prefix + "settings", JSON.stringify(settings));
  const presetState = buildPresetIDBState(startingItems, preset, settings);
  if (presetState.items) await idbDriver.setItem(prefix + "items", JSON.stringify(presetState.items));
  if (presetState.checks) await idbDriver.setItem(prefix + "checks", JSON.stringify(presetState.checks));
  if (presetState.entrances) await idbDriver.setItem(prefix + "entrances", JSON.stringify(presetState.entrances));
  if (presetState.dungeons) await idbDriver.setItem(prefix + "dungeons", JSON.stringify(presetState.dungeons));
  return sessionId;
}

// ── the logic: his LogicProvider, as a subscription ─────────────────────────
function normalizeSettingsForLogic(settings: SettingsState): SettingsState {
  return {
    ...settings,
    mapMode: settings.mapMode === "off" ? "off" : "normal",
    autotracking: false,
    includeDungeonItemsInCounter: false,
    connectionLinesMode: "none",
    connectionLineColor: "",
    spriteName: "",
    colouredChests: false,
    showMapTooltips: false,
    showChestTooltips: false,
    entranceLabelsMode: "off",
    showInsetBossSquare: false,
    useOldStyleDungeonSquares: false,
    alwaysShowHCCTCounts: false,
    alwaysShowBigKeys: false,
    alwaysShowSmallKeys: false,
    showKeyTotals: false,
    eventLogMode: "off",
    logTriforcePieces: false,
    entranceLabelOverrides: {},
    customColors: undefined,
    appBackground: "",
  } as SettingsState;
}
function sameCheckedFlags(a: RootState["checks"]["locationsChecks"], b: RootState["checks"]["locationsChecks"]): boolean {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (a[key]?.checked !== b[key]?.checked) return false;
  return true;
}

/** One pass of his logic over a state: the statuses his tracker would show. */
export function computeLogic(state: RootState) {
  const logicSettings = normalizeSettingsForLogic(state.settings);
  const logicSet = getLogicSet(state.settings.logicMode);
  const graphSnapshot = { items: {} as RootState["items"], settings: logicSettings, dungeons: {} as RootState["dungeons"], entrances: state.entrances, checks: undefined, overworld: state.overworld };
  const effectiveGraph = buildEffectiveRegions(logicSet.regions as Record<string, RegionLogic>, graphSnapshot);
  const checks: Record<string, { checked: boolean }> = {};
  for (const [name, status] of Object.entries(state.checks.locationsChecks)) checks[name] = { checked: status.checked };
  const effectiveDungeons: RootState["dungeons"] = {};
  for (const [id, dState] of Object.entries(state.dungeons)) {
    effectiveDungeons[id] = { ...dState, smallKeys: Math.max(0, dState.smallKeys + (dState.manuallyChanged?.smallKeys ?? 0)) };
  }
  const snapshot = { items: state.items, settings: logicSettings, dungeons: effectiveDungeons, entrances: state.entrances, checks, overworld: state.overworld };
  const protection = logicSettings.keyLogic === "dangerous" ? "dangerous" : "partial";
  const traverser = new OverworldTraverser(snapshot, { regions: effectiveGraph.regions }, effectiveGraph.metadata, protection);
  return traverser.calculateAll();
}

/**
 * Keeps the store's logic statuses current, the way his LogicProvider does:
 * recomputed when items, dungeons, entrances, overworld, the checked flags or
 * a logic-relevant setting change; the graph is rebuilt only when topology
 * changes. Returns a stop function.
 */
export function startLogic(store: TrackerStore, onResult?: (results: ReturnType<typeof computeLogic>) => void): () => void {
  let last: { items?: unknown; dungeons?: unknown; entrances?: unknown; overworld?: unknown; checks?: RootState["checks"]["locationsChecks"]; settingsKey?: string } = {};
  let graph: { key: string; set: ReturnType<typeof getLogicSet>; effective: ReturnType<typeof buildEffectiveRegions> } | null = null;
  let scheduled = false;
  const run = () => {
    scheduled = false;
    const state = store.getState() as RootState;
    const logicSettings = normalizeSettingsForLogic(state.settings);
    const settingsKey = JSON.stringify(logicSettings);
    if (last.items === state.items && last.dungeons === state.dungeons && last.entrances === state.entrances && last.overworld === state.overworld &&
        last.settingsKey === settingsKey && last.checks && sameCheckedFlags(last.checks, state.checks.locationsChecks)) return;
    last = { items: state.items, dungeons: state.dungeons, entrances: state.entrances, overworld: state.overworld, checks: state.checks.locationsChecks, settingsKey };
    const graphKey = settingsKey + "|" + JSON.stringify(state.entrances) + "|" + JSON.stringify(state.overworld);
    if (!graph || graph.key !== graphKey) {
      const set = getLogicSet(state.settings.logicMode);
      const graphSnapshot = { items: {} as RootState["items"], settings: logicSettings, dungeons: {} as RootState["dungeons"], entrances: state.entrances, checks: undefined, overworld: state.overworld };
      graph = { key: graphKey, set, effective: buildEffectiveRegions(set.regions as Record<string, RegionLogic>, graphSnapshot) };
    }
    const checks: Record<string, { checked: boolean }> = {};
    for (const [name, status] of Object.entries(state.checks.locationsChecks)) checks[name] = { checked: status.checked };
    const effectiveDungeons: RootState["dungeons"] = {};
    for (const [id, dState] of Object.entries(state.dungeons)) {
      effectiveDungeons[id] = { ...dState, smallKeys: Math.max(0, dState.smallKeys + (dState.manuallyChanged?.smallKeys ?? 0)) };
    }
    const snapshot = { items: state.items, settings: logicSettings, dungeons: effectiveDungeons, entrances: state.entrances, checks, overworld: state.overworld };
    const protection = logicSettings.keyLogic === "dangerous" ? "dangerous" : "partial";
    const traverser = new OverworldTraverser(snapshot, { regions: graph.effective.regions }, graph.effective.metadata, protection);
    const results = traverser.calculateAll();
    store.dispatch(updateLogicStatuses(results));
    if (onResult) onResult(results);
  };
  const schedule = () => { if (!scheduled) { scheduled = true; setTimeout(run, 0); } };
  const unsub = store.subscribe(schedule);
  schedule();
  return () => { unsub(); };
}

// ── autotracking: his processing step, memory supplied by the caller ────────
/**
 * The caller reads the game's memory (MEMORY_RANGES, in the FxPak Pro address
 * space his tracker uses: $F5xxxx = WRAM, $E0xxxx = SRAM, else ROM) and hands
 * the ranges over; this does what his AutotrackerProvider does with them:
 * locations checked, inventory, dungeon items and prizes, Agahnim, the
 * double-small-key fix, the triforce counter. Returns the game's name.
 */
export function createAutotracker(store: TrackerStore) {
  let lastGoalCounter: number | null = null;
  let romName = "";

  function process(data: Record<string, Uint8Array>) {
    const state = store.getState() as RootState;
    const settings = state.settings;
    const checksNow = state.checks.locationsChecks;
    const itemsNow = state.items;
    if (data.romname) {
      const fetched = new TextDecoder().decode(data.romname).replace(/\0/g, "");
      if (fetched !== romName) { romName = fetched; store.dispatch(setRomName(fetched)); }
    }
    if (data.gamemode) {
      const gameMode = data.gamemode[0];
      if (![0x07, 0x09, 0x0b].includes(gameMode)) return romName;   // not in the game: nothing to read
    }
    const getByte = (addr: number) => {
      const rangeData = getRangeFromAddress(addr);
      if (!rangeData) return null;
      const { name, range } = rangeData;
      const d = data[name];
      return d ? d[addr - range.start] || 0 : null;
    };
    const getWord = (addr: number) => {
      const rangeData = getRangeFromAddress(addr);
      if (!rangeData) return null;
      const { name, range } = rangeData;
      const d = data[name];
      if (!d) return null;
      const offset = addr - range.start;
      return (d[offset] || 0) | ((d[offset + 1] || 0) << 8);
    };

    const updates: Record<string, CheckStatus> = {};
    const itemUpdates: Record<string, number> = {};
    const dungeonUpdates: Record<string, Partial<DungeonState>> = {};
    const FORK = romName?.slice(0, 2);
    const VERSION = Number(romName?.slice(2, 5));

    Object.keys(locationsData).forEach((entryKey) => {
      getAllPossibleLocations(entryKey).forEach((locInfo) => {
        const itemLoc = locInfo.name;
        const locationState = checksNow[itemLoc];
        if (!locationState || locationState.manuallyChecked || locationState.checked) return;
        const sramLoc = ALL_SRAM_LOCATIONS_MAP[itemLoc];
        const val = sramLoc ? getWord(sramLoc.wramAddress) : null;
        if (val === null) return;
        if ((val & sramLoc!.mask) !== 0) updates[itemLoc] = { ...locationState, checked: true, manuallyChecked: false };
      });
    });

    INVENTORY_LOCATIONS.forEach((sramLoc) => {
      const itemName = sramLoc.name.replace("Inventory - ", "");
      const currentItem = itemsNow[itemName];
      const currentAmount = currentItem?.amount ?? 0;
      const val = getByte(sramLoc.wramAddress);
      if (val === null) return;
      let newValue = sramLoc.mask === 0 ? val : (val & sramLoc.mask) !== 0 ? 1 : 0;
      if (itemName.startsWith("bottle")) newValue = Math.max(0, newValue - 1);
      if (newValue !== currentAmount || currentItem?.manuallyChanged) itemUpdates[itemName] = newValue;
    });

    SPECIAL_HANDLE_INVENTORY_ITEMS.forEach((sramLoc) => {
      const itemName = sramLoc.name.replace("Inventory - ", "");
      const val = getByte(sramLoc.wramAddress);
      if (val === null) return;
      switch (itemName) {
        case "bow": { const bits = val & 0xc0; if (bits !== 0) itemUpdates["bow"] = bits === 0x40 ? 2 : bits === 0x80 ? 3 : 4; break; }
        case "boomerang": { const bits = val & 0xc0; if (bits !== 0) itemUpdates["boomerang"] = bits === 0x80 ? 1 : bits === 0x40 ? 2 : 3; break; }
        case "bombs": itemUpdates["bomb"] = val > 0 ? 1 : 0; break;
        case "bombcapacity": itemUpdates["bombcapacity"] = val; break;
        case "mushroom": { const bits = val & 0x28; itemUpdates["mushroom"] = bits & 0x20 ? 1 : bits & 0x08 ? 2 : 0; break; }
        case "powder":
        case "shovel": itemUpdates[itemName] = (val & sramLoc.mask) !== 0 ? 1 : 0; break;
        case "flute": { const fluteState = val & 0x03; itemUpdates["flute"] = fluteState === 1 || fluteState === 3 ? 2 : fluteState === 2 ? 1 : 0; break; }
      }
    });

    DUNGEON_ITEMS.forEach(({ dungeon, datas }) => {
      const newState: Partial<DungeonState> = {};
      Object.entries(datas).forEach(([key, item]) => {
        const val = getByte(item.wramAddress);
        if (val === null) return;
        const isSet = (val & item.mask) !== 0;
        switch (key as DungeonInfo) {
          case "smallKeys": newState.smallKeys = val; break;
          case "bigKey": newState.bigKey = isSet; break;
          case "compass": newState.compass = isSet; break;
          case "map": newState.map = isSet; break;
          case "prize": newState.prizeCollected = isSet; break;
          case "boss": newState.bossDefeated = isSet; break;
        }
      });
      const PENDANT_SWAP_BUG_PRESENT = (
        (FORK === "VT" && ((getByte(MEMORY_RANGES["flags_data"].start + 0x211) ?? 0) & 0x02) != 0) ||
        (FORK === "DR" && VERSION < 142)
      );
      if (DUNGEON_PRIZE_MASKS[dungeon] !== undefined) {
        const prizeType = getByte(MEMORY_RANGES["flags_data"].subranges!["prize_data"].start + DUNGEON_PRIZE_MASKS[dungeon]!) == 0x40 ? "crystal" : "pendant";
        const prizeMap = prizeType === "crystal" ? CRYSTAL_MASKS : PENDANT_MASKS;
        let prizeValue = getByte(MEMORY_RANGES["prize_numbers"].start + DUNGEON_PRIZE_MASKS[dungeon]!) ?? 0;
        if (PENDANT_SWAP_BUG_PRESENT && prizeType === "pendant" && (prizeValue === 0x01 || prizeValue === 0x02)) prizeValue = prizeValue === 0x01 ? 0x02 : 0x01;
        const prize = prizeMap[prizeValue as keyof typeof prizeMap] ?? "unknown";
        const prizeBits = getWord(prizeType === "crystal" ? MEMORY_RANGES["main"].start + 0x37a : MEMORY_RANGES["main"].start + 0x374);
        const prizeObtained = prizeBits !== null && (prizeBits & prizeValue) !== 0;
        if (prizeObtained) newState.prize = (prize === "redCrystal" ? "crystal" : prize) as DungeonState["prize"];
      }
      dungeonUpdates[dungeon] = newState;
    });

    const ctBossDefeated = getByte(0xf5f3c5);
    if (ctBossDefeated !== null && ctBossDefeated >= 0x03) {
      if (!dungeonUpdates["ct"]) dungeonUpdates["ct"] = {};
      dungeonUpdates["ct"].bossDefeated = true;
    }

    const fixDoubleSmallKeys = FORK === "VT" && settings.enemyDrop === "none" && !["keys", "cavekeys", "dungeon", "lottery"].includes(settings.pottery);
    if (fixDoubleSmallKeys) {
      for (const dungeon of ["dp", "toh"]) {
        if (dungeonUpdates[dungeon] && dungeonUpdates[dungeon].smallKeys && dungeonUpdates[dungeon].smallKeys! > 1) dungeonUpdates[dungeon].smallKeys = 1;
      }
    }

    const goalCounter = getWord(0xf5f418);
    const pieceGoal = settings.goal === "triforce_hunt" || settings.goal === "ganonhunt";
    if (goalCounter !== null && pieceGoal) {
      const previous = lastGoalCounter;
      if (settings.eventLogMode !== "off" && settings.logTriforcePieces && previous !== null && goalCounter > previous) {
        for (let i = 0; i < goalCounter - previous; i++) store.dispatch(addEvent({ title: "Triforce Piece", image: "/dungeons/triforce_hunt.png" }));
      }
      lastGoalCounter = goalCounter;
    } else lastGoalCounter = null;

    if (Object.keys(updates).length > 0) store.dispatch(updateMultipleLocations(updates));
    if (Object.keys(itemUpdates).length > 0) store.dispatch(updateMultipleItems(itemUpdates));
    Object.entries(dungeonUpdates).forEach(([dungeon, newState]) => {
      if (Object.keys(newState).length > 0) store.dispatch(dungeonsActions.updateDungeonState({ dungeon, newState }));
    });
    return romName;
  }

  return { process, ranges: MEMORY_RANGES, get romName() { return romName; } };
}

// ── his pieces, as they are ──────────────────────────────────────────────────
export const actions = {
  items: { setItemCount, incrementItemCount, updateMultipleItems, resetItems },
  dungeons: dungeonsActions,
  checks: { setLocationChecked, setEntranceChecked, updateMultipleLocations, updateLogicStatuses, resetChecks },
  settings: { setSettings, setWildSmallKeys, toggleWildBigKeys, setSequenceBreaks, resetSettings },
  entrances: { incrementMedallionCount, setNote, setEntranceLink, connectGenericConnector, resetEntrances },
  overworld: overworldActions,
  scouts: { toggleScoutedItem, resetScouts },
  eventLog: { addEvent, resetEventLog },
  autotracker: { setRomName, setConnected, setConnectionStatus },
};
export const logic = { getLogicSet, OverworldTraverser, buildEffectiveRegions, getActiveLocations, getActiveLocationsMap, getAllPossibleLocations, getAllPossibleLocationNames, getDungeonIdForEntry, isSecondaryEntrance, isReplacedByEntrances, LOGIC_ONLY_LOCATIONS };
export const data = { locationsData, entranceLocations, DungeonsData, BossImages, BossNames, ItemsData, PrizeImages, PrizeNames, DungeonItemNames, entranceConnectorGroups, allConnectorEntrances, getConnectorGroup, allPresets, presetCategories, getPresetById, resolvePresetFromSlug, DEFAULT_SETTINGS, STARTING_ITEMS, MEMORY_RANGES };
export const sessions = { getSessions, getSession, createSession, deleteSession, touchSession, togglePin, deleteSessionStoreData, loadLauncherPrefs, saveLauncherPrefs, applyLauncherPrefs, buildLauncherPrefs };
