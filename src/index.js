import * as cheerio from 'cheerio';

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Proxy & Scraper (Cloudflare Worker)</title>
    <style>
        body { font-family: sans-serif; margin: 2rem; }
        .container { max-width: 800px; margin: auto; }
        .input-group { margin-bottom: 1rem; }
        input[type="text"] { width: 70%; padding: 0.5rem; }
        button { padding: 0.5rem 1rem; cursor: pointer; }
        pre { background: #eee; padding: 1rem; overflow-x: auto; max-height: 500px; overflow-y: auto;}
    </style>
</head>
<body>
    <div class="container">
        <h1>Web Proxy & Scraper</h1>
        <div class="input-group">
            <input type="text" id="urlInput" placeholder="Enter URL (e.g., https://example.com)">
            <button onclick="proxyUrl()">Proxy URL</button>
            <button onclick="scrapeUrl()">Scrape URL</button>
        </div>
        <div id="outputContainer" style="display:none;">
            <h3>Output:</h3>
            <pre id="output"></pre>
        </div>
    </div>

    <script>
        async function proxyUrl() {
            const url = document.getElementById('urlInput').value;
            if (!url) return alert('Please enter a URL');
            const output = document.getElementById('output');
            const container = document.getElementById('outputContainer');
            output.textContent = 'Loading...';
            container.style.display = 'block';

            try {
                const response = await fetch('/proxy?url=' + encodeURIComponent(url));
                if (!response.ok) throw new Error('Network response was not ok');
                const text = await response.text();
                output.textContent = text;
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
            }
        }

        async function scrapeUrl() {
            const url = document.getElementById('urlInput').value;
            if (!url) return alert('Please enter a URL');
            const output = document.getElementById('output');
            const container = document.getElementById('outputContainer');
            output.textContent = 'Loading...';
            container.style.display = 'block';

            try {
                const response = await fetch('/scrape?url=' + encodeURIComponent(url));
                if (!response.ok) throw new Error('Network response was not ok');
                const json = await response.json();
                output.textContent = JSON.stringify(json, null, 2);
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
`;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
            'Access-Control-Max-Age': '86400',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (url.pathname === '/') {
            return new Response(htmlContent, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        if (url.pathname === '/proxy') {
            const targetUrl = url.searchParams.get('url');
            if (!targetUrl) {
                return new Response('URL parameter is required', { status: 400, headers: corsHeaders });
            }

            try {
                const response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                const responseHeaders = new Headers(response.headers);
                // Add CORS headers to the response
                for (const [key, value] of Object.entries(corsHeaders)) {
                    responseHeaders.set(key, value);
                }

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders
                });
            } catch (error) {
                return new Response(`Error fetching URL: ${error.message}`, { status: 500, headers: corsHeaders });
            }
        }

        if (url.pathname === '/scrape') {
            const targetUrl = url.searchParams.get('url');
            if (!targetUrl) {
                return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                const html = await response.text();
                const $ = cheerio.load(html);

                const title = $('title').text();
                const links = [];

                $('a').each((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().trim();
                    if (href) {
                        links.push({ text, href });
                    }
                });

                return new Response(JSON.stringify({
                    title,
                    linkCount: links.length,
                    links: links.slice(0, 50),
                    htmlLength: html.length
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                 return new Response(JSON.stringify({ error: `Error scraping URL: ${error.message}` }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
