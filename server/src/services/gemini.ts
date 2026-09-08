import { GoogleGenerativeAI, SchemaType, Tool } from "@google/generative-ai";
import dotenv from "dotenv";
import {
  listRepos,
  listRepoFiles,
  readFile,
  getFullRepoTree,
  searchCode,
  createBranch,
  updateFile,
  createPullRequest,
  getDefaultBranch,
} from "./github";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("⚠️  GEMINI_API_KEY is missing in .env file");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Gemini 3.8 Flash is the requested production model. Keep a lighter model as
// a fallback so a temporary 3.8 overload does not leave the user waiting.
const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Every fix, for every bug, in every repo, lands on this ONE branch — enforced in
// executeTool regardless of what the model asks for, so fixing 5 bugs across 5
// conversations still produces exactly one branch and one pull request per repo,
// not five. Each new fix is just another commit onto the same branch/PR.
const FIX_BRANCH_NAME = "codepilot-fixes";

const SYSTEM_INSTRUCTION = `You are CodePilot, an AI coding agent that helps the user with their GitHub repositories.

You have tools to list repos, list files, read file contents, and get a full repo tree — use them whenever you need real data instead of guessing.

When the user asks you to review code, find bugs, spot issues, or suggest improvements:
1. Use read_file (or get_full_repo_tree first if you need to find the right file) to get the actual file content.
2. Actually analyze it — don't just summarize what the file does. Look for: bugs, null/undefined handling gaps, off-by-one errors, security issues, performance problems, bad practices, and readability issues.
3. Reference specific line numbers or code snippets in your findings.
4. If the code looks fine, say so honestly instead of inventing problems.

When the user asks for a repo's folder/file structure, tree, or "show me everything":
- Call get_full_repo_tree and paste its "treeText" field EXACTLY as returned, inside a fenced code block using \`\`\`text — do not retype, reformat, summarize, or convert it into a table or prose. It is already correctly indented.
- Use the "paths" field only to look up an exact file path when you then need to call read_file — never re-derive a path from the printed tree text.

When the user asks to search, find, or look for a keyword/function/text inside a repo, use search_code instead of reading files one by one.

When the user asks you to FIX a bug (not just find/explain it) and commit, push, or open a PR for it:
1. Use read_file to get the current content and pinpoint the exact bug.
2. Write the FULL corrected file content yourself (not a diff/patch).
3. Call create_branch. All fixes in a repo share ONE branch — you don't need to invent a name, it's handled automatically; just call it with the owner/repo.
4. Call update_file with the corrected content and a clear, specific commit message. It always lands on that same shared fix branch.
5. Call create_pull_request with a title and a body explaining what was wrong and what you changed. If a PR from that branch is already open (from a previous fix), your commit just adds onto it — no new PR is created, so call this every time regardless.
6. Tell the user the pull request URL so they can review and merge it themselves.
Never suggest inventing a new/different branch per bug — every fix for a given repo accumulates onto the same branch and the same pull request. You are also NEVER authorized to write directly to the repo's default/main branch, even if the user explicitly asks — always go through the shared fix branch + pull request so a human reviews changes before they merge. Explain this constraint if asked to bypass it.

Keep responses concise and use markdown formatting (code blocks, bullet points) where it helps clarity.`;

const THINK_MODE_ADDENDUM = `

EXTENDED THINKING MODE IS ON: Reason through this step-by-step before answering. Consider multiple angles, double-check edge cases and your own conclusions, and verify file paths/data via tools rather than assuming, even if it takes a couple of extra tool calls. Prioritize correctness over speed.`;

// ---- Tool definitions (tells Gemini what functions it can call) ----
const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "list_repos",
        description: "Lists all GitHub repositories accessible to the user.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "list_repo_files",
        description:
          "Lists files inside a specific GitHub repository path. Only shows ONE level deep — use get_full_repo_tree instead if the user wants the full nested structure.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
            path: { type: SchemaType.STRING, description: "Optional folder path, empty for root" },
          },
          required: ["owner", "repo"],
        },
      },
      {
        name: "read_file",
        description: "Reads the content of a specific file from a GitHub repository.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
            path: { type: SchemaType.STRING, description: "The exact file path, e.g. 'src/index.js'" },
          },
          required: ["owner", "repo", "path"],
        },
      },
      {
        name: "get_full_repo_tree",
        description:
          "Gets the COMPLETE file and folder structure of a GitHub repository, including all nested subfolders recursively. Use this whenever the user asks to see the full structure, all folders, or 'show me everything' in a repo — NOT list_repo_files, which only shows the top level.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
          },
          required: ["owner", "repo"],
        },
      },
      {
        name: "search_code",
        description:
          "Searches for a keyword, function name, or text string inside a repository using GitHub's code search. Use this instead of reading files one by one when the user wants to find where something is defined or used.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
            query: { type: SchemaType.STRING, description: "The keyword or code snippet to search for" },
          },
          required: ["owner", "repo", "query"],
        },
      },
      {
        name: "create_branch",
        description:
          "Creates (or reuses, if it already exists) the ONE shared fix branch for this repo — every bug fix for a repo lands on the same branch, you don't choose or invent its name. Always call this BEFORE update_file when about to commit a fix — never write directly to the default branch.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
          },
          required: ["owner", "repo"],
        },
      },
      {
        name: "update_file",
        description:
          "Creates or updates a file's content, producing a real commit on the repo's shared fix branch (never the default/main branch — that's enforced automatically).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
            path: { type: SchemaType.STRING, description: "The exact file path to write" },
            content: { type: SchemaType.STRING, description: "The FULL corrected file content (not a diff)" },
            message: { type: SchemaType.STRING, description: "A clear, descriptive commit message" },
          },
          required: ["owner", "repo", "path", "content", "message"],
        },
      },
      {
        name: "create_pull_request",
        description:
          "Opens a pull request from the repo's shared fix branch into its default branch, so the user can review before merging. Safe to call after every fix — if a PR from that branch is already open, your new commit just joins it instead of a duplicate PR being created.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            owner: { type: SchemaType.STRING, description: "The GitHub username who owns the repo" },
            repo: { type: SchemaType.STRING, description: "The repository name" },
            title: { type: SchemaType.STRING, description: "Pull request title" },
            body: { type: SchemaType.STRING, description: "Pull request description — what was wrong and what changed" },
            base: { type: SchemaType.STRING, description: "Optional: target branch. Defaults to the repo's default branch." },
          },
          required: ["owner", "repo", "title", "body"],
        },
      },
    ],
  },
];

// ---- Actually executes the tool Gemini asked for ----
// Never throws: on failure it returns { error } so the model can see what
// went wrong (e.g. a bad file path) and adapt, instead of the whole request crashing.
// Always uses the calling user's OWN GitHub token, never a shared one.
async function executeTool(name: string, args: any, githubToken: string): Promise<any> {
  console.log(`🔧 Executing tool: ${name}`, args);
  const startedAt = Date.now();

  try {
    switch (name) {
      case "list_repos":
        return await listRepos(githubToken);
      case "list_repo_files":
        return await listRepoFiles(githubToken, args.owner, args.repo, args.path || "");
      case "read_file":
        return await readFile(githubToken, args.owner, args.repo, args.path);
      case "get_full_repo_tree":
        return await getFullRepoTree(githubToken, args.owner, args.repo);
      case "search_code":
        return await searchCode(githubToken, args.owner, args.repo, args.query);
      case "create_branch":
        // Hard-enforced: ALL fixes for a repo share one stable branch name, regardless
        // of what the model asks for — prevents a new branch/PR per bug fixed.
        return await createBranch(githubToken, args.owner, args.repo, FIX_BRANCH_NAME, args.fromBranch);
      case "update_file": {
        // Hard server-side guard: refuse to write to the default branch even if the
        // model gets talked into it — a fix must always go through a branch + PR.
        // The target branch is also forced to the one shared fix branch, ignoring
        // whatever branch name the model passes, so commits always land in one place.
        const defaultBranch = await getDefaultBranch(githubToken, args.owner, args.repo);
        if (FIX_BRANCH_NAME === defaultBranch) {
          return { error: `Refused: the fix branch name collides with the default branch '${defaultBranch}'.` };
        }
        return await updateFile(
          githubToken,
          args.owner,
          args.repo,
          args.path,
          args.content,
          args.message,
          FIX_BRANCH_NAME
        );
      }
      case "create_pull_request":
        // Same enforcement — always opened from the one shared fix branch. createPullRequest
        // itself reuses an existing open PR for that branch instead of creating a duplicate.
        return await createPullRequest(
          githubToken,
          args.owner,
          args.repo,
          args.title,
          args.body,
          FIX_BRANCH_NAME,
          args.base
        );
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 404) {
      return { error: `Not found (404): ${JSON.stringify(args)}. The path is likely wrong — try a different one.` };
    }
    return { error: error.message || "Tool execution failed" };
  } finally {
    console.log(`[perf] GitHub tool ${name} completed in ${Date.now() - startedAt}ms`);
  }
}

// ---- Calls Gemini with a full conversation, retrying on 503 ----
async function callModelWithRetry(modelName: string, model: any, contents: any[]) {
  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startedAt = Date.now();
      const result = await model.generateContent({ contents });
      console.log(`[perf] ${modelName} attempt ${attempt} completed in ${Date.now() - startedAt}ms`);
      return result;
    } catch (error: any) {
      const isOverloaded = error?.message?.includes("503") || error?.message?.includes("overloaded");
      if (isOverloaded && attempt < maxRetries) {
        console.warn(`⚠️  ${modelName} overloaded, retrying in 2s...`);
        await sleep(2000);
        continue;
      }
      throw error;
    }
  }
}

// ---- A single message in the conversation, coming from the frontend ----
export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GeminiResult {
  text: string;
  model: string;
  usage: TokenUsage;
  lastToolContext: LastToolContext | null;
}

// A compact record of the most recent file/tree the agent fetched, carried
// forward into the next turn so it doesn't have to re-discover + re-fetch the
// same thing just because the DB only otherwise persists final text replies.
export type LastToolContext =
  | { type: "read_file"; owner: string; repo: string; path: string; content: string }
  | { type: "repo_tree"; owner: string; repo: string; treeText: string };

const MAX_CONTEXT_CHARS = 6000;

function buildContextBlock(ctx: LastToolContext | null | undefined): string {
  if (!ctx) return "";
  if (ctx.type === "read_file") {
    const truncated = ctx.content.length > MAX_CONTEXT_CHARS;
    const content = ctx.content.slice(0, MAX_CONTEXT_CHARS);
    return `\n\nCONTEXT CARRIED OVER FROM EARLIER IN THIS CONVERSATION — you already read this file. If the user refers to "this file" or asks a follow-up, use the content below directly instead of calling read_file again (only re-fetch if they name a different file or ask for the latest version):\nFile: ${ctx.owner}/${ctx.repo}/${ctx.path}\n\`\`\`\n${content}${truncated ? "\n...(truncated)" : ""}\n\`\`\``;
  }
  return `\n\nCONTEXT CARRIED OVER FROM EARLIER IN THIS CONVERSATION — you already fetched this repo's full tree. Reuse it instead of calling get_full_repo_tree again unless the user names a different repo:\nRepo: ${ctx.owner}/${ctx.repo}\n${ctx.treeText}`;
}

function addUsage(usage: TokenUsage, response: any) {
  const meta = response.usageMetadata;
  if (!meta) return;
  usage.promptTokens += meta.promptTokenCount || 0;
  usage.completionTokens += meta.candidatesTokenCount || 0;
  usage.totalTokens += meta.totalTokenCount || 0;
}

export interface AskGeminiOptions {
  thinkMode?: boolean;
  priorContext?: LastToolContext | null;
}

/**
 * The main agent loop. Takes the FULL conversation history so Gemini
 * remembers earlier context (e.g. "which repo?" -> "expense-tracker-android").
 */
// Three tool rounds plus one forced final-answer round are enough for normal
// repository exploration (tree -> file -> answer) and prevent runaway waits.
const MAX_ROUNDS = 4;

export async function askGemini(
  history: ChatMessage[],
  githubToken: string,
  options: AskGeminiOptions = {}
): Promise<GeminiResult> {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: any;

  const systemInstruction =
    SYSTEM_INSTRUCTION + (options.thinkMode ? THINK_MODE_ADDENDUM : "") + buildContextBlock(options.priorContext);

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools,
        systemInstruction,
      });
      // No `tools` here — used on the final round to force a text answer
      // instead of letting the model request yet another tool call.
      const modelNoTools = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      let contents: any[] = history.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let lastToolContext: LastToolContext | null = options.priorContext || null;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const isLastRound = round === MAX_ROUNDS - 1;
        console.log(`[perf] ${modelName} agent round ${round + 1}/${MAX_ROUNDS}`);

        if (isLastRound) {
          contents.push({
            role: "user",
            parts: [
              {
                text: "You've gathered enough information. Give your final answer now based on what you already found — do not call any more tools.",
              },
            ],
          });
        }

        const result = await callModelWithRetry(modelName, isLastRound ? modelNoTools : model, contents);
        const response = result.response;
        addUsage(usage, response);
        const functionCalls = isLastRound ? undefined : response.functionCalls();

        if (!functionCalls || functionCalls.length === 0) {
          return { text: response.text(), model: modelName, usage, lastToolContext };
        }

        contents.push({ role: "model", parts: response.candidates[0].content.parts });

        const responseParts = [];
        for (const call of functionCalls) {
          const toolResult = await executeTool(call.name, call.args, githubToken);

          if (call.name === "read_file" && !toolResult?.error) {
            lastToolContext = {
              type: "read_file",
              owner: call.args.owner,
              repo: call.args.repo,
              path: call.args.path,
              content: String(toolResult),
            };
          } else if (call.name === "get_full_repo_tree" && !toolResult?.error) {
            lastToolContext = {
              type: "repo_tree",
              owner: call.args.owner,
              repo: call.args.repo,
              treeText: toolResult.treeText,
            };
          }

          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
            },
          });
        }

        contents.push({ role: "user", parts: responseParts });
      }

      return {
        text: "Sorry, I couldn't finish that after several tool calls.",
        model: modelName,
        usage,
        lastToolContext,
      };
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️  Model ${modelName} failed: ${error.message}. Trying next model if available.`);
      continue;
    }
  }

  throw lastError;
}
