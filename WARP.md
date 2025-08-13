# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Run the Electron application
npm start

# Run tests (currently outputs placeholder)
npm test
```

## Architecture Overview

This is an MVP Electron application for Claude Desktop Interface, designed to provide a GUI wrapper around the Claude CLI tool.

### Core Components
- **Electron Main Process** (`src/main.js`): Manages the application lifecycle and creates browser windows
- **Renderer Process** (`src/index.html`): The UI layer that users interact with
- **Claude CLI Integration** (planned): Will be bundled with the app to handle API communication

### Key Architectural Decisions
- Uses Electron for cross-platform desktop support (Windows, macOS, Linux)
- Plans to bundle Claude CLI internally to avoid separate installation requirements
- Will implement secure storage for API keys using OS-level keychain APIs
- Local conversation storage using encrypted JSON or SQLite

## Project Structure

```
AICode/
├── src/                  # Electron application source
│   ├── main.js          # Main process entry point
│   └── index.html       # Renderer process UI
├── docs/
│   └── PRD.md           # Product Requirements Document
├── package.json         # Node.js project configuration
├── README.md            # Basic project overview
└── WARP.md             # This file
```

## Planned Features (from PRD)

### Chat Interface
- Multi-threaded conversations with concurrent chat windows
- Thread management in sidebar (rename, delete)
- Sub-agent spawning within threads
- Model selector with dynamically fetched Claude models

### Claude Code Integration
- Optional "Code Mode" per thread
- File tree browser for local files/folders
- Send file contents or diffs to Claude
- Save Claude's suggestions back to disk (with confirmation)

## Claude Code Architecture Details

### What is Claude Code
Claude Code is Anthropic's agentic coding tool that:
- Lives in the terminal and integrates with existing developer workflows
- Can directly edit files, run commands, and create commits
- Supports Model Context Protocol (MCP) for extensibility
- Works with Claude Opus 4.1, Claude Sonnet 4, and Claude Haiku 3.5

### SDK Integration
The application will integrate Claude Code SDK (available in TypeScript and Python):
- **Primary Interface**: `query` function for streaming responses
- **Multi-turn Conversations**: Session management for context preservation
- **Custom System Prompts**: Define agent roles and behaviors
- **Tool Control**: Fine-grained permissions for file operations, bash commands, etc.

#### TypeScript SDK Usage
```typescript
import { query } from "@anthropic-ai/claude-code";

// Basic query with options
for await (const message of query({
  prompt: "Analyze this code",
  abortController: new AbortController(),
  options: {
    maxTurns: 5,
    systemPrompt: "You are a code review expert",
    appendSystemPrompt: "Focus on security issues",
    allowedTools: ["Bash", "Read", "WebSearch"],
    disallowedTools: ["Write", "Edit"],
    outputFormat: "json", // "text" | "json" | "stream-json"
    inputFormat: "text", // "text" | "stream-json"
    continueSession: true,
    resumeSessionId: "abc123",
    permissionMode: "acceptEdits",
    mcpServers: {
      github: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_TOKEN: "token" }
      }
    }
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

#### Python SDK Usage
```python
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions

async with ClaudeSDKClient(
    options=ClaudeCodeOptions(
        system_prompt="You are a security engineer",
        append_system_prompt="Focus on OWASP top 10",
        max_turns=3,
        allowed_tools=["Read", "Grep", "WebSearch"],
        disallowed_tools=["Bash"],
        permission_mode="ask",
        resume="session-id-here",
        continue_conversation=True
    )
) as client:
    await client.query("Audit this application")
    async for message in client.receive_response():
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    print(block.text, end='', flush=True)
```

#### SDK Configuration Options
| Option | Type | Description | Default |
|--------|------|-------------|----------|
| `maxTurns` | number | Maximum agent iterations | 5 |
| `systemPrompt` | string | Replace default system prompt | - |
| `appendSystemPrompt` | string | Append to default prompt | - |
| `allowedTools` | string[] | Whitelist specific tools | All tools |
| `disallowedTools` | string[] | Blacklist specific tools | None |
| `outputFormat` | string | Response format | "text" |
| `inputFormat` | string | Input format | "text" |
| `continueSession` | boolean | Continue most recent | false |
| `resumeSessionId` | string | Resume specific session | - |
| `permissionMode` | string | Permission handling | "ask" |
| `verbose` | boolean | Enable verbose logging | false |
| `cwd` | string | Working directory | process.cwd() |
| `executable` | string | Runtime to use | "node" |
| `pathToClaudeCode` | string | Claude Code executable path | Auto-detected |

### Sub-agents Architecture
Claude Code supports specialized sub-agents for specific tasks:
- **Storage**: `.claude/agents/` (project) and `~/.claude/agents/` (user)
- **Configuration**: Markdown files with YAML frontmatter
- **Key Features**:
  - Separate context windows per sub-agent
  - Task-specific tool permissions
  - Automatic delegation based on task description
  - Examples: code-reviewer, debugger, test-runner

### Hooks System
Hooks allow customization of Claude Code behavior:
- **Events**: PreToolUse, PostToolUse, Notification, Stop, SessionStart
- **Configuration**: JSON in `.claude/settings.json`
- **Use Cases**:
  - Automatic code formatting after edits
  - Command validation and security checks
  - Custom notifications
  - File protection rules

#### Hook Configuration Example
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "validate-command.sh",
        "timeout": 30
      }]
    }],
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "prettier --write $CLAUDE_PROJECT_DIR"
      }]
    }]
  }
}
```

### Message Schema
The SDK uses typed messages for communication:

#### System Messages
```typescript
interface SystemMessage {
  type: "system";
  subtype: "init" | "update" | "error";
  session_id?: string;
  model?: {
    id: string;
    display_name: string;
  };
}
```

#### Result Messages
```typescript
interface ResultMessage {
  type: "result";
  result: string;
  total_cost_usd?: number;
  duration_ms?: number;
  session_id: string;
}
```

#### Content Messages
```typescript
interface ContentMessage {
  type: "content";
  content: Array<{
    type: "text";
    text: string;
  }>;
}
```

### MCP (Model Context Protocol) Integration
MCP servers extend Claude Code's capabilities:

#### MCP Server Configuration
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DB_CONNECTION_STRING": "${DATABASE_URL}"
      }
    }
  }
}
```

#### Available MCP Tools
- `mcp__github__*`: GitHub operations (issues, PRs, repos)
- `mcp__slack__*`: Slack messaging and channel management
- `mcp__filesystem__*`: Advanced file operations
- `mcp__memory__*`: Persistent memory storage
- `mcp__postgres__*`: Database queries and operations

### Memory Management
Hierarchical memory system for persistent context:
1. **Enterprise Policy**: `/Library/Application Support/ClaudeCode/CLAUDE.md`
2. **Project Memory**: `./CLAUDE.md` (shared via source control)
3. **User Memory**: `~/.claude/CLAUDE.md` (personal preferences)
4. **Imports**: Support for `@path/to/file` syntax

### Data & Security
- Encrypted local storage for conversations
- Secure API key storage using OS keychain
- Telemetry with opt-out option
- Auto-update mechanism

## Current Implementation State

The project is in its initial scaffold phase:
- Basic Electron window setup with "Hello Claude!" placeholder
- No Claude CLI integration yet
- No UI framework or state management implemented
- No conversation storage or API communication

## Key Technical Considerations

### CLI Bundling Strategy
The app needs to package the Claude CLI within the Electron bundle. Consider:
- Platform-specific CLI binaries
- Extraction and execution permissions
- Update mechanism for CLI version changes

### Frontend Stack (To Be Decided)
PRD suggests React or Vue with lightweight component libraries:
- State management: Redux/Context (React) or Pinia/Vuex (Vue)
- UI components: Tailwind CSS or Material-UI

### Storage Implementation
- SQLite for conversation history
- OS keychain APIs for secure credential storage
- Encrypted file storage as fallback

### Cross-Platform Packaging
- Windows: `.exe` installer
- macOS: `.dmg` package
- Linux: `.AppImage` or `.deb`/`.rpm`

## References

- [Product Requirements Document](docs/PRD.md) - Detailed feature specifications and requirements
- [Electron Documentation](https://www.electronjs.org/docs/latest/) - Official Electron framework docs
