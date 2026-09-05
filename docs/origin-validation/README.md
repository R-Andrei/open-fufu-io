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

Future batches should be added here rather than turning one registry file into an unreviewable monolith.

The interaction registry must cover both:

- **same-Origin interactions**, where multiple selected traits affect one effective mechanic; and
- **cross-faction Origin interactions**, where one faction's trait changes state that another faction's trait explicitly queries.

Negative-trait validation additionally requires explicit treatment of **hard prohibitions, caps, admission rules, and precedence**. These remain owned by the gameplay domain whose action/state is constrained; they do not justify a separate monolithic Origin runtime validator.

## Audit status

Concrete positive-trait dependency tracing is complete for **P01–P54**. Negative-trait tracing is complete through **N10**. Remaining catalogue audit work is N11–N18.

Do not freeze the final validation-domain taxonomy until the negative-trait audit is complete; the remaining drawbacks may still expose additional admission/precedence boundaries.

## Authority rule

Trait-effect wording in these coverage files is explanatory shorthand only. If it disagrees with a canonical mechanic owner, the mechanic owner wins and the coverage registry must be corrected. Coverage files must record unresolved mechanic questions as blockers; they must not silently solve them.