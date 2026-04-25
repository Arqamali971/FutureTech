# LogSense AI Chat Project

Complete React frontend + Node.js backend project for an AI chat assistant.

## Architecture

React Frontend -> Node.js Backend -> Your AI Engine URL

Your frontend only calls the backend:

```txt
http://localhost:5000/api/chat
```

Your backend calls your AI engine from this env variable:

```txt
AI_ENGINE_URL=http://localhost:8000/analyze
```

Change this value in:

```txt
backend/.env
```

## Requirements

Install these first:

- Node.js 18 or above
- npm

## How to Run Backend

```bash
cd backend
npm install
npm run dev
```

Backend will run on:

```txt
http://localhost:5000
```

## How to Run Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on:

```txt
http://localhost:5173
```

## Where to Add Your AI Engine URL

Open:

```txt
backend/.env
```

Replace this:

```env
AI_ENGINE_URL=http://localhost:8000/analyze
```

With your own AI API URL:

```env
AI_ENGINE_URL=https://your-ai-engine-url.com/analyze
```

## Expected AI Engine Request Body

The backend sends this body to your AI engine:

```json
{
  "prompt": "user message here",
  "context": {
    "module": "cases",
    "userRole": "admin"
  }
}
```

## Expected AI Engine Response

Your AI engine should return one of these:

```json
{
  "reply": "AI response here"
}
```

or

```json
{
  "response": "AI response here"
}
```

## Slash Commands

The chat supports these commands:

```txt
/summarize
/rootcause
/critical
/patterns
/health
/help
```

Typing `/` in the input will show command suggestions.

## Files You Will Usually Edit

Frontend chat design:

```txt
frontend/src/components/ChatAssistant.jsx
frontend/src/index.css
```

Backend AI URL and API logic:

```txt
backend/.env
backend/server.js
```

## Node 16 Fix

This updated package uses Vite 4 instead of latest Vite, because latest Vite requires Node 20.19+ or 22.12+.

If you already installed dependencies before, clean old Vite first.

Windows:

```bash
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

Mac/Linux:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```
