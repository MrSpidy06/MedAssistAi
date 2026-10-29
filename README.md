# MedAssistAi

The project is split into a browser frontend and a FastAPI backend. The frontend runs on port 4173. The API and its local SQLite database run on port 8000.

## Run in VS Code on Windows

Open the `medassist-web` folder in VS Code. Use two integrated terminals.
The backend requires Python 3.10 or newer. If `python` is not recognized, install Python and enable **Add Python to PATH** in the installer.

### Terminal 1: backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2: frontend

```powershell
cd frontend
npm run dev
```

Open the app in a browser at **http://127.0.0.1:4173**. The backend status appears in the left sidebar. API health is available at **http://127.0.0.1:8000/api/health**, and interactive API docs are at **http://127.0.0.1:8000/docs**.

The frontend is dependency-free and uses Node's built-in server. The backend uses FastAPI and SQLite. FastAPI creates `backend/data/medassist.sqlite3` when it starts. The frontend keeps a browser-local copy as a fallback and syncs app state to the backend when it is available.

## Firebase Analytics

The frontend initializes Firebase and Google Analytics in `frontend/firebase-init.js`. It currently uses Firebase for Analytics only; patient and app data are not stored in Firebase.

## Included workflows

- Patient and clinician demo workspaces
- Patient profile, health history, reports, and prescriptions
- Blood pressure and blood sugar entry with trend charts
- Voice symptom note with browser speech input and response playback
- Retinal image, lab report, and prescription upload flows
- Medication list and exact duplicate-name check
- Appointment requests, clinician confirmation, and local JSON export

## Prototype limits

Use synthetic information only. This project does not provide real authentication, access control, encrypted health-data storage, or a production-ready database deployment. OCR, the retinal classifier, a clinical drug-interaction database, and a connected language model still need to be integrated. Upload forms save file names and dates; they do not send files to the backend or analyze them. The demo assistant does not diagnose or recommend treatment.
