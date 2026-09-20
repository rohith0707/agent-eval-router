export type RepositoryContext = {
  owner: string;
  repo: string;
  url: string;
  defaultBranch?: string;
  rootFiles: string[];
  selectedFiles: Array<{ path: string; content: string }>;
  provenance: "LIVE_GITHUB_CONTEXT";
};

function parseGithubUrl(value: string): { owner: string; repo: string; url: string } | null {
  const match = value.match(/https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  return { owner, repo, url: "https://github.com/" + owner + "/" + repo };
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
}

async function githubJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("GitHub API returned HTTP " + response.status);
  }
  return response.json();
}

function rankFile(path: string, task: string): number {
  const text = (path + " " + task).toLowerCase();
  let score = 0;
  if (path.toLowerCase().includes("readme")) score += 1;
  if (/\btest|spec\b/.test(text)) score += 4;
  if (/\bci|workflow|github\/actions\b/.test(text)) score += 4;
  if (/\bpackage\.json|pyproject\.toml|requirements\.txt\b/.test(path.toLowerCase())) score += 3;
  if (/\bapi|route|main|app|index\b/.test(text)) score += 2;
  return score;
}

export async function inspectGithubRepository(task: string): Promise<RepositoryContext | null> {
  const parsed = parseGithubUrl(task);
  if (!parsed) return null;

  const apiRoot = "https://api.github.com/repos/" + parsed.owner + "/" + parsed.repo;
  const [repoMeta, root] = await Promise.all([
    githubJson(apiRoot),
    githubJson(apiRoot + "/contents"),
  ]);

  const files = Array.isArray(root)
    ? root.filter((entry) => entry && entry.type === "file" && typeof entry.path === "string")
    : [];

  const prioritized = files
    .sort((a, b) => rankFile(b.path, task) - rankFile(a.path, task))
    .slice(0, 8);

  const selectedFiles: Array<{ path: string; content: string }> = [];
  for (const entry of prioritized) {
    try {
      const file = await githubJson(apiRoot + "/contents/" + entry.path.split("/").map(encodeURIComponent).join("/"));
      if (file && file.content && file.encoding === "base64") {
        const content = Buffer.from(file.content, "base64").toString("utf8");
        selectedFiles.push({ path: entry.path, content: content.slice(0, 16000) });
      }
    } catch {
      // One unreadable file must not abort the whole repository inspection.
    }
  }

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    url: parsed.url,
    defaultBranch: typeof repoMeta?.default_branch === "string" ? repoMeta.default_branch : undefined,
    rootFiles: files.map((entry) => entry.path).slice(0, 120),
    selectedFiles,
    provenance: "LIVE_GITHUB_CONTEXT",
  };
}

export function formatRepositoryContext(context: RepositoryContext): string {
  const fileText = context.selectedFiles
    .map((file) => "\n--- " + file.path + " ---\n" + file.content)
    .join("\n");
  return [
    "Repository context:",
    context.url,
    "Default branch: " + (context.defaultBranch ?? "unknown"),
    "Root files: " + context.rootFiles.join(", "),
    fileText,
  ].join("\n");
}
