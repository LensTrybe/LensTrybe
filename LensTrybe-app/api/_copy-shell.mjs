// After `vite build`: copy the built index.html next to the pre-render function as api/shell.html,
// so the function can bundle it (vercel.json includeFiles) without depending on where dist ends up.
import { copyFileSync } from 'node:fs'
copyFileSync(new URL('../dist/index.html', import.meta.url), new URL('./shell.html', import.meta.url))
console.log('api/shell.html updated from dist/index.html')
