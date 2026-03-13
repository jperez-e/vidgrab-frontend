# VidGrab

Aplicación web para descargar videos de redes sociales (MP4 con audio).  
Frontend en GitHub Pages y backend en Render (free tier).

## Estructura

- `frontend/` HTML + CSS + JS
- `backend/` FastAPI + yt-dlp + SSE

## Deploy del Frontend (GitHub Pages)

1. Crea el repo `vidgrab-frontend` en GitHub.
2. Copia todo el contenido de `frontend/` al repo.
3. En GitHub: Settings → Pages → Deploy from branch → `main` / `/root`.
4. Actualiza `API_BASE` en [app.js](./frontend/app.js) con la URL real del backend.
5. Abre `https://USER.github.io/vidgrab-frontend/`.

## Deploy del Backend (Render)

1. Crea el repo `vidgrab-backend` en GitHub.
2. Copia todo el contenido de `backend/` al repo.
3. En Render: New → Web Service → conecta el repo.
4. Render detecta `render.yaml` y aplica la configuración.
5. El servicio se expone como `https://vidgrab-api.onrender.com` (o similar).
6. En [main.py](./backend/main.py) reemplaza `https://USER.github.io` con tu dominio real de GitHub Pages.

## Desarrollo local

Frontend:

```bash
cd frontend
python -m http.server 5500
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Actualiza `API_BASE` a `http://localhost:8000`.

## Notas técnicas

- El free tier de Render duerme tras 15 minutos sin tráfico.
- El frontend hace un ping al cargar y muestra un banner si el servidor tarda.
- Descargas limitadas a 5 simultáneas para proteger el free tier.
- Instagram y Threads: solo contenido público.
