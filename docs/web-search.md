# Web Search

Code Ollama can search the web with the `web_search` tool. [DuckDuckGo](https://duckduckgo.com/) works without configuration, while an optional [SearXNG](https://github.com/searxng/searxng) instance can be used as the primary provider.

## Providers

Web search uses the providers in this order:

1. When a SearXNG URL is configured, Code Ollama searches SearXNG first.
2. If SearXNG fails or returns no results, Code Ollama falls back to DuckDuckGo.
3. When SearXNG is not configured, Code Ollama searches DuckDuckGo directly.

Search results identify the provider and include up to five titles, URLs, and snippets.

## DuckDuckGo

DuckDuckGo is the default provider and requires no configuration. Code Ollama sends the query to DuckDuckGo's HTML search endpoint when the model uses `web_search`.

No API key is required, but an internet connection is required. DuckDuckGo is called a fallback only when a configured SearXNG instance fails or returns no results.

## SearXNG

Configure a SearXNG instance when you want to use a self-hosted metasearch engine as the primary provider.

Use `/search` in the TUI to set or clear the SearXNG URL. You can also set `searxngBaseUrl` in `~/.code-ollama/config.json`:

```json
{
  "searxngBaseUrl": "http://localhost:8080"
}
```

Code Ollama requests the `/search` endpoint with JSON output and the `en-US` language.

## Install SearXNG

Install [Docker](https://docs.docker.com/engine/install/):

```sh
brew install --cask docker
```

Download the SearXNG image:

```sh
docker pull searxng/searxng
```

## Run SearXNG

Start a container:

```sh
docker run -d --name searxng -p 8080:8080 searxng/searxng
```

Check the JSON search endpoint:

```sh
curl 'http://localhost:8080/search?q=test&format=json'
```

The default configuration may return `403 Forbidden` because JSON output is not enabled.

Create `settings.yml` with JSON enabled:

```bash
SECRET_KEY=$(openssl rand -hex 32)

cat > settings.yml <<EOF
use_default_settings: true

server:
  secret_key: "$SECRET_KEY"
  bind_address: "0.0.0.0"
  port: 8080

search:
  formats:
    - html
    - json
EOF
```

Copy the settings into the container:

```sh
docker cp settings.yml searxng:/etc/searxng/settings.yml
```

Restart the container:

```sh
docker restart searxng
```

Confirm JSON search now works:

```sh
curl 'http://localhost:8080/search?q=test&format=json'
```

Configure Code Ollama with `/search` or `searxngBaseUrl` after the endpoint returns JSON.

## Fallback Behavior

When SearXNG returns results, Code Ollama uses them without calling DuckDuckGo.

When SearXNG fails or returns no results, Code Ollama searches DuckDuckGo and includes a fallback note in the tool result. If both providers fail, the tool reports both errors. If neither provider returns results, it reports that no web results were found.

Clear the SearXNG URL with `/search` to use DuckDuckGo directly again.

## Troubleshooting

- Run the `curl` command above to confirm the SearXNG endpoint returns JSON.
- Enable the JSON format in `settings.yml` when SearXNG returns `403 Forbidden`.
- Confirm the configured URL uses `http` or `https` and points to the SearXNG base URL, not the `/search` endpoint.
- Check Docker with `docker ps` and inspect SearXNG logs with `docker logs searxng --tail=100`.
- Look for the provider and fallback note in the `web_search` tool result.
- Clear the SearXNG URL with `/search` if you want to test DuckDuckGo directly.
- Expect fewer than five results when a provider returns entries without a title or URL.

## Stop SearXNG

Stop and remove the container:

```sh
docker rm -f searxng
```
