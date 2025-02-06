# can-start-audio-context

Usage

```js
import { start } from "can-start-audio-context"
const ctx = await start(undefined, { latencyHint: "playback", sampleRate: 48_000 })
console.log(ctx.state) // "running"
```
