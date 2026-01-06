# RoomieSync Web

A simplified SvelteKit web app for shared household expense tracking and payment coordination.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up Turso database (free at turso.tech)
turso db create roomiesync-web

# 3. Configure environment variables
cp .env.example .env
# Add your TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to .env

# 4. Push database schema
npm run db:push

# 5. Run development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Tech Stack

- **Framework**: SvelteKit + TypeScript
- **Database**: Turso/LibSQL with Drizzle ORM
- **Auth**: Custom session management (secure, lightweight)
- **Hosting**: Vercel
- **Styling**: CSS custom properties

## Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

See [claude.md](./claude.md) for full project details.
