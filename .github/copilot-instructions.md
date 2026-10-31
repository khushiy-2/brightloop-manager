Project: Brightloop Subscription Management System (hackathon MVP, deadline today 5pm).
Stack: Next.js App Router, TypeScript, Prisma + PostgreSQL, Tailwind, shadcn/ui, zod.
Source of truth: prisma/schema.prisma. Follow it exactly.
Rules:
- Write REAL, COMPLETE files. No placeholders, no TODO, no empty files, no "rest of code here".
- Business logic goes in src/server/services; route handlers stay thin.
- Validate all input with zod. Check the user's role on the server in every handler.
- Money: use Prisma.Decimal only, never JS floats.
- Keep UI simple: shadcn components, tables with server-side pagination, no fancy animations.
- Do not send real emails: console.log reset links and "sent" actions and set DB fields instead.
- After finishing, run `npm run build`, fix errors, and list every file created or changed.
- Never commit .env.