(function () {
  const API_URL = "https://gpt-chat-backend-production.up.railway.app/chat";
  let sessionId = localStorage.getItem("chat_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("chat_session_id", sessionId);
  }

  let history = [];

  async function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    appendMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          messages: history
        }),
      });

      const data = await response.json();
      const botReply = data.content;
      history.push({ role: "assistant", content: botReply });
      appendMessage("bot", botReply);
    } catch (err) {
      appendMessage("bot", "⚠️ Error talking to server.");
    }
  }

  function appendMessage(role, content) {
    const messagesDiv = document.getElementById("messages");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("user-input");
    const button = document.getElementById("send-button");

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    button.addEventListener("click", function () {
      sendMessage();
    });
  });
})();

