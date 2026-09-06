# Open Fufu — Final Origin Validation Model

## Status and authority

This document is the **closure summary for issue #31**. It freezes the validation-domain catalogue, admission/legality rule, interaction-registry shape, and external blocker routing derived from the completed P01–P54 / N01–N18 dependency audit.

It does **not** redefine Origin mechanics. Trait mechanics remain canonical in [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md), subsystem baselines remain with their focused owners, and the five-layer certification/deployment architecture remains canonical in [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md).

The detailed per-trait evidence remains in the coverage registry files. This document is the stable conclusion derived from that evidence.

---

# 1. Final validation-domain catalogue

Every deployed trait must resolve to at least one direct validation owner or be explicitly intrinsic-only. A missing owner is a certification failure.

The completed catalogue audit supports exactly these recurring gameplay validation domains:

| Domain | Owns Origin conformance for |
| --- | --- |
| **Spawn / pre-match initialization** | spawn profiles, exact origins, starting-footprint quota/geometry, initial ownership/Population, start-state grants, deterministic resolver/replay |
| **Population state/accounting** | Capacity/Total/Available/committed Population, growth, peak-state entitlements, settlement accounting, casualties/transfers, Population-derived passive effects |
| **Land combat / capture resolution** | offensive/defensive pressure, counter-response, acquisition progress, automatic defense, capture casualties, post-capture consequences, structure-capture consequence dispatch |
| **Terrain / territorial mutation** | faction-effective terrain classification, terrain acquisition rules, Fallout overlays, abandonment/neutralization, terrain construction permissions |
| **Persistent structures / transactions / lifecycle** | purchase/upgrade/grant/capture admission, hard caps/prohibitions, provenance, active level/state, effective fields, charge-bearing structures, destruction/transfer |
| **FFY economy / physical logistics** | FFY source/event families, modifier ordering, spatial yields/hard zero, passive sources, Train/Trade lifecycle, piracy, explicit costs/losses/snapshots |
| **Naval / amphibious lifecycle** | Warship/Transport admission and profiles, movement, rank/caps, repair, embarkation, landing/abort/destruction, carried Population |
| **Strategic weapons / interception** | launcher legality, weapon access/cost, launch charges/cooldowns, projectile motion/classification, blast geometry, SAM interception/anti-ship behavior |
| **Observation / concealment** | lawful observation/reveal/blackout/concealment geometry, hostile-manifestation exceptions, controller/AI-visible projection |

These are validation ownership boundaries, not new monolithic runtime systems. A trait may require more than one direct owner only when it genuinely changes mechanics owned by multiple domains; otherwise cross-system consequences are modeled as integration seams rather than duplicate ownership.

## 1.1 Admission / legality is a stage, not a tenth domain

Hard prohibitions, ownership caps, permissions, entitlements, and alternate purchase paths are enforced inside the domain that owns the action/state being admitted.

Canonical action shape:

```text
request / input
    ↓
canonical legality / admission
    ↓
effective transaction / profile
    ↓
authoritative resolution
    ↓
cross-system consequences
```

A hard prohibition or cap must fail before resources, entitlements, construction slots, or other transactional state are consumed. It cannot be bypassed merely because another trait makes the action free, changes the payment resource, grants the result, changes terrain permission, or modifies a later runtime effect.

Examples established by the audit include N05 over Fallout acquisition, N06 over paid upgrade actions, N07 over every structure-creation/transfer path, N09 over Factory construction, and N12 over Warship construction even when P42 replaces the ordinary FFY payment.

---

# 2. Final coverage relationship model

The validator metadata must preserve four distinct relationships rather than reducing coverage to `trait -> domains[]`:

1. **Direct transformation** — the gameplay owner whose canonical rule/value/permission/state the trait directly changes.
2. **Required integration seam** — trait-specific state/event flow crossing subsystem boundaries that needs explicit integration coverage.
3. **External semantic dependency** — canonical state/mechanics the trait reads without owning.
4. **Ordinary downstream consumption** — valid canonical output that normal downstream systems consume without gaining redundant trait-specific implementations/tests.

Conceptually:

```ts
interface OriginTraitValidationCoverage {
  traitId: OriginTraitId;
  directOwners: readonly OriginValidationDomainId[];
  integrationSeams?: readonly OriginValidationSeamId[];
  semanticDependencies?: readonly OriginValidationDependencyId[];
  explicitInteractions?: readonly OriginValidationInteractionId[];
}
```

The exact implementation type is not fixed by this documentation; the relationship semantics are.

---

# 3. Final interaction-registry rules

The interaction registry must be **explicit but selective**. It is not an all-pairs compatibility matrix.

A dedicated interaction is required when one trait changes a value, state, geometry, legality result, event, or lifecycle point that another trait directly consumes, or when precedence across traits must be proven. Otherwise each trait relies on independent domain conformance plus generated composition/property validation.

The registry distinguishes:

1. **Same-Origin same-axis composition** — multiple selected traits modify the same effective hook.
2. **Same-Origin cross-axis / cross-system seam** — traits affect different hooks but one materially feeds another subsystem result.
3. **Hard-prohibition / hard-zero precedence** — a structural prohibition/zero must not be resurrected by a numeric modifier or alternate path.
4. **Cross-faction Origin interaction** — one faction's trait changes state/classification queried by another faction's trait.
5. **External-system dependency** — a trait consumes canonical game state owned outside the Origin layer.
6. **Representative aggregate composition suites** — used where many independent modifiers meet in one ordinary aggregate but no pair has special semantics.

## 3.1 Required explicit interaction groups from the current catalogue

The following groups are required by the completed audit. This is a validation registry, not a new trait-mechanics definition; exact expected outcomes remain with the canonical mechanic owners.

### Spawn / initial-state

- **P01 + P39** — modified total Initial-Territory quota is split only after P01 changes the total.
- **P01 + P54** — star geometry preserves P01's modified quota.
- **P39 + P54** — both stable P39 footprints use independent `P54_STAR_V1` priority fields while preserving one total faction quota/Population pool.
- **P39 + P20** — after Initial-Territory ownership, exactly one starting-Silo grant is requested at stable primary `originSlot 0`; P39 never duplicates the singular grant, #45's generic exact-cell admission/lifecycle applies without a fallback Silo location, and the admitted result consumes #46's ordinary newly materialized persistent-Silo lifecycle.
- **P48 with P01/P39/P54 footprint accounting** — faction-effective population-bearing Shallow Water must be respected wherever Spawn quota accounting queries population-bearing classification.

### Population / growth / settlement

- **P02 + N01** — replacement utilization curve and City-growth reduction remain separate hooks.
- **P11 + N07** — permanent SAM entitlement and global one-per-type structure rule are both mandatory ownership constraints on the same admission. An acquisition must satisfy both; normalized cap-valued rule composition remains #43-owned.
- **P36 + N18** — settlement Population cost and final non-Fallout progress multiplier remain independent.
- **P52 + P48** — P48 changes effective Capacity consumed by P52's empty-Capacity economy source.

### Land combat / terrain / capture

- **P03 with P09/N08/N10** — P03 ignores only the effective Fort-derived defense after Fort magnitude/coverage transformations.
- **P13/P15/N02/N03 and other independent pressure modifiers** — representative multi-source pressure-composition suites rather than a bespoke test for every legal pair.
- **P16 + N05** — N05's Fallout-acquisition prohibition wins over P16's resistance removal.
- **P16 + N18** — P16 removes the ordinary Fallout penalty while N18 continues to halve non-Fallout progress.
- **P18 with P09/N10** — effective Fort geometry changes the P18 qualifying source region.
- **P19 -> Territorial Contact / Minor-Faction lifecycle** — external dependency; canonical semantics are closed by #34 and must be consumed rather than redefined.
- **P44 attacker -> P48 defender** — P44's population-bearing target eligibility uses the defender's effective classification.
- **N18 attacker -> P47 defender** — non-Fallout progress transformation and post-capture Marsh casualty resolve in their separate authored stages.
- **N17 with P05/P34** — the canonical capture resolver produces `DESTROYED_ON_CAPTURE` instead of `STRUCTURE_TRANSFERRED`; effects requiring successful structure acquisition are suppressed while the underlying cell capture remains successful.

### Structure fields / structure transactions

- **P09 + N10** — same-axis Fort coverage composition; routed to #43/#44.
- **P09 with P24/P50** — transformed Fort geometry/magnitude must feed downstream event/support fields.
- **P50 + N08** — P50 derives offense from the effective Fort defensive magnitude, so an N08 zero must remain zero.
- **P50/P51 with ordinary reciprocal structure fields** — Fort and Command-Post cross-type contributions use the canonical complement rule even when only one reciprocal Origin trait is selected.
- **P20 + P21** and **P37 + P21** — grants do not consume first-purchase entitlements.
- **P20/P37 + N07** — grants pass generic ownership/admission; rejection creates no granted structure and does not roll back the triggering spawn/landing result.
- **P37 landing-cell capture disposition** — a successfully transferred captured structure keeps the landing cell occupied and blocks the exact-cell Fort grant; N17 or an N07-rejected `CAPTURE_TRANSFER` may instead destroy that captured structure and free the cell, after which the P37 Fort grant is independently evaluated. A separate full Fort slot can still reject the Fort.
- **P41 + N06** — direct-L5 City creation is one five-second purchase/construction action rather than FFY-funded upgrade spending. During construction it has no completed level, remains inactive, targets L5, and preserves that pending target/time if captured.
- **N09 + P34/P07/P43** — Factory construction prohibition does not suppress transformations/services on a Factory acquired through a separately legal transfer.

### FFY / Train / Trade

- **P05 + N17** — P05 consumes `STRUCTURE_TRANSFERRED`, so it does not fire on N17 `DESTROYED_ON_CAPTURE`.
- **P05 + P34** — when transfer is admitted, capture FFY and conquered-Factory provenance can coexist on one atomic capture resolution.
- **P07 + P33** — bonus Trains produce ordinary qualifying Train events and therefore P33 Population side effects.
- **P07 + P34** — #49 closes their interaction through owner-scoped Factory Train-service epochs and dispatch-time Factory economic snapshots; P07 cadence remains unchanged while qualifying primary/bonus Trains consume the P34-transformed Factory profile.
- **P14 + P24** — independent eligible spatial FFY modifiers may apply to the same event through the canonical FFY modifier algebra.
- **P14/P24/N04 + N11** — N11's explicit hard zero cannot be resurrected by ordinary positive/negative yield percentages.
- **N14 + N16** — first-hostile-capture owner-side `-Vowner` and `+Vowner` deltas cancel exactly while physical cargo continues normally.
- **P08 -> canonical `atWar`** — external dependency; canonical semantics are closed by #33. Trade events read current `atWar` at event resolution rather than Origin validation inventing a second war lifecycle.
- **N14/N16 with P08/spatial yield rules** — consume the canonical launch-time `Vowner` snapshot and signed-transaction contract closed by #48; later event-resolution war state must not retroactively mutate that stored reference.

### Naval / strategic weapons

- **P22 + P29** — consume #46's dynamic mobile-launcher capacity lifecycle after the Origin layer resolves P29's effective launcher level.
- **P23 + P42** — P23 hard-cap admission is closed by #45; same-axis Warship attack-range composition remains routed to #43.
- **N12 + P42** — Warship build prohibition wins before P42's Population-funded transaction can consume resources.
- **P27 + P40** — anti-ship SAM attacks share P40's effective range, one-charge capacity, and recharge lifecycle; mechanic closure routed to #50.
- **P32/P37/N13/N15 Transport lifecycle combinations** — P37's exact-cell grant lifecycle is closed by #45; unresolved N13 landing-casualty order/rounding remains routed to #50.
- **P29 with P25/P26** — consume #46's exact-physical-launcher transaction while applying the Origin-level weapon transforms from the catalogue.
- **P10 with MIRV/SAM interception** — consume #46's canonical projectile taxonomy, launch-bound motion profiles, physical interception, and travel-time-independent blast identity.
- **P25 + Water Nukes** — consume the P25 authored area transform through #46's single `STRATEGIC_BLAST_V1` footprint; Water Nukes changes effects rather than geometry.
- **P53 with P20** — consume the ordinary newly materialized persistent-Silo state from `TERRAIN_AND_STRUCTURES.md` as P53 input.
- **P53 with persistent-Silo upgrade/capture** — consume the canonical persistent-Silo READY projection after those lifecycle transitions rather than maintaining a validation-owned charge rule.
- **P53 negative assertion against P29** — assert the Origin-authored persistent-Silo-only eligibility boundary against mobile Warship launcher state.
- **P30 with N14/N16** — transformed hostile piracy payout remains separate from original-owner N14/N16 voyage deltas.

### Observation / concealment

- **P45 + P49** — terrain and structure concealment predicates compose as a union/continued concealment through one lawful visibility projection rather than numeric stacking/cancellation.
- hostile-manifestation exception behavior shared by P45/P49 is routed to #51.

## 3.2 What does not enter the explicit interaction registry

Do not add a dedicated pair merely because two traits can coexist or because both ultimately influence a broad aggregate.

Examples:

- speed plus payout modifiers that do not read one another;
- independent Train-count and wartime-yield modifiers;
- unrelated offensive-pressure sources that already enter the ordinary canonical pressure aggregate;
- generic downstream effects of changed Population/Capacity/ownership once the authoritative upstream state is already correct.

Those cases receive ordinary per-domain conformance plus generated legal-combination/property coverage.

---

# 4. Blocker routing

The full audit intentionally did not invent missing gameplay semantics inside #31. Every mechanic-definition blocker discovered by the audit was assigned to a focused canonical-owner issue.

| Issue | Canonical closure scope | Principal audit blockers routed there |
| --- | --- | --- |
| **#32 — Random/Fixed Spawn × spawn-transforming Origins** | Spawn profiles/resolver | **resolved by #32:** mode-independent P39/P54 semantics across Strategic/Random/Fixed, stable P39 slots and quota split, deterministic Random origins, strict Fixed inputs, singular P20 slot-0 ordering, and exact `P54_STAR_V1` template/scoring/replay binding |
| **#43 — Origin/effective-rule modifier algebra** | reusable effective-rule composition | P09+N10 Fort-area arithmetic, P23+P42 range arithmetic, P09 defensive-pressure composition, generic normalization of multiple cap-valued rule sources |
| **#44 — structure-field geometry and affiliation** | effective Fort/SAM fields | area→geometry/raster conversion, P24 qualifying Fort affiliation, N11 qualifying SAM affiliation/effective P40 area |
| **#45 — admission/grants/transfers/caps** | atomic action/result admission | **resolved by #45:** generic structure acquisition/grants/capture resolver, in-progress structure-state preservation, N07 overflow, P37 exact-cell grant lifecycle, P20 generic L1 activation after #32 ordering, P23 concurrent cap reservation, P41 five-second direct-L5 construction |
| **#46 — strategic launcher/projectile/charge/blast semantics** | strategic weapon executable contracts | **resolved by #46:** canonical strategic projectile/motion, deterministic blast-profile, persistent/mobile launcher-state, and P53-input contracts in their focused owners |
| **#47 — Population/territorial accounting edge cases** | Population and territorial state | P02 curve, P35 abandonment state, P36 residual accounting, P47 casualty debit source |
| **#48 — FFY event/Trade snapshot semantics** | FFY event values/locations/snapshots | **resolved by #48:** P05 value/location/capture-tick sampling plus immutable Trade-voyage owner-value snapshots, first-hostile-capture persistence, signed N14/N16 transaction aggregation, and ordinary cargo/value separation |
| **#49 — Factory/Train transformed lifecycle** | Factory provenance/services | **resolved by #49:** owner-scoped P07 Factory Train-service epochs/serialized phase, exact P34 transformed Factory axes, current-ownership conquest provenance, and dispatch-time Train economic snapshots |
| **#50 — naval/amphibious Origin interactions** | Transport/SAM-vs-ship mechanics | N13 landing casualty order/rounding, P27 complete anti-ship SAM behavior, P28 Transport-Population theft |
| **#51 — tactical observation/concealment** | observation visibility contract | P45 Forest interior/boundary geometry, P45/P49 minimum hostile-manifestation reveal payload/precedence/lifetime |

No remaining discovered mechanic-definition blocker is owned by issue #31. #31 owns the validation architecture and coverage declaration that represents unresolved external mechanics as `BLOCKED` rather than pretending they pass.

Closed dependencies and resolved downstream contracts are consumed directly from their canonical owners:

- **#32** closes P39/P54 all-mode Spawn semantics, P20 multi-origin singular-grant ordering, and resolver-v1 `P54_STAR_V1` geometry/replay binding;
- **#33** closed canonical `atWar` lifecycle consumed by P08/Trade validation;
- **#34** closed Minor-Faction placement/behavior consumed by P19/contact validation;
- **#45** closes the generic admission/grant/capture contract and P23/P41 lifecycle details while preserving neighboring ownership boundaries;
- **#46** closes the strategic projectile/blast/mobile-launcher contracts in `NAVAL_AND_STRATEGIC_WEAPONS.md` and the persistent-Silo contract in `TERRAIN_AND_STRUCTURES.md`; Origin traits consume those owners rather than duplicating them;
- **#48** closes P05 FFY event realization and Trade-voyage snapshot/signed-transaction semantics in `FFY_ECONOMY.md`; Origin validation consumes those contracts rather than reopening them;
- **#49** closes P07 Factory Train-service ownership-epoch behavior and P34 conquered-Factory effectiveness/provenance, consumed directly from the Factory/Train canonical owners;
- **#30 / #42** closed the Open Fufu CI baseline; exact workflow selection/wiring remains CI-owned rather than Origin-validation-owned.

---

# 5. Completion state for #31

The #31 design/documentation work is complete when all of the following are true:

- the impossible pre-mechanics exhaustive Origin runtime gate is removed from the migration dependency spine;
- the five-layer certification model and aggregate deployment predicate are canonical;
- `UNAVAILABLE / BLOCKED / FAIL / PASS` evidence states are canonical;
- live named-Origin validation is cheap and does not launch runtime certification;
- every current trait P01–P54/N01–N18 has a concrete dependency/ownership trace;
- the final nine validation domains are frozen;
- admission/legality is explicitly modeled as a stage inside action-owning domains;
- explicit interaction-registry rules and required current-catalogue groups are frozen;
- discovered mechanic-definition blockers are routed to focused canonical owners instead of silently resolved in validation metadata;
- neighboring CI, AI, Echo, Spawn, `atWar`, and Minor-Faction ownership boundaries are preserved.

All of those #31-scoped design/documentation deliverables are complete. Remaining implementation of gameplay mechanics, validators, CI jobs, and resolution of the still-open downstream contracts (#43, #44, #47, #50, #51) is owned by those systems/issues; #32, #45, #46, #48, and #49 have now closed their scoped mechanic-definition contracts in their canonical owners. Their runtime implementation may still be `UNAVAILABLE` under the architecture without making the design contract `BLOCKED`.

Historical `Next work items` sections inside the per-batch coverage files record the audit sequence at the time each batch was written. They are superseded by this final model and must not be interpreted as remaining #31 work.