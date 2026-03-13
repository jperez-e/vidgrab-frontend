const API_BASE = "https://vidgrab-backend-b0nv.onrender.com";

const urlInput = document.getElementById("urlInput");
const clearInput = document.getElementById("clearInput");
const analyzeButton = document.getElementById("analyzeButton");
const previewSection = document.getElementById("previewSection");
const progressSection = document.getElementById("progressSection");
const videoThumbnail = document.getElementById("videoThumbnail");
const videoTitle = document.getElementById("videoTitle");
const videoDuration = document.getElementById("videoDuration");
const platformBadge = document.getElementById("platformBadge");
const qualityTabs = document.getElementById("qualityTabs");
const downloadButton = document.getElementById("downloadButton");
const downloadAudioButton = document.getElementById("downloadAudioButton");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");
const progressStatus = document.getElementById("progressStatus");
const progressFilename = document.getElementById("progressFilename");
const cancelButton = document.getElementById("cancelButton");
const historyButton = document.getElementById("historyButton");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const closeHistory = document.getElementById("closeHistory");
const clearHistory = document.getElementById("clearHistory");
const toast = document.getElementById("toast");
const wakeBanner = document.getElementById("wakeBanner");
const thumbSkeleton = document.getElementById("thumbSkeleton");
const titleSkeleton = document.getElementById("titleSkeleton");

const QUALITIES = ["360p", "720p", "1080p", "2160p"];
let currentInfo = null;
let selectedQuality = "720p";
let progressStream = null;
let activeJobId = null;

const PLATFORM_COLORS = {
  TikTok: "#22d3ee",
  Instagram: "#f97316",
  "Twitter / X": "#60a5fa",
  Facebook: "#3b82f6",
  Threads: "#e2e8f0",
};

const formatDuration = (seconds) => {
  if (!seconds || Number.isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const showToast = (message, isError = false) => {
  toast.textContent = message;
  toast.style.border = isError ? "1px solid rgba(239, 68, 68, 0.6)" : "none";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
};

const setLoadingPreview = (loading) => {
  if (loading) {
    previewSection.classList.remove("hidden");
    videoThumbnail.style.display = "none";
    videoTitle.textContent = "";
    thumbSkeleton.classList.add("shimmer");
    titleSkeleton.classList.add("shimmer");
    thumbSkeleton.style.display = "block";
    titleSkeleton.style.display = "block";
  } else {
    thumbSkeleton.classList.remove("shimmer");
    titleSkeleton.classList.remove("shimmer");
    videoThumbnail.style.display = "block";
    thumbSkeleton.style.display = "none";
    titleSkeleton.style.display = "none";
  }
};

const renderQualities = (available) => {
  if (!available || !available.length) {
    available = ["360p"];
  }
  if (!available.includes(selectedQuality)) {
    selectedQuality = available[0];
  }
  qualityTabs.innerHTML = "";
  QUALITIES.forEach((quality) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "quality-pill";
    pill.textContent = quality === "2160p" ? "4K" : quality;
    if (!available.includes(quality)) {
      pill.classList.add("disabled");
      pill.disabled = true;
    }
    if (quality === selectedQuality) {
      pill.classList.add("active");
    }
    pill.addEventListener("click", () => {
      selectedQuality = quality;
      renderQualities(available);
    });
    qualityTabs.appendChild(pill);
  });
};

const renderHistory = () => {
  const items = JSON.parse(localStorage.getItem("vidgrab_history") || "[]");
  historyList.innerHTML = "";
  if (!items.length) {
    historyList.innerHTML = "<div class='history-meta'>Sin descargas aún.</div>";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "history-item";
    card.innerHTML = `
      <img src="${item.thumbnail}" alt="${item.title}" />
      <div>
        <div class="history-title">${item.title}</div>
        <div class="history-meta">${item.platform} · ${item.quality} · ${item.date}</div>
      </div>
    `;
    historyList.appendChild(card);
  });
};

const pushHistory = (info, quality) => {
  const items = JSON.parse(localStorage.getItem("vidgrab_history") || "[]");
  items.unshift({
    title: info.title,
    thumbnail: info.thumbnail,
    platform: info.platform,
    quality,
    date: new Date().toLocaleString("es-ES"),
  });
  const trimmed = items.slice(0, 20);
  localStorage.setItem("vidgrab_history", JSON.stringify(trimmed));
  renderHistory();
};

const updateProgress = (percent, status) => {
  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${Math.floor(percent)}%`;
  progressStatus.textContent = status;
};

const startProgressStream = (jobId, onDone) => {
  if (progressStream) {
    progressStream.close();
  }
  progressStream = new EventSource(`${API_BASE}/progress/${jobId}`);
  progressStream.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (String(data.status).startsWith("error")) {
      updateProgress(0, "Error en la descarga.");
      showToast(data.status, true);
      progressStream.close();
      return;
    }
    if (data.status === "done") {
      updateProgress(100, "¡Listo!");
      progressStream.close();
      if (onDone) onDone();
      return;
    }
    updateProgress(data.percent, data.status);
  };
  progressStream.addEventListener("done", () => {
    progressStream.close();
    if (onDone) onDone();
  });
  progressStream.onerror = () => {
    showToast("Error en el progreso. Intenta de nuevo.", true);
    progressStream.close();
  };
};

const downloadFile = async (jobId) => {
  const response = await fetch(`${API_BASE}/file/${jobId}`);
  if (!response.ok) {
    throw new Error("No se pudo descargar el archivo.");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = progressFilename.textContent || "archivo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const fetchInfo = async () => {
  const url = urlInput.value.trim();
  if (!url) {
    showToast("Ingresa un enlace válido.", true);
    return;
  }
  setLoadingPreview(true);
  previewSection.classList.remove("hidden");
  try {
    const response = await fetch(`${API_BASE}/info?url=${encodeURIComponent(url)}`);
    if (response.status === 503 || response.status === 504) {
      showToast("Despertando servidor, espera ~30s...", true);
      previewSection.classList.add("hidden");
      return;
    }
    if (!response.ok) {
      const detail = await response.json();
      throw new Error(detail.detail || "No se pudo analizar el enlace.");
    }
    const info = await response.json();
    currentInfo = info;
    videoTitle.textContent = info.title;
    videoThumbnail.src = info.thumbnail;
    videoDuration.textContent = formatDuration(info.duration);
    platformBadge.textContent = info.platform;
    platformBadge.style.background = `${PLATFORM_COLORS[info.platform] || "#334155"}33`;
    renderQualities(info.formats);
    setLoadingPreview(false);
  } catch (error) {
    showToast(error.message, true);
    previewSection.classList.add("hidden");
  }
};

const startDownload = async (mode) => {
  if (!currentInfo) {
    showToast("Primero analiza un enlace.", true);
    return;
  }
  const quality = mode === "mp3" ? "mp3" : selectedQuality;
  const label = mode === "mp3" ? "MP3" : selectedQuality;
  const confirmText =
    mode === "mp3"
      ? "¿Quieres descargar solo el audio en MP3?"
      : `¿Quieres descargar el video en ${selectedQuality}?`;
  if (!window.confirm(confirmText)) return;

  progressSection.classList.remove("hidden");
  updateProgress(0, "Preparando descarga...");
  try {
    const response = await fetch(`${API_BASE}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.value.trim(), quality }),
    });
    if (response.status === 503 || response.status === 504) {
      showToast("Despertando servidor, espera ~30s...", true);
      return;
    }
    if (!response.ok) {
      const detail = await response.json();
      throw new Error(detail.detail || "No se pudo iniciar la descarga.");
    }
    const data = await response.json();
    activeJobId = data.job_id;
    progressFilename.textContent = data.filename;
    startProgressStream(activeJobId, async () => {
      await downloadFile(activeJobId);
      pushHistory(currentInfo, label);
      updateProgress(100, "¡Listo!");
    });
  } catch (error) {
    showToast(error.message, true);
  }
};

const wakeUpServer = async () => {
  let timeoutId = null;
  try {
    timeoutId = setTimeout(() => {
      wakeBanner.classList.remove("hidden");
    }, 3000);
    await fetch(`${API_BASE}/`);
  } catch (error) {
    wakeBanner.classList.remove("hidden");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    setTimeout(() => wakeBanner.classList.add("hidden"), 5000);
  }
};

clearInput.addEventListener("click", () => {
  urlInput.value = "";
  urlInput.focus();
});

analyzeButton.addEventListener("click", fetchInfo);
downloadButton.addEventListener("click", () => startDownload("mp4"));
downloadAudioButton.addEventListener("click", () => startDownload("mp3"));
cancelButton.addEventListener("click", () => {
  if (progressStream) {
    progressStream.close();
  }
  progressSection.classList.add("hidden");
});
historyButton.addEventListener("click", () => historyPanel.classList.add("open"));
closeHistory.addEventListener("click", () => historyPanel.classList.remove("open"));
clearHistory.addEventListener("click", () => {
  localStorage.removeItem("vidgrab_history");
  renderHistory();
});

window.addEventListener("load", () => {
  renderHistory();
  wakeUpServer();
});
