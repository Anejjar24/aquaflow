# Migration Status

The current local AquaFlow database was created with TypeORM `synchronize` during early development and already contains seeded demo data. An initial generated migration should be created from a clean database snapshot before production use so it does not accidentally encode local/demo-only drift.

Recommended next step:

1. Start a clean PostgreSQL database.
2. Run the application once with `synchronize: true` only in that disposable environment.
3. Generate an initial TypeORM migration from the current entity metadata.
4. Set `synchronize: false` for all shared environments.
5. Apply the generated migration, then run `npm.cmd run seed` only for demo/dev data.

Until that is done, this project should keep using TypeORM synchronization only for local development.
