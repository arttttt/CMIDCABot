/**
 * Web interface for testing the bot without Telegram
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { handleMessage, handleCallback, ServiceContext } from "../handlers/index.js";
import { Config } from "../types/index.js";

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCA Bot - Test Interface</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background: #16213e;
      padding: 1rem;
      text-align: center;
      border-bottom: 1px solid #0f3460;
    }

    header h1 {
      font-size: 1.2rem;
      color: #e94560;
    }

    header p {
      font-size: 0.8rem;
      color: #888;
      margin-top: 0.25rem;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .message {
      max-width: 80%;
      padding: 0.75rem 1rem;
      border-radius: 1rem;
      white-space: pre-wrap;
      line-height: 1.4;
    }

    .message.user {
      background: #0f3460;
      align-self: flex-end;
      border-bottom-right-radius: 0.25rem;
    }

    .message.bot {
      background: #16213e;
      align-self: flex-start;
      border-bottom-left-radius: 0.25rem;
      border: 1px solid #0f3460;
    }

    .input-container {
      padding: 1rem;
      background: #16213e;
      border-top: 1px solid #0f3460;
      display: flex;
      gap: 0.5rem;
    }

    #messageInput {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid #0f3460;
      border-radius: 1.5rem;
      background: #1a1a2e;
      color: #eee;
      font-size: 1rem;
      outline: none;
    }

    #messageInput:focus {
      border-color: #e94560;
    }

    #sendBtn {
      padding: 0.75rem 1.5rem;
      background: #e94560;
      color: white;
      border: none;
      border-radius: 1.5rem;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    #sendBtn:hover {
      background: #c73e54;
    }

    #sendBtn:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .quick-commands {
      padding: 0.5rem 1rem;
      background: #16213e;
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .quick-cmd {
      padding: 0.4rem 0.8rem;
      background: #0f3460;
      border: none;
      border-radius: 1rem;
      color: #eee;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .quick-cmd:hover {
      background: #e94560;
    }

    .inline-buttons {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .inline-btn {
      padding: 0.5rem 1rem;
      background: #0f3460;
      border: 1px solid #e94560;
      border-radius: 0.5rem;
      color: #eee;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .inline-btn:hover {
      background: #e94560;
    }

    .inline-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <header>
    <h1>DCA Bot - Test Interface</h1>
    <p>Web interface for testing without Telegram</p>
  </header>

  <div class="quick-commands">
    <button class="quick-cmd" data-cmd="/start">/start</button>
    <button class="quick-cmd" data-cmd="/help">/help</button>
    <button class="quick-cmd" data-cmd="/wallet">/wallet</button>
    <button class="quick-cmd" data-cmd="/status">/status</button>
    <button class="quick-cmd" data-cmd="/balance">/balance</button>
  </div>

  <div class="chat-container" id="chat"></div>

  <div class="input-container">
    <input type="text" id="messageInput" placeholder="Type a command (e.g., /start)" autocomplete="off">
    <button id="sendBtn">Send</button>
  </div>

  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    function addMessage(text, isUser, inlineKeyboard) {
      const div = document.createElement('div');
      div.className = 'message ' + (isUser ? 'user' : 'bot');
      div.textContent = text;

      // Add inline buttons if present
      if (inlineKeyboard && inlineKeyboard.length > 0) {
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'inline-buttons';

        for (const row of inlineKeyboard) {
          for (const button of row) {
            const btn = document.createElement('button');
            btn.className = 'inline-btn';
            btn.textContent = button.text;
            btn.dataset.callback = button.callbackData;
            btn.addEventListener('click', () => handleCallback(btn, div));
            buttonsDiv.appendChild(btn);
          }
        }

        div.appendChild(buttonsDiv);
      }

      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    async function handleCallback(btn, messageDiv) {
      const callbackData = btn.dataset.callback;

      // Disable all buttons in this message
      messageDiv.querySelectorAll('.inline-btn').forEach(b => b.disabled = true);

      try {
        const res = await fetch('/api/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callbackData })
        });
        const data = await res.json();

        // Replace message text and remove buttons
        messageDiv.textContent = data.text;
      } catch (err) {
        addMessage('Error: ' + err.message, false);
      }
    }

    async function sendMessage(text) {
      if (!text.trim()) return;

      addMessage(text, true);
      input.value = '';
      sendBtn.disabled = true;

      try {
        const res = await fetch('/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        addMessage(data.text, false, data.inlineKeyboard);
      } catch (err) {
        addMessage('Error: ' + err.message, false);
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    }

    sendBtn.addEventListener('click', () => sendMessage(input.value));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage(input.value);
    });

    document.querySelectorAll('.quick-cmd').forEach(btn => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.cmd));
    });

    input.focus();
  </script>
</body>
</html>`;

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, data: object, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

// Web user ID for testing (simulates a Telegram user ID)
const WEB_TEST_USER_ID = 999999999;

export async function startWebServer(
  config: Config,
  services: ServiceContext,
): Promise<void> {
  const port = config.web?.port ?? 3000;

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // CORS headers for local development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // API endpoint for messages
      if (url === "/api/message" && method === "POST") {
        const body = await parseBody(req);
        const { text } = JSON.parse(body);

        const response = await handleMessage(
          {
            userId: "web-user",
            telegramId: WEB_TEST_USER_ID,
            username: "Web Tester",
            text: text ?? "",
          },
          services,
        );

        sendJson(res, response);
        return;
      }

      // API endpoint for callback (inline button clicks)
      if (url === "/api/callback" && method === "POST") {
        const body = await parseBody(req);
        const { callbackData } = JSON.parse(body);

        const response = await handleCallback(
          WEB_TEST_USER_ID,
          callbackData ?? "",
          services,
        );

        sendJson(res, response);
        return;
      }

      // Health check
      if (url === "/health") {
        sendJson(res, { status: "ok" });
        return;
      }

      // Serve HTML page for root and any other path
      sendHtml(res, HTML_PAGE);
    } catch (error) {
      console.error("Web server error:", error);
      sendJson(res, { error: "Internal server error" }, 500);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Web interface running at http://localhost:${port}`);
      resolve();
    });
  });
}
