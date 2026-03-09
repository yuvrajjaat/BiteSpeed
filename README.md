# BiteSpeed Identity Reconciliation

Backend service for identifying and consolidating customer contacts across multiple purchases.

## Live Endpoint

**Base URL:** `https://bitespeed-vrg2.onrender.com`

**POST** `/identify`

```json
{
  "email": "example@test.com",
  "phoneNumber": "123456"
}
```

## Tech Stack

- Node.js + TypeScript
- Express.js
- PostgreSQL
- Prisma ORM

## Local Setup

1. Clone the repo
2. `npm install`
3. Set `DATABASE_URL` in `.env` to your PostgreSQL connection string
4. `npx prisma migrate deploy`
5. `npm run dev`

## Deploy to Render

1. Create a PostgreSQL database on Render
2. Create a Web Service pointing to this repo
3. Set environment variable `DATABASE_URL` to the Render PostgreSQL internal URL
4. Build command: `npm install && npm run build && npx prisma migrate deploy`
5. Start command: `npm start`
