# Open Fufu — Origin Validation Coverage Gateway

This directory is the navigation gateway for the detailed Origin validation-coverage registry.

Canonical validation architecture and deployment-eligibility semantics remain owned by [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md). Origin mechanics/costs remain owned by [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md).

The coverage registry is split only for reviewability; all files below use the same canonical relationship model: direct transformations, required integration seams, external semantic dependencies, ordinary downstream consumption, explicit interactions, and mechanic-definition blockers.

## Coverage files

| Coverage | File |
| --- | --- |
| Coverage model + P01–P40 + running blockers through P40 | [`../ORIGIN_VALIDATION_COVERAGE.md`](../ORIGIN_VALIDATION_COVERAGE.md) |
| P41–P50 + new blockers/status corrections | [`P41-P50.md`](./P41-P50.md) |

Future batches should be added here rather than turning one registry file into an unreviewable monolith.

The interaction registry must cover both:

- **same-Origin interactions**, where multiple selected traits affect one effective mechanic; and
- **cross-faction Origin interactions**, where one faction's trait changes state that another faction's trait explicitly queries.

## Authority rule

Trait-effect wording in these coverage files is explanatory shorthand only. If it disagrees with a canonical mechanic owner, the mechanic owner wins and the coverage registry must be corrected. Coverage files must record unresolved mechanic questions as blockers; they must not silently solve them.