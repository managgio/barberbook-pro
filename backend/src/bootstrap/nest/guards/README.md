Nest guard adapters live here.

Guidelines:
- Guards in this folder are bootstrap adapters for global/composition-level policies.
- They may wrap guards defined in feature modules (e.g. `auth/admin.guard`) but must not add business logic.
- Keep dependencies explicit and minimal; resolve tenant/user context via ports.
