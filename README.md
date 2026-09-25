# 🌌 SAMRAT AETHERMIND V3

[![Deployment - Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel&logoColor=white)](https://samrat-aethermind-v3.vercel.app)
[![Deployment - Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)](https://samrat-aethermind-v3.onrender.com)
[![Framework - Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Backend - FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License - MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**SAMRAT AETHERMIND V3** is a multi-modal AI platform featuring real-time voice synthesis, multi-model AI routing (Gemini, OpenAI, Anthropic, DeepSeek), document analysis (RAG), creative image editing, biometrics, and Google OAuth 2.0.

---

## 🌐 Live Production Deployments

- 🎨 **Production Frontend (Vercel)**: [https://samrat-aethermind-v3.vercel.app](https://samrat-aethermind-v3.vercel.app)
- ⚡ **Production Backend API (Render)**: [https://samrat-aethermind-v3.onrender.com](https://samrat-aethermind-v3.onrender.com)
- 📖 **Interactive API Documentation (Swagger)**: [https://samrat-aethermind-v3.onrender.com/docs](https://samrat-aethermind-v3.onrender.com/docs)
- 🏥 **Backend Health Check**: [https://samrat-aethermind-v3.onrender.com/health](https://samrat-aethermind-v3.onrender.com/health)

---

## ✨ Key Features

- 🤖 **Multi-Engine AI Routing**: Dynamically switch between Google Gemini, OpenAI GPT-4, Anthropic Claude, and DeepSeek.
- 🎙️ **Real-Time Voice Assistant ("Echo")**: Includes interactive canvas voice visualizers (Vortex Visualizer), speech recognition, and low-latency speech synthesis.
- 📄 **RAG Document Chat**: Upload PDF documents, automatically parse text embeddings, and perform question-answering with citation context.
- 🎨 **Image Editing & Generation Studio**: Multi-modal image generation and canvas manipulation powered by AI models.
- 🔐 **Multi-Authentication System**:
  - **Google OAuth 2.0** integration.
  - **WebAuthn Biometric Auth** (Fingerprint & Face ID hardware support).
  - JWT session token management with bcrypt password hashing.
- 🌙 **Modern Cyberpunk & Dark Mode UI**: Built with Next.js Turbopack, Tailwind CSS, Lucide icons, glassmorphism aesthetics, and customizable themes.

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: Next.js 16 (App Router with Turbopack)
- **Language**: TypeScript / React 19
- **State Management**: Zustand
- **Styling**: Tailwind CSS & Glassmorphic Utilities
- **Icons**: Lucide React
- **Deployment**: Vercel

### **Backend**
- **Framework**: FastAPI (Python 3.11+)
- **ORM & Database**: SQLAlchemy (PostgreSQL / SQLite fallback)
- **Task Queue & Broker**: Celery + Redis
- **NLP & Embeddings**: spaCy (`en_core_web_sm`), PyPDF
- **AI SDKs**: `google-generativeai`, `openai`, `anthropic`, `cohere`
- **Deployment**: Render

---

## 📂 Repository Architecture

```
SAMRAT_AETHERMIND_V3/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST endpoints (auth, chat, doc_chat, image_edit, profile)
│   │   ├── core/            # Security, JWT tokens, AI routing engines
│   │   ├── db/              # SQLAlchemy models & database connectors
│   │   ├── services/        # AI Service Integrations (Gemini, OpenAI, Anthropic, DeepSeek)
│   │   ├── tasks/           # Celery async worker definitions
│   │   ├── config.py        # Environment settings & Pydantic config
│   │   └── main.py          # FastAPI initialization & middleware
│   ├── .env                 # Local backend environment variables
│   ├── render.yaml          # Render Blueprint configuration
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # UI components (Voice visualizers, Image Studio, RAG Chat)
│   │   ├── context/         # AuthContext provider
│   │   ├── hooks/           # Voice & WebSpeech hooks
│   │   ├── services/        # Axios/Fetch API client
│   │   └── store/           # Zustand state store
│   ├── .env.local           # Frontend environment variables
│   ├── package.json         # Node.json scripts & dependencies
│   └── vercel.json          # Vercel deployment configuration
├── LICENSE                  # MIT License
├── vercel.json              # Root Vercel build configuration
└── README.md                # Project documentation
```

---

## ⚙️ Environment Variables

### **Backend Environment (`backend/.env`)**
```env
DATABASE_URL=sqlite:///aetherchat.db
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=super-secret-development-key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### **Frontend Environment (`frontend/.env.local`)**
```env
NEXT_PUBLIC_API_URL=https://samrat-aethermind-v3.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## 🚀 Local Quickstart

### 1. Clone the repository
```bash
git clone https://github.com/KAVATIJOHNSHREYAN/SAMRAT-AETHERMIND-V3.git
cd SAMRAT-AETHERMIND-V3
```

### 2. Launch the Backend
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload --port 8000
```

### 3. Launch the Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

Developed by **KAVATI JOHN SHREYAN**
