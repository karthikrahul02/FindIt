# FindIt — Frontend

FindIt is a campus lost-and-found application. This repository contains the React + Vite frontend.

## Requirements

- Node.js (LTS)
- npm

## Setup

1. Open the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file from the example:

   ```bash
   cp .env.example .env
   ```

4. Set `VITE_API_URL` in `.env` to the base URL of your deployed API.

5. Start the development server:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — start Vite
- `npm run build` — create a production build in `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## AWS integration

The frontend expects an API with the following routes:

- `GET /items`
- `POST /items`
- `POST /upload-url`
- `GET /image-url?key=...`

The API is responsible for the AWS Lambda, DynamoDB, and S3 operations. Do not commit real credentials or private environment files.