import type { WorldState } from "../../domain/worldstate.types";
import type { Fixture } from "./scenario";

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const fissure = (id: string, tier: string, tierNum: number, missionType: string, node: string, minutes: number, isHard = false) => ({
  id,
  expiry: inMinutes(minutes),
  node,
  missionType,
  enemy: "Corrupted",
  tier,
  tierNum,
  isStorm: false,
  isHard,
  active: true,
});

/** Every Timers section filled, so all branches of the screen render. */
export const worldstate: Fixture<WorldState> = {
  default: () => ({
    cetus: { expiry: inMinutes(42), isDay: true },
    vallis: { expiry: inMinutes(7), isWarm: false },
    cambion: { expiry: inMinutes(18), active: "vome" },
    zariman: { expiry: inMinutes(95), active: true },
    bounties: {
      cetus: { expiry: inMinutes(80), jobCount: 5 },
      vallis: { expiry: inMinutes(80), jobCount: 5 },
      cambion: { expiry: inMinutes(80), jobCount: 5 },
      zariman: { expiry: inMinutes(80), jobCount: 5 },
      hex: { expiry: inMinutes(80), jobCount: 7 },
    },
    sortie: {
      expiry: inMinutes(600),
      boss: "Vay Hek",
      faction: "Grineer",
      active: true,
      variants: [
        { missionType: "Exterminate", modifier: "Augmented Enemy Armor", node: "Cervantes (Earth)" },
        { missionType: "Spy", modifier: "Eximus Stronghold", node: "Everest (Earth)" },
        { missionType: "Assassination", modifier: "Energy Reduction", node: "Oro (Earth)" },
      ],
    },
    archonHunt: {
      expiry: inMinutes(5000),
      boss: "Archon Amar",
      faction: "Narmer",
      active: true,
      missions: [
        { type: "Exterminate", node: "Cervantes (Earth)" },
        { type: "Mobile Defense", node: "Tolstoj (Mercury)" },
        { type: "Assassination", node: "Oro (Earth)" },
      ],
    },
    circuit: { expiry: inMinutes(4000), normalFrames: ["Excalibur", "Trinity", "Ember"], hardWeapons: ["Braton", "Lato", "Skana"] },
    kahl: { expiry: inMinutes(4000) },
    deepArchimedea: { expiry: inMinutes(4000) },
    voidTrader: {
      expiry: inMinutes(2000),
      activation: inMinutes(-500),
      character: "Baro Ki'Teer",
      location: "Larunda Relay (Mercury)",
      active: true,
      manifest: [
        { name: "Primed Continuity", uniqueName: "/Mods/PrimedContinuity", primePrice: 350, regularPrice: 110_000 },
        { name: "Prisma Gorgon", uniqueName: "/Weapons/PrismaGorgon", primePrice: 600, regularPrice: 175_000 },
        { name: "Void Trader Ki'Teer Syandana", primePrice: 400, regularPrice: 150_000 },
      ],
    },
    primeResurgence: {
      expiry: inMinutes(9000),
      activation: inMinutes(-100),
      active: true,
      manifest: [
        { name: "Mag Prime", uniqueName: "/Warframes/MagPrime", regalAyaPrice: 1 },
        { name: "Mag Prime Relic Pack", ayaPrice: 3 },
      ],
    },
    nightwave: { expiry: inMinutes(20_000), season: 12, active: true },
    events: [{ expiry: inMinutes(3000), label: "Operation: Belly of the Beast" }],
    darvo: { expiry: inMinutes(300), item: "Hikou Prime", discount: 40, originalPrice: 80, salePrice: 48, amountTotal: 200, amountSold: 51 },
    news: [
      {
        message: "Prime Access: Mag Prime is here",
        link: "https://www.warframe.com/news",
        date: "2026-11-10T16:00:00Z",
        stream: false,
        primeAccess: true,
        update: false,
      },
      {
        message: "Devstream 200 this Friday",
        link: "https://www.warframe.com/news",
        date: "2026-11-08T16:00:00Z",
        stream: true,
        primeAccess: false,
        update: false,
      },
    ],
    alerts: [
      {
        id: "a1",
        expiry: inMinutes(45),
        missionType: "Survival",
        faction: "Corpus",
        node: "Kappa (Sedna)",
        rewardItem: "Orokin Catalyst Blueprint",
        rewardCredits: 10_000,
      },
    ],
    invasions: [
      {
        id: "i1",
        node: "Tolstoj (Mercury)",
        attacker: "Grineer",
        defender: "Corpus",
        attReward: "Detonite Injector",
        defReward: "Fieldron",
        pct: 62,
      },
      { id: "i2", node: "Kiliken (Venus)", attacker: "Infested", defender: "Grineer", attReward: "", defReward: "Orokin Reactor Blueprint", pct: 18 },
    ],
    fissures: [
      fissure("f1", "Lith", 1, "Capture", "Ukko (Void)", 23),
      fissure("f2", "Meso", 2, "Defense", "Stöfler (Lua)", 51),
      fissure("f3", "Axi", 4, "Survival", "Mot (Void)", 4),
      fissure("f4", "Requiem", 5, "Disruption", "Olympus (Mars)", 70),
    ],
    spFissures: [fissure("sp1", "Neo", 3, "Extermination", "Gabii (Ceres)", 33, true)],
    voidStorms: [
      {
        id: "s1",
        expiry: inMinutes(33),
        node: "Korm's Belt (Earth Proxima)",
        missionType: "Skirmish",
        enemy: "Grineer",
        tier: "Lith",
        tierNum: 1,
        active: true,
      },
    ],
  }),
  empty: () => ({}),
};
