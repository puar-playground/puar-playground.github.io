---
layout: page
title: 绫华 Assist
permalink: /chat/
icon: far fa-comment-dots
order: 2
---

![Ayaka1]({{ site.url }}/assets/img/Ayaka/Ayaka.jpg)

<style>
#chat-container {
  max-width: 1000px;
  margin: 2em auto;
  border-radius: 10px;
  padding: 1em;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 8px rgba(0,0,0,0.03);
  font-family: var(--font-family-sans);
}

#messages {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1em;
}

.message {
  margin-bottom: 1em;
  padding: 0.7em 1em;
  border-radius: 10px;
  white-space: pre-wrap;
  line-height: 1.5;
  word-break: break-word;
}

.message.user {
  background-color: var(--highlight-bg);
  color: var(--text-color);
  text-align: right;
}

.message.bot {
  background-color: var(--body-bg);
  color: var(--text-color);
  text-align: left;
}

#input-area {
  display: flex;
  gap: 0.5em;
}

#user-input {
  flex: 1;
  padding: 0.6em;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  font-size: 1em;
  background-color: var(--input-bg);
  color: var(--text-color);
}

#send-button {
  padding: 0.6em 1.2em;
  border: none;
  background-color: var(--btn-bg);
  color: var(--btn-color);
  border-radius: 6px;
  cursor: pointer;
}

#send-button:hover {
  background-color: var(--btn-hover-bg);
}
</style>

<div id="chat-container">
  <div id="messages"></div>
  <div id="input-area">
    <input id="user-input" placeholder="Type your message..." />
    <button id="send-button">Send</button>
  </div>
</div>

<script>
document.addEventListener("DOMContentLoaded", function () {
  const API_URL = "https://web-production-2f71a.up.railway.app/chat";

  // Generate session ID
  let sessionId = localStorage.getItem("chat_session_id");
  if (!sessionId) {
    try {
      sessionId = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
        return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
      });
    } catch (e) {
      sessionId = Math.random().toString(36).substr(2, 9);
    }
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

  // Bind both Enter and Click events
  const input = document.getElementById("user-input");
  const button = document.getElementById("send-button");

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  button.addEventListener("click", function () {
    sendMessage();
  });
});
</script>