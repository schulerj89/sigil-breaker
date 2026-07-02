export interface AssetManifestEntry {
  key: string;
  path: string;
  placeholderColor: number;
}

export const TILE_TEXTURE_KEYS = {
  floor: 'tile.floor',
  wall: 'tile.wall',
  player: 'entity.player',
  crate: 'entity.crate',
  golem: 'entity.golem',
  redPressurePlate: 'tile.pressure.red',
  redDoor: 'tile.door.red',
  redDoorOpen: 'tile.door.red.open',
  exit: 'tile.exit',
} as const;

// Kenney's Sokoban pack has changed folder and filename casing across releases.
// Keep this manifest as the one place where downloaded sprite filenames map to
// Sigilbreaker tile types. If your local pack uses different names, update only
// the path for the relevant key and the placeholder renderer will keep working.
export const assetManifest: AssetManifestEntry[] = [
  {
    key: TILE_TEXTURE_KEYS.floor,
    path: 'assets/kenney/sokoban/Ground/ground_01.png',
    placeholderColor: 0x29313a,
  },
  {
    key: TILE_TEXTURE_KEYS.wall,
    path: 'assets/kenney/sokoban/Blocks/block_01.png',
    placeholderColor: 0x59626d,
  },
  {
    key: TILE_TEXTURE_KEYS.player,
    path: 'assets/kenney/sokoban/Player/player_05.png',
    placeholderColor: 0xf0d078,
  },
  {
    key: TILE_TEXTURE_KEYS.crate,
    path: 'assets/kenney/sokoban/Crates/crate_01.png',
    placeholderColor: 0xb87844,
  },
  {
    key: TILE_TEXTURE_KEYS.golem,
    path: 'assets/kenney/sokoban/Player/player_03.png',
    placeholderColor: 0x8b84b8,
  },
  {
    key: TILE_TEXTURE_KEYS.redPressurePlate,
    path: 'assets/kenney/sokoban/Environment/environment_04.png',
    placeholderColor: 0xc94747,
  },
  {
    key: TILE_TEXTURE_KEYS.redDoor,
    path: 'assets/kenney/sokoban/Environment/environment_15.png',
    placeholderColor: 0x843b3b,
  },
  {
    key: TILE_TEXTURE_KEYS.redDoorOpen,
    path: 'assets/kenney/sokoban/Environment/environment_16.png',
    placeholderColor: 0x5f805f,
  },
  {
    key: TILE_TEXTURE_KEYS.exit,
    path: 'assets/kenney/sokoban/Environment/environment_06.png',
    placeholderColor: 0x62c997,
  },
];
