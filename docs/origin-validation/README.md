# Open Fufu — Origin Validation Coverage Gateway

This directory is the navigation gateway for the detailed Origin validation-coverage registry.

Canonical validation architecture and deployment-eligibility semantics remain owned by [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md). Origin mechanics/costs remain owned by [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md).

The coverage registry is split only for reviewability; all files below use the same canonical relationship model: direct transformations, required integration seams, external semantic dependencies, ordinary downstream consumption, explicit interactions, and mechanic-definition blockers.

## Coverage files

| Coverage | File |
| --- | --- |
| **Final frozen validation domains, interaction registry, blocker routing, and #31 completion state** | [`FINAL_VALIDATION_MODEL.md`](./FINAL_VALIDATION_MODEL.md) |
| Coverage model + P01–P40 + running blockers through P40 | [`../ORIGIN_VALIDATION_COVERAGE.md`](../ORIGIN_VALIDATION_COVERAGE.md) |
| P41–P50 + new blockers/status corrections | [`P41-P50.md`](./P41-P50.md) |
| P51–P54 + positive-trait conclusions/corrections | [`P51-P54.md`](./P51-P54.md) |
| N01–N10 + hard-prohibition/admission findings | [`N01-N10.md`](./N01-N10.md) |
| N11–N18 + full-catalogue boundary conclusions | [`N11-N18.md`](./N11-N18.md) |

The interaction registry covers both:

- **same-Origin interactions**, where multiple selected traits affect one effective mechanic;
- **cross-faction Origin interactions**, where one faction's trait changes state that another faction's trait explicitly queries;
- hard-prohibition/hard-zero precedence;
- external-system dependencies;
- representative composition suites where an all-pairs matrix would be redundant.

Negative-trait validation additionally requires explicit treatment of **hard prohibitions, caps, admission rules, and precedence**. These remain owned by the gameplay domain whose action/state is constrained; they do not justify a separate monolithic Origin runtime validator.

## Audit status — complete

Concrete dependency tracing is complete for the entire current Origin trait catalogue:

```text
P01–P54
N01–N18
```

The blocker review is complete. Every mechanic-definition blocker discovered by the audit was routed to its canonical owner rather than solved inside validation metadata. The #32 Spawn blockers and #45 admission blockers are now resolved by their canonical contracts; remaining unresolved closure routes are #43, #44, and #46–#51.

The final validation-domain catalogue, admission/legality stage rule, interaction-registry requirements, blocker routing, and #31 completion criteria are frozen in [`FINAL_VALIDATION_MODEL.md`](./FINAL_VALIDATION_MODEL.md).

Historical `Next work items` sections inside the batch files describe the audit sequence as it existed when those batches were written. They are superseded by the final model and are not remaining #31 work.

## Authority rule

Trait-effect wording in these coverage files is explanatory shorthand only. If it disagrees with a canonical mechanic owner, the mechanic owner wins and the coverage registry must be corrected. Coverage files must record unresolved mechanic questions as blockers; they must not silently solve them.