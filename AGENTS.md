# Coding

- Use pnpm catalogs only for dependencies shared, or clearly intended to be shared, across workspace packages; keep package-specific dependency versions in their own `package.json`.
- Keep user-facing style syntax and semantics a strict subset of Web CSS: unsupported features may be omitted, but never rename or reinterpret them; propose exceptions before implementation. Internal representations may normalize or rename only when their boundary and rationale are clear.
