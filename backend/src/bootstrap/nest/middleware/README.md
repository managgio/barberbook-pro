Nest middleware adapters live here.

Guidelines:
- Middleware in this folder handles request bootstrap concerns (tenant context binding, correlation setup, etc.).
- Keep tenant resolution internals in `tenancy/*`; this folder only adapts them into Nest delivery pipeline.
- Middleware adapters should remain thin and side-effect free outside context initialization.
