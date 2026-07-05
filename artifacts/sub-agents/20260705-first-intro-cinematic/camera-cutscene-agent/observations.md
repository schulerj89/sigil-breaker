# Intro Cinematic Camera Observations

- Implemented the first intro as a lightweight in-engine camera sequence over the existing level scene, with DOM black bars, captions, commander portrait, and skip button.
- The intro streams chunks around the cinematic look target instead of the player spawn, so distant shots can show the target area without loading the full 45 x 45 level at once.
- The camera path uses five readable shots: spawn breach, hostile room, weapons rhythm, survival warning, and exit rift.
- Skip and natural completion share the same handoff: stop voice, close intro, reset combat state, then enter gameplay.

## Watch Items

- The commander is a flat portrait for this MVP. If replaced by a 3D model later, keep the same phase/handoff API and swap only the portrait presentation layer.
- Future polish should add a small rift hum/stinger and subtle animated portrait scanline rather than increasing geometry or texture weight.
