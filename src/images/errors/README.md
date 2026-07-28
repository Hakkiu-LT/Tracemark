# Error illustrations

These images are shown by `src/components/error-state.tsx` when a request fails.
The **filename maps to the HTTP-status bucket** — the leading digit of the status
code picks the image, and the exact code (e.g. `404`) is shown as text next to it.

| File             | Shown when the status is…                     |
| ---------------- | --------------------------------------------- |
| `1xx.png`        | 100–199 (informational)                       |
| `2xx.png`        | 200–299 (unexpected — response couldn't parse)|
| `3xx.png`        | 300–399 (redirect)                            |
| `4xx.png`        | 400–499 (bad request, auth, not found, …)     |
| `5xx.png`        | 500–599 (server error)                        |
| `signal-lost.png`| No response at all (offline / DNS / timeout)  |

> The real 1024×1024 artwork is in place. To swap an illustration, overwrite the
> file keeping the exact filename above (or update the import in `error-state.tsx`
> if you change format/name). `.png` is the default.
