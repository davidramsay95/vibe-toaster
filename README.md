# Maillard One — parody landing page

A fictional AI toaster. Everything (including the product imagery) is procedural.

- `npm run dev` — dev server
- `npm run build` / `npm run preview` — production build in `dist/`
- `node scripts/render.mjs [name…]` — re-render the product stills in `public/img/` (needs the dev server on :5173 and Chrome)

Stack: Vite, three.js (PBR, shadows, bloom), Lenis smooth scroll, plain CSS. The 3D toaster is built from ~12 procedural
components in `src/toaster.js`; the scroll-driven exploded view is choreographed in `src/main.js`.

*Maillard is a fictional product; this site is satire and nothing on it is for sale.*
