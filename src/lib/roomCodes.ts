/**
 * roomCodes.ts
 * ------------------------------------------------------------------
 * Two-word room codes for Combat Tracker sessions (e.g. "DRAGON-LANTERN").
 *
 * WHY TWO WORDS:
 *   200 words, order matters, identical pairs disallowed = 200 x 199 = 39,800
 *   usable codes. Sessions are ephemeral, so codes recycle the instant a
 *   session ends — you only ever compete against PEAK CONCURRENT sessions,
 *   not every game ever played. At an absurd 1,000 live games that's ~2.5%
 *   occupancy (a ~1-in-40 first-try collision), which the regenerate loop
 *   below mops up invisibly. You will never feel this limit; if you ever
 *   want more headroom, adding words scales as N*(N-1), so 300 words = 89,700.
 *
 * READ-ALOUD + SPELLING FILTER:
 *   The list is curated so no two words sound alike ("the code is GHOST-OWL"
 *   should never be mistaken for another word), ambiguous-pronunciation words
 *   are removed, AND words are kept easy to spell for newcomers who hear a
 *   code over voice and have to type it cold. QR / tap-to-join handles the
 *   common case; this list handles voice + remote players.
 * ------------------------------------------------------------------
 */

export const ROOM_WORDS: readonly string[] = [
  // --- Monsters & Creatures (38) ---
  "DRAGON", "GOBLIN", "OGRE", "TROLL", "GHOST", "ORC", "GHOUL", "SPIRIT",
  "GOLEM", "HYDRA", "KRAKEN", "MEDUSA", "WITCH", "BEAST", "REAPER",
  "BONES", "FANG", "BRUTE", "SKULL", "DEVIL", "HARPY", "GENIE",
  "VENOM", "ZOMBIE", "CLAW", "IMP", "DEMON", "FIEND", "TITAN",
  "SLIME", "OOZE", "MIMIC", "GIANT", "HORDE", "SNAKE", "QUEEN",
  "ADDER", "SPIDER",

  // --- Beasts & Animals (20) ---
  "BEAR", "WOLF", "RAVEN", "HAWK", "FALCON", "EAGLE", "OWL", "FOX", "LYNX",
  "BOAR", "LION", "TIGER", "VIPER", "COBRA", "TOAD", "CROW", "BADGER",
  "OTTER", "HOUND", "RAM",

  // --- Classes & Heroes (22) ---
  "WIZARD", "MAGE", "CLERIC", "WARDEN", "RANGER", "ROGUE", "BARD", "DRUID",
  "MONK", "SEER", "ORACLE", "SLAYER", "KNIGHT", "SQUIRE", "ARCHER",
  "HUNTER", "THIEF", "RAIDER", "NOMAD", "HEALER", "SCOUT", "SHAMAN",

  // --- Folk & Heroes (8) ---
  "ELF", "DWARF", "KING", "HERO", "JESTER", "PIXIE", "FAIRY", "SPRITE",

  // --- Weapons (20) ---
  "SWORD", "BLADE", "DAGGER", "AXE", "WHIP", "SPEAR", "LANCE", "BOW", "ARROW",
  "FLAIL", "PIKE", "CLUB", "MAUL", "KNIFE", "SABER", "DIRK",
  "TALON", "QUIVER", "DART", "HAMMER",

  // --- Armor & Gear (10) ---
  "SHIELD", "HELM", "GLOVE", "BOOTS", "BELT", "CLOAK", "MANTLE",
  "VISOR", "BANNER", "MASK",

  // --- Magic & Treasure (24) ---
  "SCROLL", "POTION", "BREW", "AMULET", "HEX", "RUNE", "CHARM", "WAND",
  "STAFF", "GEM", "RELIC", "TOME", "FLASK", "COIN", "GOLD", "SILVER",
  "COPPER", "JADE", "JEWEL", "RUBY", "ONYX", "TOPAZ", "PEARL", "OPAL",

  // --- Places & Tavern (28) ---
  "TAVERN", "KEEP", "CASTLE", "TOWER", "CAVE", "CRYPT", "VAULT", "GROTTO",
  "LAIR", "DEN", "FORGE", "SPIRE", "FORT", "BARROW", "WOODS", "GROVE",
  "MOOR", "MARSH", "BOG", "CHASM", "RAVINE", "SUMMIT", "HOLLOW", "MUG",
  "CANDLE", "TORCH", "HEARTH", "CELLAR",

  // --- Concepts & Quest (30) ---
  "VALOR", "HONOR", "GLORY", "QUEST", "OATH", "DOOM", "FATE", "OMEN", "CURSE",
  "BANE", "BOON", "HAVOC", "FURY", "DREAD", "EMBER", "FLAME", "FROST", "STORM",
  "BOLT", "GALE", "CINDER", "ASH", "SHADOW", "MIST", "DUSK", "DAWN",
  "STAR", "RIDDLE", "LEGEND", "MYTH",
];

// Sanity check — fail loudly if the list is ever edited to the wrong length.
if (ROOM_WORDS.length !== 200) {
  console.warn(`ROOM_WORDS expected 200 entries, found ${ROOM_WORDS.length}`);
}

/** Pick one random word from the list. */
function randomWord(): string {
  return ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
}

/**
 * Generate a candidate code like "DRAGON-LANTERN".
 * Order matters and identical pairs are disallowed (no "BEAR-BEAR", which
 * reads like a glitch) — giving 200 x 199 = 39,800 distinct codes.
 */
export function randomCode(): string {
  const first = randomWord();
  let second = randomWord();
  while (second === first) second = randomWord();
  return `${first}-${second}`;
}

/**
 * Generate a code guaranteed not to collide with a currently-active session.
 *
 * `isActive` is your Supabase lookup, e.g.:
 *   async (code) => {
 *     const { data } = await supabase
 *       .from("sessions")
 *       .select("id")
 *       .eq("code", code)
 *       .maybeSingle();
 *     return data !== null;
 *   }
 *
 * This is "check-and-regenerate": the cost of a collision is just one more
 * cheap query, and at realistic occupancy you'll almost never loop even once.
 */
export async function generateUniqueCode(
  isActive: (code: string) => Promise<boolean>,
  maxTries = 10,
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const code = randomCode();
    if (!(await isActive(code))) return code;
  }
  // Astronomically unlikely with 39,800 codes; surface it rather than hang.
  throw new Error("Could not generate a free room code after maxTries attempts");
}
