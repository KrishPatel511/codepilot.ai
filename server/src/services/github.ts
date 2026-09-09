import axios from "axios";

// A single enormous source file or repository tree can turn one chat request
// into several minutes of model input processing. Keep the agent's tool output
// useful, while making the limit explicit to the user/model.
const MAX_FILE_CONTENT_CHARS = 30_000;
const MAX_TREE_ENTRIES = 750;

function githubApi(token: string) {
  return axios.create({
    baseURL: "https://api.github.com",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
}

/**
 * Searches for a code snippet/keyword inside one repository using GitHub's
 * code search API (much faster than fetching and grepping every file ourselves).
 */
export async function searchCode(token: string, owner: string, repo: string, query: string) {
  const response = await githubApi(token).get("/search/code", {
    params: { q: `${query} repo:${owner}/${repo}` },
  });
  return response.data.items.map((item: any) => ({
    path: item.path,
    url: item.html_url,
  }));
}

/**
 * Lists repositories accessible to the given user's GitHub token.
 */
export async function listRepos(token: string) {
  const response = await githubApi(token).get("/user/repos");
  return response.data.map((repo: any) => ({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    url: repo.html_url,
    private: repo.private,
  }));
}

/**
 * Lists files inside a repo (root or a given path). Only one level deep.
 */
export async function listRepoFiles(token: string, owner: string, repo: string, path: string = "") {
  const response = await githubApi(token).get(`/repos/${owner}/${repo}/contents/${path}`);
  return response.data;
}

/**
 * Reads the raw content of a single file from a repo.
 */
export async function readFile(token: string, owner: string, repo: string, path: string) {
  const response = await githubApi(token).get(`/repos/${owner}/${repo}/contents/${path}`);
  const content = Buffer.from(response.data.content, "base64").toString("utf-8");
  if (content.length <= MAX_FILE_CONTENT_CHARS) return content;

  return `${content.slice(0, MAX_FILE_CONTENT_CHARS)}\n\n[File truncated after ${MAX_FILE_CONTENT_CHARS.toLocaleString()} characters for a fast response. Ask for a specific section or line range to continue.]`;
}

interface TreeEntry {
  path: string;
  type: "file" | "folder";
}

interface TreeNode {
  name: string;
  type: "file" | "folder";
  children: Map<string, TreeNode>;
}

/**
 * Turns a flat list of "a/b/c" paths into an indented ASCII tree string
 * (├──, └──, │) so the frontend can render it verbatim in a code block,
 * instead of relying on the model to hand-draw indentation from a flat list.
 */
function buildTreeString(entries: TreeEntry[], rootLabel: string): string {
  const root: TreeNode = { name: rootLabel, type: "folder", children: new Map() };

  for (const entry of entries) {
    const parts = entry.path.split("/");
    let current = root;
    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          type: isLast ? entry.type : "folder",
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    });
  }

  const lines: string[] = [`${root.name}/`];

  function walk(node: TreeNode, prefix: string) {
    const children = Array.from(node.children.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    children.forEach((child, idx) => {
      const isLastChild = idx === children.length - 1;
      const connector = isLastChild ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${child.name}${child.type === "folder" ? "/" : ""}`);
      walk(child, prefix + (isLastChild ? "    " : "│   "));
    });
  }

  walk(root, "");
  return lines.join("\n");
}

/**
 * Fetches the ENTIRE file/folder structure of a repo in one call, recursively.
 * Uses GitHub's git trees API instead of the contents API (which only shows one level).
 * Returns both a flat path list (for the model to pick exact paths from, e.g. for read_file)
 * and a pre-formatted "treeText" string the model should relay as-is in a code block.
 */
export async function getFullRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
  maxEntries: number = MAX_TREE_ENTRIES
) {
  const api = githubApi(token);

  if (!branch) {
    const repoInfo = await api.get(`/repos/${owner}/${repo}`);
    branch = repoInfo.data.default_branch;
  }

  const response = await api.get(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

  const allEntries: TreeEntry[] = response.data.tree.map((item: any) => ({
    path: item.path,
    type: item.type === "tree" ? "folder" : "file",
  }));
  const entries = allEntries
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, maxEntries);
  const truncated = allEntries.length > entries.length;
  const githubTruncated = Boolean(response.data.truncated);
  const treeText = buildTreeString(entries, repo);

  return {
    paths: entries,
    treeText:
      (truncated
        ? `${treeText}\n\n[Tree preview: showing the first ${entries.length} of ${allEntries.length} entries. Ask for a specific folder to explore the rest.]`
        : treeText) +
      (githubTruncated ? "\n\n[GitHub truncated its recursive tree response because the repository is extremely large.]" : ""),
    truncated,
    githubTruncated,
    totalEntries: allEntries.length,
  };
}

/**
 * Returns the repo's default branch name (e.g. "main"), used to hard-block
 * update_file from ever targeting it directly.
 */
export async function getDefaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const response = await githubApi(token).get(`/repos/${owner}/${repo}`);
  return response.data.default_branch;
}

/**
 * Returns a file's current git blob sha (needed by the Contents API to UPDATE
 * rather than create it), or null if the file doesn't exist yet on that branch.
 */
async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string | null> {
  try {
    const response = await githubApi(token).get(`/repos/${owner}/${repo}/contents/${path}`, {
      params: branch ? { ref: branch } : undefined,
    });
    return response.data.sha;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Creates a new branch off an existing one (defaults to the repo's default branch).
 * Never write fixes directly to the default branch — always branch first so the
 * change lands as a reviewable pull request instead of mutating main/master directly.
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch?: string
) {
  const api = githubApi(token);

  if (!fromBranch) {
    const repoInfo = await api.get(`/repos/${owner}/${repo}`);
    fromBranch = repoInfo.data.default_branch;
  }

  const sourceRef = await api.get(`/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`);
  const sourceSha = sourceRef.data.object.sha;

  try {
    await api.post(`/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${newBranch}`,
      sha: sourceSha,
    });
    return { branch: newBranch, createdFrom: fromBranch, alreadyExisted: false };
  } catch (error: any) {
    // 422 = ref already exists — reuse it instead of failing the whole operation.
    if (error?.response?.status === 422) {
      return { branch: newBranch, createdFrom: fromBranch, alreadyExisted: true };
    }
    throw error;
  }
}

/**
 * Creates or updates a single file's content on a specific branch, producing a real commit.
 * `branch` must be a non-default branch created via createBranch — callers should never
 * point this at the repo's default branch.
 */
export async function updateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
) {
  const sha = await getFileSha(token, owner, repo, path, branch);

  const response = await githubApi(token).put(`/repos/${owner}/${repo}/contents/${path}`, {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  });

  return {
    commitSha: response.data.commit.sha,
    commitUrl: response.data.commit.html_url,
  };
}

/**
 * Opens a pull request from a fix branch into the repo's default branch (or a given base),
 * so the user reviews and merges the change themselves instead of it landing automatically.
 * Idempotent: since every fix shares one branch, a PR from it is often already open by the
 * time a second bug gets fixed — this reuses that existing PR instead of erroring or
 * creating a duplicate (the new commit just joins the PR that's already open).
 */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base?: string
) {
  const api = githubApi(token);

  if (!base) {
    const repoInfo = await api.get(`/repos/${owner}/${repo}`);
    base = repoInfo.data.default_branch;
  }

  try {
    const response = await api.post(`/repos/${owner}/${repo}/pulls`, { title, body, head, base });
    return { url: response.data.html_url, number: response.data.number, alreadyExisted: false };
  } catch (error: any) {
    // 422 = GitHub already has an open PR for this exact head+base pair.
    if (error?.response?.status === 422) {
      const existing = await api.get(`/repos/${owner}/${repo}/pulls`, {
        params: { head: `${owner}:${head}`, base, state: "open" },
      });
      if (existing.data.length > 0) {
        return { url: existing.data[0].html_url, number: existing.data[0].number, alreadyExisted: true };
      }
    }
    throw error;
  }
}
