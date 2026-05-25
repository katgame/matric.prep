MatricPrep is an exam-practice platform for South African matric learners.

This repo contains:

- A **Next.js** frontend (web)
- A **.NET API** backed by **Postgres** (Docker)

## Getting Started

### Frontend (Next.js)

Run the development server:

```bash
cd c:\Code\mabusha\matricApp
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Backend (ASP.NET Core + Postgres in Docker)

#### Tutor chat (OpenAI)

Tutor chat uses **OpenAI** when enabled. Configure your API key via environment variable (recommended):

```bash
setx OPENAI_API_KEY "your-key-here"
```

Then restart your terminal (or set it for the current session) before starting the API.

Start Postgres + API:

```bash
cd c:\Code\mabusha\matricApp
docker compose up -d --build
```

API runs at `http://localhost:8080`.

Useful endpoints:

- `GET /health`
- `GET /api/subjects`
- `GET /api/papers`
- `GET /api/papers/{paperId}`
- `POST /api/attempts`
- `POST /api/papers/{paperId}/questions/{questionId}/tutor-chat`

Stop containers:

```bash
docker compose down
```

Note: the frontend currently uses `next/font` to load Google fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
