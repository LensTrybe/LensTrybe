<<<<<<< HEAD
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
=======
# LensTrybe-app

A React dashboard starter built with Vite, React Router, and Supabase client setup.

## Tech Stack

- React
- Vite
- React Router
- Supabase JavaScript client (`@supabase/supabase-js`)

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` into `.env` and provide your Supabase project values:

```bash
cp .env.example .env
```

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Project Structure

```text
src/
  components/   # Reusable UI components/layout
  hooks/        # Custom React hooks
  lib/          # Shared utilities and clients
  pages/        # Route-level page components
  App.jsx       # Router configuration
  main.jsx      # App entry point with BrowserRouter
```
>>>>>>> origin/cursor/lenstrybe-app-initial-setup-6f7d
