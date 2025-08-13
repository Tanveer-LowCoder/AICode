// Registry for AI provider clients.
// Additional providers (e.g., Codex CLI, Gemini CLI, SDKs) can be added here.
module.exports = {
  claude: require('./claude'),
};
