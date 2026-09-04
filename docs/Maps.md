# Maps

> **Open Fufu status:** This file remains primarily inherited OpenFront map-tooling reference documentation. The canonical Open Fufu map/gameplay contract is [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), and migration/implementation work is governed by [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

## Open Fufu V1 map-scale requirement

Ordinary Open Fufu V1 maps compile to **exactly 4,800,000 raster cells**.

- Width, height, and aspect ratio may vary, but the final raster cell count does not.
- The 4.8-million-cell budget includes population-bearing terrain, conquerable non-population-bearing terrain, water, and impassable terrain.
- The number/share of population-bearing cells is deliberately map-dependent rather than normalized.
- V1 does **not** support alternate gameplay map-resolution scales.
- Map generation/validation must ensure the authored terrain composition can support the configured participant count and required starting footprints.

This fixed physical resolution is intended to keep cell-space mechanics—movement speeds, structure radii, weapon/blast geometry, railway distances, spawn footprints, and similar rules—comparable across maps while still allowing maps to have very different terrain/population-capacity identities. The accepted Open Fufu Segment compilation contract is maintained in [`SEGMENTS.md`](./SEGMENTS.md).

## Inherited OpenFront tooling

OpenFront maps are created and maintained with the Go-based [MapGenerator](../map-generator/README.md).

See the MapGenerator README for information about

- [Creating a new map](../map-generator/README.md#creating-a-new-map)
- [`info.json` schema](../map-generator/README.md#create-infojson)
- [Impassable terrain](../map-generator/README.md#impassable-terrain)
- [Output files](../map-generator/README.md#output-files)
- [Command line flags](../map-generator/README.md#command-line-flags)

The inherited tooling must be adapted so generated Open Fufu maps satisfy the fixed 4.8-million-cell contract and compile the accepted geography-first Segment layer from `SEGMENTS.md` into the versioned/map-hashed artifact.