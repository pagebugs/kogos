# KOGOS Scraper

Serverless Puppeteer scraper that gathers branch/office information from 농협 (NongHyup) cooperative websites. The scraper is designed for **one-off execution** through a Vercel serverless function hosted at `/api/scrape`.

## Features

- ✅ Runs headless Chromium inside Vercel serverless runtime using `puppeteer-core` + `@sparticuz/chromium-min`.
- ✅ Processes a JSON list of cooperative root URLs and automatically detects branch pages.
- ✅ Extracts branch name, address, telephone, and fax when available.
- ✅ Provides verbose logging for each step so that Vercel logs reveal what happened during the run.
- ✅ Returns aggregated results as JSON without any UI or database.

## Project Structure

```
/kogos
├── api
│   └── scrape.js        # Serverless handler that performs the crawl
├── data
│   └── baseSites.json   # Input list of cooperatives to crawl
├── package.json         # Node.js project metadata
└── vercel.json          # Vercel deployment configuration
```

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run locally with Vercel (optional)**
   ```bash
   npx vercel dev
   ```
   Then visit `http://localhost:3000/api/scrape`. The first run downloads the Chromium binary, so expect a longer startup.

3. **Deploy to Vercel**
   - Push the repository to GitHub.
   - In the Vercel dashboard choose *New Project* and connect the repository.
   - Keep the default build command (`npm install`) and no output directory (API only).
   - Ensure the project uses the **Node.js 18** runtime (Vercel default) so that the serverless function matches `vercel.json`.
   - Deploy. The serverless endpoint becomes available at `https://<project>.vercel.app/api/scrape`.

## Configuration

- Update `data/baseSites.json` with the cooperatives you want to crawl.
- Adjust the scraping heuristics in `api/scrape.js` if different DOM structures are encountered.
- Vercel function limits (memory, execution time) can be tweaked in `vercel.json`.

## Response Format

Calling `/api/scrape` returns JSON similar to:

```json
{
  "status": "ok",
  "total": 2,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": [
    {
      "region": "강원",
      "coop": "고성농협",
      "base": "https://gosung.nonghyup.com",
      "branchURL": "https://gosung.nonghyup.com/user/indexSub.do?...",
      "branches": [
        {
          "name": "본점",
          "address": "강원도 고성군 ...",
          "tel": "033-000-0000",
          "fax": null,
          "raw": [
            "본점",
            "강원도 고성군 ...",
            "Tel: 033-000-0000"
          ]
        }
      ],
      "errors": []
    }
  ]
}
```

`raw` preserves the original text lines so that manual post-processing remains possible if automatic parsing fails.

## Notes

- The scraper prioritises links containing `indexSub.do`, because many 농협 branch pages follow that pattern. It falls back to the first link whose text mentions branch-related keywords.
- When no branch link is found or navigation fails, the error is stored in the `errors` array while processing continues for other cooperatives.
- For large input lists, consider splitting the data across multiple endpoints to stay within Vercel's execution limits.

## License

MIT
