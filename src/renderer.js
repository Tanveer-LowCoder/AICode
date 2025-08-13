const appendMessage = (sender, text) => {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = text;

  messageDiv.appendChild(bubble);
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

document.getElementById('message-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;

  appendMessage('user', text);
  input.value = '';
  input.focus();

  // For now, simply echo back the user's message as a placeholder.
  setTimeout(() => {
    appendMessage('bot', `You said: ${text}`);
  }, 500);
});
