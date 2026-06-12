# KitchenFlow

Kitchen duty management system for Navgurukul student communities. Ensures fair, transparent rotation of daily kitchen responsibilities.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, edge functions)
- Deployed on Vercel

## Local Development

Requires Node.js and npm.

```sh
git clone https://github.com/navgurukul/kitchen-flow-fcc8724f
cd kitchen-flow-fcc8724f
npm install
npm run dev
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Features

- Google OAuth restricted to @navgurukul.org accounts
- Role-based access: coordinator and student views
- Automated daily queue rotation at midnight IST
- Skip request workflow with coordinator approval
- Real-time updates via Supabase subscriptions

## Built by

Prachi, Nikita, and Renuka — Navgurukul students.
