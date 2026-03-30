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
