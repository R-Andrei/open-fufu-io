# Testing

## Active repository test gate

`npm test` runs the active repository test suite while explicitly excluding `tests/server/**`.

The server integration tests are intentionally dormant while the Open Fufu server is still pre-implementation and expected to be substantially redesigned. Their current inherited harness, port lifecycle, and behavioral assumptions are not a stable contract for unrelated foundational work.

The tests remain in the repository and can be run manually with:

```bash
npm run test:server
```

Do not treat this exclusion as acceptance or stabilization of the current server behavior. Re-enable server integration tests in the normal repository/CI gate when substantive Open Fufu server implementation begins. At that point, review and adapt the server test harness to the intended server architecture rather than preserving temporary inherited assumptions solely for compatibility.

`npm run test:coverage` follows the same active-suite boundary and excludes `tests/server/**` from test discovery.
