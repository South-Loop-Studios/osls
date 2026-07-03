# @orbitspatial/osls-core

The pure-TypeScript engine for the **Orbit Speaker Layout System** (`.osls`): parse,
validate, serialize, coordinate geometry, and ITU-R BS.2051-3 SP-label lookup. No runtime
framework dependencies (only `yaml` + `ajv`); the canonical `../../schema/osls.schema.json`
is inlined at build.

```ts
import { OSLS, parseLayout, serializeLayout, nearestLabel } from "@orbitspatial/osls-core";
const layout = await OSLS.parse(text);     // or parseLayout(text) synchronously
```

Build: `npm run build` · Test: `npm test` · Typecheck: `npm run typecheck`.
