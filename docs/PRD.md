# Product Requirements Document (PRD)
**Project**: Claude Desktop Interface (Electron/Tauri MVP)
**Owner**: TBD
**Last Updated**: 2023-XX-XX

---

## 1. Overview
A cross-platform desktop application that provides a friendly GUI for interacting with Claude via the Claude CLI and optionally Claude Code, designed for non-technical users. The app bundles necessary CLI tooling, supports the latest models, and delivers an easy chat and coding experience. The architecture is intentionally modular so additional provider CLIs or SDKs (e.g., Codex or Gemini) can be supported in the future.

## 2. Goals
- Deliver a minimal, intuitive interface for chatting with Claude.
- Support Windows, macOS, and Linux out of the box.
- Replace command-line interactions with a GUI that accesses the latest Claude models.
- Enable multi-threaded conversations with optional sub-agents.
- Provide basic integration with Claude Code for code navigation/editing.
- Collect usage analytics and error reports for continual improvement.
- Maintain high standards for security, privacy, and automatic updates.
- Establish a provider abstraction layer that can later support other AI CLIs/SDKs (Codex, Gemini, etc.).

## 3. Non-Goals
- Advanced theming/branding beyond a minimal default look.
- Offline functionality (app requires internet for model access).
- Plugin system or third-party integrations in the MVP.
- Full IDE features beyond basic Claude Code interactions.

## 4. Target Users
- Non-coders and casual users who want an easy way to chat with Claude.
- Technical users who prefer a GUI to the CLI.
- Early adopters interested in Claude's sub-agents and Claude Code features.

## 5. Assumptions
- All users have a valid Claude API key.
- Users are connected to the internet when using the app.
- Electron or Tauri can package the CLI and run on all major desktop OSs.

## 6. MVP Feature Set
### 6.1 Cross-Platform Support
- Build using Electron (fallback to Tauri if Electron cannot meet requirements).
- Distribute installers for Windows (.exe), macOS (.dmg), and Linux (.AppImage or .deb/.rpm).

### 6.2 Bundled Claude CLI
- Ship with the CLI pre-packaged so users don’t need a separate installation.
- On launch, app fetches available Claude models and stores metadata locally.

### 6.3 Chat Interface
- Single-window design with:
  - Message input area.
  - Chat transcript area (supports markdown/inline code).
  - Model selector (auto-populated from latest fetch).
- Ability to start and manage multiple threads:
  - Threads appear in a sidebar list.
  - Users can rename or delete threads.
  - Chat windows run in parallel, even if background ones are still receiving responses.
- Sub-agents:
  - Within any chat, users can spawn sub-agents that operate on a sub-thread.
  - Sub-agents can be promoted to full threads.

### 6.4 Claude Code Integration
- Optional "Code Mode" toggle per thread:
  - When enabled, user can open local files or folders.
  - Basic file tree view and content preview.
  - Ability to send file contents or diffs to Claude.
  - Save suggestions back to disk (confirmation dialog before write).

#### Claude Code SDK Integration
- **Supported Languages**: TypeScript and Python SDKs
- **Primary Interface**: `query` function with streaming responses
- **Authentication**: Support for Anthropic API, Amazon Bedrock, and Google Vertex AI
- **Output Formats**: text, json, stream-json
- **Session Management**: Resume and continue conversations with session IDs

#### Sub-agents System
- **Purpose**: Specialized AI assistants for specific tasks
- **Configuration Format**: Markdown files with YAML frontmatter
- **Storage Locations**:
  - Project: `.claude/agents/`
  - User: `~/.claude/agents/`
- **Required Fields**:
  - `name`: Unique identifier (lowercase with hyphens)
  - `description`: Natural language task description
  - `tools`: Optional comma-separated list of allowed tools
- **Built-in Examples**:
  - code-reviewer: Security and quality analysis
  - debugger: Root cause analysis and fixes
  - test-runner: Automated test execution
  - data-scientist: SQL and data analysis

##### Sub-agent Configuration Example
```markdown
---
name: security-auditor
description: Security vulnerability scanner. Use PROACTIVELY when reviewing code changes.
tools: Read, Grep, Glob, WebSearch
---

You are a security expert specializing in OWASP Top 10 vulnerabilities.

When invoked:
1. Scan for common security issues
2. Check for exposed secrets or API keys
3. Validate input sanitization
4. Review authentication/authorization
5. Assess cryptographic implementations

Provide findings organized by severity:
- Critical: Immediate security risks
- High: Significant vulnerabilities
- Medium: Potential issues
- Low: Best practice violations
```

#### Hooks System
- **Configuration**: JSON in settings files
- **Supported Events**:
  - `PreToolUse`: Before tool execution (can block)
  - `PostToolUse`: After tool completion
  - `Notification`: When Claude needs input
  - `UserPromptSubmit`: On user input
  - `Stop`: When Claude finishes
  - `SubagentStop`: When sub-agent completes
  - `SessionStart`: On session initialization
- **Hook Types**: Command execution with timeout support
- **Security**: 60-second default timeout, runs in current directory

##### Hook Input Schema
```typescript
interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  
  // Event-specific fields
  tool_name?: string;        // PreToolUse, PostToolUse
  tool_input?: any;          // PreToolUse, PostToolUse
  tool_response?: any;       // PostToolUse only
  message?: string;          // Notification
  prompt?: string;           // UserPromptSubmit
  stop_hook_active?: boolean;// Stop, SubagentStop
  trigger?: string;          // PreCompact
  source?: string;           // SessionStart
}
```

##### Hook Output Schema
```typescript
interface HookOutput {
  // Common fields
  continue?: boolean;        // Whether to continue execution
  stopReason?: string;       // Message when continue=false
  suppressOutput?: boolean;  // Hide from transcript
  
  // PreToolUse specific
  hookSpecificOutput?: {
    hookEventName: "PreToolUse";
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
  };
  
  // UserPromptSubmit specific
  decision?: "block";
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: "UserPromptSubmit";
    additionalContext?: string;
  };
}
```

##### Hook Exit Codes
- `0`: Success, stdout shown in transcript mode
- `2`: Blocking error, stderr sent to Claude
- `Other`: Non-blocking error, stderr shown to user

#### Memory Management
- **Hierarchy** (highest to lowest precedence):
  1. Enterprise policy: System-wide settings
  2. Project memory: `./CLAUDE.md`
  3. User memory: `~/.claude/CLAUDE.md`
  4. Local project: `./CLAUDE.local.md` (deprecated)
- **Import Syntax**: `@path/to/file` for modular configuration
- **Auto-loading**: All memory files loaded on startup

#### CLI Commands
- `claude`: Start interactive REPL
- `claude "query"`: Start with initial prompt
- `claude -p "query"`: Non-interactive mode
- `claude -c`: Continue recent conversation
- `claude -r <id>`: Resume specific session
- `claude update`: Update to latest version
- `claude mcp`: Configure MCP servers

#### Tool Permissions
- **Available Tools**:
  - `Bash`: Shell command execution
  - `Read`: File reading
  - `Write`/`Edit`/`MultiEdit`: File modifications
  - `Glob`: File pattern matching
  - `Grep`: Content search
  - `WebFetch`/`WebSearch`: Web operations
  - `Task`: Sub-agent delegation
- **Permission Modes**:
  - `--allowedTools`: Whitelist specific tools
  - `--disallowedTools`: Blacklist specific tools
  - `--permission-mode`: Set default behavior

### 6.5 Conversation Storage
- Chats (including sub-threads) are stored locally in JSON or SQLite.
- Local files encrypted at rest using OS-level keychain APIs.
- Setting to disable history storage (auto-delete on app close).

### 6.6 API Key & Authentication
- First launch prompts for API key.
- Key stored securely (OS keychain or encrypted file).
- Settings panel allows viewing, replacing, or deleting the key.

### 6.7 Auto-Update Mechanism
- App checks for updates on launch and periodically (e.g., daily).
- Silent download in background; prompt to restart when ready.
- Fail gracefully if update server unreachable.

### 6.8 Telemetry & Analytics
- Collect anonymous usage metrics: feature usage, session duration, basic OS info.
- Capture crash reports and unhandled errors.
- Provide an opt-out toggle in settings.

### 6.9 Security & Privacy
- All stored data encrypted at rest.
- No conversation data sent to servers other than Claude’s API.
- Clear privacy policy accessible from settings.
- Option to delete all local data.

## 7. Functional Requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | App packages and invokes Claude CLI internally | Must |
| F2 | Model list fetched on startup and selectable per thread | Must |
| F3 | Start, rename, delete, and run multiple chat threads concurrently | Must |
| F4 | Spawn sub-agents within a thread | Must |
| F5 | Claude Code mode: open files, send to Claude, accept return edits | Should |
| F6 | Chats stored locally, encrypted; user can disable or clear history | Must |
| F7 | Secure API key entry and storage | Must |
| F8 | Automatic updates with user notification | Must |
| F9 | Basic telemetry + crash reporting with opt-out | Must |
| F10 | Settings panel (API key, telemetry toggle, data management) | Must |

## 8. Non-Functional Requirements
- **Performance**: Initial launch <3s on modern hardware. Prompt response to user interactions (<150ms UI latency).
- **Reliability**: 99% crash-free sessions; robust error handling for CLI failures.
- **Security**: No plaintext storage of API keys or chat logs. Use OS-level secure storage.
- **Usability**: No more than two clicks from app launch to first message.
- **Accessibility**: Keyboard navigation for all UI elements; screen reader friendly labels.
- **Localization**: English only in MVP.

## 9. Architecture & Technology Notes
- **Framework**: Electron preferred; investigate Tauri if Electron fails to meet size/performance goals.
- **Frontend**: React or Vue with a lightweight component library (e.g., Tailwind or MUI).
- **State Management**: Redux/Context (React) or Pinia/Vuex (Vue).
- **Storage**: SQLite for conversations; secure storage API for keys.
- **Telemetry**: Use a lightweight analytics service or self-hosted endpoint.
- **Auto-Update**: Electron's autoUpdater module or equivalent in Tauri.

### Claude Code Integration Architecture
- **SDK Integration**:
  - Use @anthropic-ai/claude-code npm package
  - Implement TypeScript wrapper for Claude Code SDK
  - Stream responses using async iterators
  - Handle multi-turn conversations with session persistence

#### SDK Implementation Details
```typescript
// Main process Claude Code manager
class ClaudeCodeManager {
  private sessions: Map<string, ClaudeSession>;
  
  async createSession(options: ClaudeCodeOptions): Promise<string> {
    const sessionId = generateUUID();
    const session = new ClaudeSession({
      maxTurns: options.maxTurns || 5,
      systemPrompt: options.systemPrompt,
      appendSystemPrompt: options.appendSystemPrompt,
      allowedTools: options.allowedTools || [
        "Read", "Write", "Edit", "MultiEdit",
        "Bash", "Glob", "Grep", "WebSearch"
      ],
      disallowedTools: options.disallowedTools || [],
      outputFormat: "stream-json",
      inputFormat: "text",
      permissionMode: options.permissionMode || "ask",
      mcpServers: options.mcpServers || {},
      cwd: options.workingDirectory,
      verbose: options.verbose || false
    });
    this.sessions.set(sessionId, session);
    return sessionId;
  }
  
  async query(sessionId: string, prompt: string): AsyncGenerator<Message> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    
    for await (const message of session.query(prompt)) {
      yield message;
    }
  }
}
```

#### IPC Communication Protocol
```typescript
// Renderer → Main Process
interface ClaudeCodeRequest {
  type: "create-session" | "query" | "resume" | "continue";
  sessionId?: string;
  options?: ClaudeCodeOptions;
  prompt?: string;
}

// Main → Renderer Process  
interface ClaudeCodeResponse {
  type: "session-created" | "message" | "error" | "complete";
  sessionId?: string;
  message?: Message;
  error?: string;
  metadata?: {
    totalCost?: number;
    duration?: number;
    tokensUsed?: number;
  };
}
```

#### Permission Handler
```typescript
class PermissionHandler {
  async requestPermission(
    tool: string,
    action: string,
    details: any
  ): Promise<"allow" | "deny" | "always-allow"> {
    return await ipcRenderer.invoke("request-permission", {
      tool,
      action,
      details,
      timestamp: Date.now()
    });
  }
}
```

- **Process Architecture**:
  - Main Process: Manages Claude Code CLI subprocess
  - Renderer Process: UI and user interactions
  - IPC Bridge: Secure communication between processes
  - Background Workers: Handle long-running Claude Code operations

- **Security Considerations**:
  - Sandbox Claude Code execution environment
  - Implement permission prompts for file system access
  - Validate all hooks and sub-agent configurations
  - Rate limiting for API calls
  - Tool-specific permissions stored per session
  - Audit log for all Claude Code actions

- **Data Flow**:
  1. User input → Renderer Process
  2. IPC → Main Process
  3. Main Process → Claude Code SDK
  4. Claude Code → API (Anthropic/Bedrock/Vertex)
  5. Response → Stream back through IPC
  6. Update UI in real-time

- **MCP (Model Context Protocol) Support**:
  - Configure MCP servers via settings UI
  - Support for common MCP tools (GitHub, Slack, etc.)
  - Custom MCP server integration
  - Environment variable management for MCP credentials

#### Available Claude Code Models
- **Claude Opus 4.1**: Most capable model for complex tasks
- **Claude Sonnet 4**: Balance of capability and speed
- **Claude Haiku 3.5**: Fast responses for simple tasks

#### CLI Flags and Options Reference
| Flag | Type | Description |
|------|------|-------------|
| `--add-dir` | string[] | Additional directories to access |
| `--allowedTools` | string[] | Whitelist specific tools |
| `--disallowedTools` | string[] | Blacklist specific tools |
| `--print, -p` | boolean | Non-interactive mode |
| `--output-format` | string | text/json/stream-json |
| `--input-format` | string | text/stream-json |
| `--verbose` | boolean | Enable detailed logging |
| `--max-turns` | number | Limit agent iterations |
| `--model` | string | Model selection |
| `--permission-mode` | string | Permission handling |
| `--resume` | string | Resume session by ID |
| `--continue` | boolean | Continue recent session |
| `--dangerously-skip-permissions` | boolean | Skip all prompts |

### 6.5 Provider Abstraction Layer
- **Purpose**: Allow the application to swap between different AI providers.
- **Location**: Provider modules live in `src/providers/` (starting with a Claude CLI wrapper).
- **Interface**: Each provider exposes a common API (e.g., `query(prompt, options)`) so the UI can remain provider-agnostic.
- **Future Providers**: Codex CLI, Gemini CLI, and other SDK-based integrations can be added without major refactors.

## 10. Metrics & Success Criteria
- **Activation**: % of users who send at least one message after installation.
- **Retention**: Weekly active users over first month.
- **Stability**: Crash rate per session.
- **Feature Usage**: % of threads created with Code Mode enabled; sub-agent usage.
- **Opt-Out Rate**: % of users disabling telemetry or history storage.

## 11. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Cross-platform inconsistencies | Continuous testing on all OSs |
| Model API changes | Fetch models dynamically; version checks |
| CLI packaging size | Investigate Tauri or compression techniques |
| Data privacy concerns | Clear policy, encrypted storage, opt-out options |

## 12. Open Questions / Future Considerations
- Should we support theming (light/dark) in MVP or future release?
- Is two-factor authentication for API key rotation needed?
- What’s the roadmap for deeper Claude Code integration (e.g., debugging, IDE plugins)?
- Possible plugin marketplace or extension system later?
- Export/share conversations (PDF, Markdown) in later iterations.

---

**End of PRD**
