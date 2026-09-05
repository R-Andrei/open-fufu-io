# Open Fufu — Origin Validation Coverage Gateway

This directory is the navigation gateway for the detailed Origin validation-coverage registry.

Canonical validation architecture and deployment-eligibility semantics remain owned by [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md). Origin mechanics/costs remain owned by [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md).

The coverage registry is split only for reviewability; all files below use the same canonical relationship model: direct transformations, required integration seams, external semantic dependencies, ordinary downstream consumption, explicit interactions, and mechanic-definition blockers.

## Coverage files

| Coverage | File |
| --- | --- |
| Coverage model + P01–P40 + running blockers through P40 | [`../ORIGIN_VALIDATION_COVERAGE.md`](../ORIGIN_VALIDATION_COVERAGE.md) |
| P41–P50 + new blockers/status corrections | [`P41-P50.md`](./P41-P50.md) |
| P51–P54 + positive-trait conclusions/corrections | [`P51-P54.md`](./P51-P54.md) |
| N01–N10 + hard-prohibition/admission findings | [`N01-N10.md`](./N01-N10.md) |
| N11–N18 + full-catalogue boundary conclusions | [`N11-N18.md`](./N11-N18.md) |

The interaction registry must cover both:

- **same-Origin interactions**, where multiple selected traits affect one effective mechanic; and
- **cross-faction Origin interactions**, where one faction's trait changes state that another faction's trait explicitly queries.

Negative-trait validation additionally requires explicit treatment of **hard prohibitions, caps, admission rules, and precedence**. These remain owned by the gameplay domain whose action/state is constrained; they do not justify a separate monolithic Origin runtime validator.

## Audit status

Concrete dependency tracing is complete for the entire current Origin trait catalogue:

```text
P01–P54
N01–N18
```

The next design step is to consolidate/review the complete mechanic-definition blocker list, classify each blocker by canonical owner, then freeze the final validation-domain catalogue and explicit interaction registry from the completed traces.

The full-catalogue evidence currently supports nine recurring gameplay validation domains; admission/legality is an explicit stage inside relevant domains rather than a separate tenth domain. See [`N11-N18.md`](./N11-N18.md) for the current consolidated boundary shape.

## Authority rule

Trait-effect wording in these coverage files is explanatory shorthand only. If it disagrees with a canonical mechanic owner, the mechanic owner wins and the coverage registry must be corrected. Coverage files must record unresolved mechanic questions as blockers; they must not silently solve them.