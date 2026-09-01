# Open Fufu — Controller Runtime and Failure Decisions

## Status and precedence

This document records accepted controller-runtime behavior for Open Fufu before implementation planning begins.

It supplements `docs/OpenFufuDesign.md`, `docs/GameMechanics.md`, and the later mechanics addenda. Where this document makes a concrete decision that an older document describes as tentative or unresolved, **this document takes precedence**.

This is a game-design/runtime-contract document, not an implementation plan.

---

## 1. Controller failure must never become match failure

Player-authored controller code is untrusted and fallible. The authoritative match simulation is not.

A controller exception, timeout, invalid decision, malformed output, or other user-code failure must never crash, corrupt, or abort the authoritative game process.

The governing invariant is:

> **The controller may fail; the match must continue deterministically.**

---

## 2. Decision cycles are transactional

Each controller decision invocation is an all-or-nothing transaction over controller state and proposed game directives.

Conceptually:

```text
canonical controller memory
current observation
        ↓
run controller invocation
        ↓
temporary memory + proposed directives/actions
        ↓
validate
        ↓
SUCCESS -> commit memory + directives
FAILURE -> discard everything from this invocation
```

If user code mutates controller memory and then throws, times out, or returns an invalid decision, those mutations are discarded together with every other output from that invocation.

No partially applied decision cycle is allowed.

---

## 3. Failed invocation keeps the last valid directives

A failed controller invocation does **not** replace the player's strategy with a built-in starter controller or any other AI.

Instead, the faction continues under the last successfully committed directives/state.

Examples of state that may continue unchanged after a failed invocation include:

- desired Population allocation;
- existing attacks/operations where the simulation itself keeps them active;
- ship/naval orders already committed;
- construction already started;
- other persistent game directives accepted before the failure.

Actual Population allocation continues moving toward the last valid desired allocation according to the normal Redeployment Rate rules.

The consequence of a broken controller is therefore primarily loss of adaptation/new decision-making, not replacement by free competent automation.

---

## 4. Controller execution is retried after ordinary failures

A single failed invocation does not permanently disable the controller.

After the failed invocation is discarded, the runtime attempts the controller again on later normal decision cycles.

This allows transient state-dependent bugs to recover naturally if the later game state no longer enters the broken branch.

The failure is logged for debugging and replay analysis.

---

## 5. Persistent failures use a deterministic circuit breaker

Repeated controller failures must not waste unbounded server resources.

The runtime should therefore implement a deterministic circuit-breaker policy for repeated failures.

Accepted behavior:

- initial failures are retried normally;
- repeated consecutive/persistent failures cause retries to become less frequent;
- sufficiently persistent failure marks the controller **FAULTED** for the remainder of the match;
- once faulted, no further controller code is executed for that faction during that match;
- the faction continues under its last valid committed directives until eliminated, capitulated, or the match ends.

Exact retry counts/cooldowns are implementation/tuning values, but the behavior must be deterministic and visible in diagnostics.

Early-match and late-match failures use the same rule. There is no special hidden surrender or replacement behavior based on when the crash occurs.

---

## 6. Ordinary gameplay rejection should not be a programming exception

Normal game-state races and impossible-in-the-current-state actions should generally be represented by safe structured results/rejections rather than runtime exceptions.

Examples include:

- target no longer exists;
- target is no longer owned by the expected faction;
- insufficient FFY;
- invalid build location;
- action is out of range;
- requested object was destroyed between observations/decisions;
- another ordinary game rule prevents completion.

Controller-facing primitives should therefore prefer results equivalent to:

```text
OK
INVALID_TARGET
INSUFFICIENT_FFY
NO_LONGER_OWNED
OUT_OF_RANGE
TARGET_DESTROYED
ALLOCATION_LIMIT
...
```

The game changes constantly. A lawful use of the public API should not require user code to wrap ordinary actions in exception handling merely because the world changed.

Exceptions/timeouts should primarily represent genuine program/runtime failure such as:

- user-thrown exceptions;
- invalid JavaScript/TypeScript behavior;
- null/undefined misuse in user code;
- infinite loop/time-budget exhaustion;
- memory-budget exhaustion;
- other sandbox/runtime violations.

---

## 7. Invalid complete decisions are rejected transactionally

A controller can execute successfully as code but still return an invalid complete strategy/decision.

Example:

```text
Tanya allocation: 70%
Ski allocation:   50%
Total:            120%
```

Such a decision is rejected as a whole.

The runtime must not silently normalize it and must not partially apply whichever individual actions happened to be valid.

Accepted behavior:

```text
controller returns decision
        ↓
validate entire decision transaction
        ↓
invalid
        ↓
reject entire decision
        ↓
retain previous valid directives/state
        ↓
record structured diagnostic
```

This preserves predictability and ensures the engine never secretly rewrites the player's strategy.

---

## 8. `game.lastDecision` is exposed to controller code

The controller API should expose a structured view equivalent to:

```ts
game.lastDecision
```

This allows a controller to reason about the outcome of its previous accepted/rejected decision cycle where useful.

The surface may include information such as:

- whether the previous decision was committed or rejected;
- structured rejection/error codes for ordinary validation failures;
- which high-level request failed and why where safe/useful;
- other deterministic diagnostic metadata intended for programmatic recovery.

Full raw exception internals/stack traces do not necessarily need to be exposed back into the next controller invocation; those are primarily human debugging/replay data. The exact shape of `game.lastDecision` is part of the later controller-API design.

---

## 9. Human-facing diagnostics are first-class

When a controller invocation fails or a decision is rejected, the match/replay tooling should surface useful diagnostics such as:

```text
12:31.500 CONTROLLER ERROR
TypeError: ...

No controller changes were applied.
Previous valid directives remain active.
```

For structured game/validation rejections, diagnostics should identify the relevant code/reason without relying on vague generic messages.

The goal is that a player can understand why their controller stopped adapting and reproduce/fix the problem.

---

## 10. Mandatory certification before publishing controller versions

Controller drafts may be saved while incomplete or broken.

Only a **published immutable controller version** must pass mandatory certification.

Conceptual lifecycle:

```text
edit controller
    ↓
save draft
    ↓
run certification
    ↓
PASS
    ↓
publish immutable version
    ↓
eligible for matches
```

Certification should execute the controller through a very fast deterministic gauntlet of representative game situations using the same production controller contract/runtime limits.

Representative states should exercise ordinary mechanics such as:

- spawn/startup;
- neutral expansion;
- first enemy contact;
- multiple simultaneous enemies;
- partial segment ownership;
- Population/FFY changes;
- enemy elimination/capitulation;
- naval/amphibious opportunities;
- target disappearance;
- structure construction and insufficient FFY;
- rapid territory changes;
- war-state transitions;
- very low Population and other boundary conditions.

Certification rejects versions that encounter issues such as:

- syntax/type/compile failures;
- runtime exceptions;
- timeout or memory-budget violations;
- invalid/non-finite numeric outputs;
- invalid API arguments;
- malformed decisions;
- impossible top-level allocations;
- other controller-contract violations.

Certification is not a mathematical proof that arbitrary user code can never fail in every possible future game state. Its purpose is to make ordinary errors unlikely to reach real matches and to validate lawful use of the controller contract before publication.

---

## 11. Starter controller philosophy

The default player starting point should be one extremely basic but complete working controller, not a large library of strategic policies.

The starter controller should demonstrate lawful use of most important mechanics in a deliberately thoughtless way, for example:

- expand monotonously;
- distribute Population approximately evenly;
- build basic structures evenly/simply;
- use ordinary mechanics without sophisticated threat analysis;
- avoid implementing genuine strategic doctrine for the player.

It should be valid and functional but not reliably strong enough to win serious matches. Its purpose is to provide a working codebase that users can understand and improve.

Documentation may provide examples/snippets, but higher-order strategic policies should generally be created by players from the exposed low-level/composable primitives rather than shipped as privileged engine strategy.

---

## 12. Runtime failure hierarchy

The accepted hierarchy is:

```text
LEGAL GAME ACTION CANNOT BE COMPLETED
    -> structured result/rejection
    -> no runtime exception required

INVALID COMPLETE CONTROLLER DECISION
    -> reject entire decision transaction
    -> retain previous valid directives
    -> log structured diagnostic

USER CODE EXCEPTION / TIMEOUT
    -> abort invocation
    -> discard temporary memory + all proposed changes
    -> retain previous valid directives
    -> retry on later decision cycles
    -> log diagnostic

PERSISTENT CONTROLLER FAILURE
    -> deterministic retry throttling / circuit breaker
    -> eventually mark controller FAULTED for the match
    -> faction continues under last valid directives

AUTHORITATIVE GAME PROCESS
    -> never crashes because a player controller failed
```

This runtime behavior is an accepted part of the Open Fufu controller contract.