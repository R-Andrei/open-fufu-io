# Maps

> **Open Fufu status:** This file is inherited OpenFront map-tooling reference documentation and owns no Open Fufu target mechanics.

For Open Fufu work:

- map/gameplay requirements are owned by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- Segment compilation semantics are owned by [`SEGMENTS.md`](./SEGMENTS.md);
- migration, artifact/version binding, and implementation sequencing are owned by [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

Do not copy Open Fufu target constants or resolver rules into this inherited reference.

## Inherited OpenFront tooling

OpenFront maps are created and maintained with the Go-based [MapGenerator](../map-generator/README.md).

See the MapGenerator README for information about

- [Creating a new map](../map-generator/README.md#creating-a-new-map)
- [`info.json` schema](../map-generator/README.md#create-infojson)
- [Impassable terrain](../map-generator/README.md#impassable-terrain)
- [Output files](../map-generator/README.md#output-files)
- [Command line flags](../map-generator/README.md#command-line-flags)

When adapting the inherited tooling for Open Fufu, consume the canonical contracts above rather than restating their target values or algorithms here.
