import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
})[character]);

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);

export function renderStatsCard(user, repos) {
  const stats = [
    ["Public repositories", repos.length, "#63d6be"],
    ["Total stars", repos.reduce((sum, repo) => sum + repo.stargazers_count, 0), "#f4bf75"],
    ["Followers", user.followers, "#84b6f4"],
    ["Following", user.following, "#e58cae"],
  ];
  const entries = stats.map(([label, value, color], index) => {
    const x = index % 2 === 0 ? 32 : 270;
    const y = index < 2 ? 94 : 151;
    return `<g><text x="${x}" y="${y}" class="label">${label}</text><text x="${x}" y="${y + 29}" class="value" fill="${color}">${formatNumber(value)}</text></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(user.login)} GitHub stats</title><desc id="desc">Public repositories, total stars, followers, and following.</desc><rect width="494" height="194" x="0.5" y="0.5" rx="8" fill="#0d1117" stroke="#30363d"/><text x="32" y="43" class="heading">${escapeXml(user.login)} · GitHub Stats</text>${entries}<style>.heading{font:600 18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#e6edf3}.label{font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#8b949e}.value{font:600 20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}</style></svg>`;
}

export function renderLanguagesCard(user, repos) {
  const counts = new Map();
  for (const repo of repos) {
    if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  const languages = [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  const total = languages.reduce((sum, [, count]) => sum + count, 0) || 1;
  const colors = ["#63d6be", "#84b6f4", "#f4bf75", "#e58cae", "#b6a0f5", "#f0883e"];
  const rows = languages.length ? languages.map(([language, count], index) => {
    const y = 78 + index * 21;
    const barWidth = Math.max(3, 430 * count / total);
    return `<g><text x="32" y="${y}" class="label">${escapeXml(language)}</text><text x="463" y="${y}" class="count" text-anchor="end">${Math.round(count / total * 100)}%</text><rect x="32" y="${y + 6}" width="430" height="5" rx="2.5" fill="#21262d"/><rect x="32" y="${y + 6}" width="${barWidth}" height="5" rx="2.5" fill="${colors[index]}"/></g>`;
  }).join("") : `<text x="32" y="92" class="label">No public language data yet</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="215" viewBox="0 0 495 215" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(user.login)} top languages</title><desc id="desc">Top languages by number of public repositories.</desc><rect width="494" height="214" x="0.5" y="0.5" rx="8" fill="#0d1117" stroke="#30363d"/><text x="32" y="43" class="heading">Top Languages</text><text x="32" y="61" class="subheading">By public repository count</text>${rows}<style>.heading{font:600 18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#e6edf3}.subheading,.label{font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#8b949e}.count{font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#c9d1d9}</style></svg>`;
}

export async function generateStats({ username, token, outputDirectory = "dist", fetchImpl = fetch }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const request = async (url) => {
    const response = await fetchImpl(url, { headers });
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status}): ${url}`);
    return response.json();
  };

  const user = await request(`https://api.github.com/users/${encodeURIComponent(username)}`);
  const repos = [];
  for (let page = 1; ; page += 1) {
    const batch = await request(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&type=owner`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "github-stats.svg"), renderStatsCard(user, repos)),
    writeFile(resolve(outputDirectory, "top-langs.svg"), renderLanguagesCard(user, repos)),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const username = process.env.GITHUB_REPOSITORY_OWNER ?? "GreenKod";
  await generateStats({ username, token: process.env.GITHUB_TOKEN });
}