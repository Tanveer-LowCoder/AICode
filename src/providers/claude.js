const { spawn } = require('child_process');

/**
 * Minimal wrapper around the Claude CLI.
 * Future providers (e.g., Codex CLI, Gemini CLI, SDKs) should expose the same interface.
 * @param {string} prompt - Text prompt to send to the CLI.
 * @param {object} [options] - Additional CLI options such as model.
 * @returns {Promise<string>} - Resolves with the CLI response text.
 */
function queryClaude(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ['--print'];
    if (options.model) {
      args.push('--model', options.model);
    }

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'inherit'] });
    let output = '';

    proc.stdout.on('data', data => {
      output += data.toString();
    });

    proc.on('error', reject);
    proc.on('close', () => resolve(output.trim()));

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

module.exports = {
  queryClaude,
};
