# ThisIsStrategy Marketing Website

A production-ready static marketing website for ThisIsStrategy, built with plain HTML, modern CSS, and minimal vanilla JavaScript. It is configured for a no-build Vercel static deployment.

## Project structure

```text
.
├── index.html
├── services.html
├── free-training.html
├── about.html
├── contact.html
├── thank-you.html
├── 404.html
├── assets/
│   ├── css/styles.css
│   ├── js/main.js
│   └── img/
│       ├── thisisstrategy-logo.svg
│       └── favicon.svg
├── robots.txt
├── sitemap.xml
└── vercel.json
```

## Local preview

Because this is a static site, you can preview it with any simple HTTP server:

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000` in your browser.

## 1. Push the repo to GitHub

```bash
git remote add origin https://github.com/YOUR-USERNAME/thisisstrategy.git
git branch -M main
git push -u origin main
```

If you already created the GitHub repository with a different URL, replace the `origin` URL with your repository URL:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

## 2. Import into Vercel

1. Go to [Vercel](https://vercel.com/new).
2. Choose **Import Git Repository**.
3. Select the GitHub repository.
4. Framework preset: **Other**.
5. Build command: leave blank.
6. Output directory: leave blank.
7. Install command: leave blank.
8. Click **Deploy**.

Vercel will serve the files from the repository root. The `vercel.json` file enables clean URLs such as `/services` and maps them to the matching `.html` files.

## 3. Deploy

After import, every push to the production branch will create a new deployment. For the initial production deploy:

1. Confirm the preview works.
2. Promote it to production if Vercel does not do so automatically.
3. Visit the assigned `*.vercel.app` URL and test `/`, `/services`, `/free-training`, `/about`, `/contact`, `/thank-you`, and a missing URL to confirm the 404 page.

## 4. Add the custom domains in Vercel

In your Vercel project:

1. Open **Settings** → **Domains**.
2. Add `www.thisisstrategy.com`.
3. Add `thisisstrategy.com`.
4. Set `www.thisisstrategy.com` as the primary domain if you want all traffic to use `www`.
5. Follow Vercel's verification prompts.

## 5. DNS records to point the domain to Vercel

Set these DNS records at your domain registrar or DNS provider:

| Host / Name | Type | Value |
| --- | --- | --- |
| `@` | `A` | `76.76.21.21` |
| `www` | `CNAME` | `cname.vercel-dns.com` |

Notes:

- Remove conflicting `A`, `AAAA`, or `CNAME` records for `@` and `www` before adding the Vercel records.
- DNS can take minutes to several hours to propagate.
- Vercel will automatically issue SSL certificates after DNS is correct.

## Swap placeholders later

### Calendly link

In `contact.html`, replace:

```html
https://calendly.com/your-placeholder-link
```

with the real Calendly scheduling URL.

### Training video

The free training page currently uses `assets/img/video-thumbnail.svg` as a locked preview. When the real video is ready, replace the thumbnail section in `free-training.html` with your embed or video player after the opt-in flow is wired.

### Form endpoints

Forms currently post to placeholder endpoints:

- `https://example.com/your-training-endpoint`
- `https://example.com/your-contact-form-endpoint`

Replace those `action` values with your real form processor, CRM webhook, email marketing form endpoint, or serverless function URL. Keep the existing labels and required fields for accessibility and browser validation.

## SEO and deployment files

- `sitemap.xml` lists all public pages.
- `robots.txt` allows crawling and points to the sitemap.
- Every page has a unique title, meta description, canonical URL, Open Graph tags, Twitter Card tags, and the ThisIsStrategy logo/fav icon assets.
- JSON-LD Organization schema is included site-wide, Service schema is included on `/services`, FAQPage schema is included on `/services`, and contactPoint schema is included on `/contact`.
- `vercel.json` includes clean URL rewrites, a `/404` mapping, security headers, and long-lived caching for `/assets/*`.
