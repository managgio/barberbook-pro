## Summary

- Scope:
- Why:

## Testing

- [ ] `npm --prefix backend run test:advisor -- --phase=pr`
- [ ] `npm --prefix backend run test:policy`
- [ ] `npm --prefix backend run test:changed`
- [ ] `npm --prefix backend run test:unit`
- [ ] `npm --prefix backend run test:contract` (if adapters/facades changed)
- [ ] `npm --prefix backend run test:parity` (if legacy/v2 behavior touched)
- [ ] `npm --prefix backend run test:coverage:gate`

## Quality Gates

- [ ] `npm --prefix backend run arch:check`
- [ ] `npm --prefix backend run migration:gate:ci`

## Rules confirmation

- [ ] Any change in `backend/src/**` includes test changes in `backend/test/**`.
- [ ] New features include new tests.
- [ ] Bug fixes include at least one regression test.
- [ ] Documentation updated when rules/architecture changed (`docs/ARCHITECTURE.md`, `backend/docs/testing/TESTING_STRATEGY.md`, `backend/test/README.md`).
