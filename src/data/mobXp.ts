/**
 * mobXp.ts — Experience point rewards for mobs
 *
 * Base XP values from Minecraft Java Edition.
 * Actual dropped XP = reward to reward*2 (randomized).
 */

export const MOB_XP_REWARDS: Record<string, number> = {
  // Hostile mobs
  zombie:       5,
  skeleton:     5,
  creeper:      5,
  spider:       5,
  cave_spider:  5,
  enderman:     5,
  witch:        5,
  blaze:        10,
  ghast:        5,
  magma_cube:   1,   // varies by size
  silverfish:   2,
  slime:        1,   // varies by size
  drowned:      5,
  husk:         5,
  stray:        5,
  phantom:      5,
  hoglin:       5,
  piglin:       5,
  piglin_brute: 20,
  zoglin:       5,
  zombified_piglin: 5,
  warden:       5,
  breeze:       10,
  // Boss mobs
  elder_guardian: 10,
  ender_dragon:   12000,
  wither:        50,
  // Passive mobs
  cow:          0,   // Passive mobs drop 1–3 XP on breeding only
  pig:          0,
  sheep:        0,
  chicken:      0,
  rabbit:       0,
  fox:          0,
  horse:        0,
  donkey:       0,
  mule:         0,
  llama:        0,
  wolf:         0,
  cat:          0,
  ocelot:       0,
  parrot:       0,
  turtle:       0,
  panda:        0,
  polar_bear:   0,
  golem:        0,
  villager:     0,
  // Aquatic
  squid:        0,
  dolphin:      0,
  salmon:       0,
  cod:          0,
  pufferfish:   0,
  tropical_fish: 0,
  axolotl:      0,
  frog:         0,
  tadpole:      0,
  // Passive flying
  allay:        0,
  bee:          0,
  bat:          0,
};