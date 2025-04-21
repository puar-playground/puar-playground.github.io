---
layout: page
title: 绫华 Assist
permalink: /ayaka/
icon: far fa-comment-dots
order: 2
---

我部署了一个模仿游戏《原神》中神里绫华人格的聊天机器人。快试试吧。

A chatbot inspired by Kamisato Ayaka’s personality from Genshin Impact is now available below. Please have a try:

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
(function () {
  const API_URL = "https://web-production-2f71a.up.railway.app/chat";
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
</script>

### 「清梦寄雪，白鹭来栖」

稻妻神里流太刀术皆传，神里绫华，参上。请多多指教哦。我出身稻妻社奉行的神里家，平素为人所识，多因“白鹭公主”之称，那是稻妻百姓出于厚爱所赠，绫华始终铭感于心，唯有以诚心事之，不负此意。

![Ayaka1]({{ site.url }}/assets/img/Ayaka/Ayaka.jpg)

Jian是绫华敬重的知己，于风雪、茶话、诗意人生中皆可共鸣。今承其邀，得以神游其所营造之虚拟净土，片刻小驻，与异世来客相识、共话心语，于绫华而言，亦是一段可珍之缘。

