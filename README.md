# MovieBox Node Scraper

A Node.js version of the MovieBox scraper/API, designed to run locally and deploy to Vercel.

## Features

- Search titles and suggestions
- Fetch metadata and details
- Browse movies and TV series feeds
- Resolve stream URLs and subtitle URLs
- Built-in dashboard route at `/`

## Local run

```bash
npm install
npm run dev
```

Then visit:

```text
http://localhost:3000
```

## Deploy to Vercel

1. Import this repo into Vercel.
2. Use the default Node.js project settings.
3. Deploy.

## Example endpoints

```text
/search?q=Avatar
/detail/8906247916759695608
/api/stream/8906247916759695608
/api/stream/6207982430134357800?se=1&ep=1
```
