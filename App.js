(() => {
  "use strict";

  const GRID_COLUMNS = 40;
  const GRID_ROWS = 25;
  const TOTAL_PIXELS = GRID_COLUMNS * GRID_ROWS;
  const STORAGE_KEY = "origo-marketplace-phase1";

  const state = {
    pixels: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedId: null,
    editing: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startPanX: 0,
    startPanY: 0
  };

  const $ = id => document.getElementById(id);

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        state.pixels = JSON.parse(saved);
      } catch (_) {
        state.pixels = [];
      }
    }

    if (!Array.isArray(state.pixels) || state.pixels.length !== TOTAL_PIXELS) {
      state.pixels = Array.from({ length: TOTAL_PIXELS }, (_, i) => ({
        id: i + 1,
        status: "available",
        color: "#24364e",
        title: "",
        description: "",
        image: "",
        website: "",
        owner: ""
      }));

      // Demo content so the prototype feels alive.
      const demo = [
        [1, "#2d7cff", "Origo Design", "Digital design studio.", "demo.origo"],
        [2, "#7c5cff", "Pixel Lab", "Creative experiments.", ""],
        [37, "#14b8a6", "Art Space", "Illustration and artwork.", ""],
        [83, "#f59e0b", "Nova Brand", "A small digital brand.", ""],
        [125, "#ef4444", "Creator Hub", "Independent creator.", ""]
      ];
      demo.forEach(([id, color, title, description, owner]) => {
        const p = state.pixels[id - 1];
        if (p) Object.assign(p, {
          status: id === 1 ? "yours" : "owned",
          color, title, description, owner
        });
      });
      saveState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pixels));
  }

  function pixelId(id) {
    return `#${String(id).padStart(4, "0")}`;
  }

  function renderGrid() {
    const grid = $("pixelGrid");
    const search = $("searchInput").value.trim().toLowerCase();
    const filter = $("filterSelect").value;

    grid.innerHTML = "";

    state.pixels.forEach(pixel => {
      const el = document.createElement("button");
      el.className = `pixel ${pixel.status}`;
      el.type = "button";
      el.title = `${pixelId(pixel.id)}${pixel.title ? " · " + pixel.title : ""}`;
      el.dataset.id = pixel.id;

      if (pixel.status !== "available") {
        el.style.setProperty("--pixel-color", pixel.color);
      }

      const haystack = `${pixel.id} ${pixel.title} ${pixel.description} ${pixel.owner}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);

      let matchesFilter = true;
      if (filter === "available") matchesFilter = pixel.status === "available";
      if (filter === "owned") matchesFilter = pixel.status === "owned";
      if (filter === "yours") matchesFilter = pixel.status === "yours";
      if (filter === "newest") matchesFilter = pixel.id > TOTAL_PIXELS - 100;

      if (!matchesSearch || !matchesFilter) el.classList.add("filtered-out");

      el.addEventListener("click", event => {
        if (state.dragging) return;
        event.stopPropagation();
        openPixel(pixel.id);
      });

      grid.appendChild(el);
    });

    applyTransform();
  }

  function applyTransform() {
    const world = $("canvasWorld");
    world.style.transform =
      `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px)) scale(${state.zoom})`;
    $("resetZoom").textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setZoom(next, centerX = null, centerY = null) {
    const old = state.zoom;
    state.zoom = Math.max(0.5, Math.min(3, next));

    if (centerX !== null && centerY !== null) {
      const rect = $("canvasShell").getBoundingClientRect();
      const x = centerX - rect.left - rect.width / 2;
      const y = centerY - rect.top - rect.height / 2;
      const factor = state.zoom / old;
      state.panX = x - (x - state.panX) * factor;
      state.panY = y - (y - state.panY) * factor;
    }

    applyTransform();
  }

  function openPixel(id) {
    const pixel = state.pixels[id - 1];
    if (!pixel) return;

    state.selectedId = id;
    state.editing = false;
    $("editArea").classList.add("hidden");
    $("modalPixelPreview").style.background = pixel.status === "available" ? "#111722" : pixel.color;
    $("modalTitle").textContent = `Pixel ${pixelId(id)}`;

    const body = $("modalBody");
    const actions = $("normalActions");

    if (pixel.status === "available") {
      body.innerHTML = `
        <div class="modal-info">
          <p>This pixel is currently <strong>available</strong>.</p>
          <p>In this free prototype, you can claim it and customize your space.</p>
        </div>`;
      actions.innerHTML = `<button class="primary-btn" id="claimPixel">Claim This Pixel</button>`;
      $("claimPixel").onclick = () => claimPixel(id);
    } else {
      body.innerHTML = `
        <div class="modal-info">
          <p><strong>${escapeHtml(pixel.title || "Untitled Pixel")}</strong></p>
          <p>${escapeHtml(pixel.description || "No description yet.")}</p>
          <p>Owner: <strong>${escapeHtml(pixel.owner || (pixel.status === "yours" ? "You" : "Origo Creator"))}</strong></p>
          <p>Pixel: <strong>${pixelId(id)}</strong></p>
          ${safeWebsite(pixel.website) ? `<a class="modal-link" href="${escapeAttr(pixel.website)}" target="_blank" rel="noopener noreferrer">Visit Website →</a>` : ""}
        </div>`;
      actions.innerHTML = pixel.status === "yours"
        ? `<button class="primary-btn" id="editPixel">Edit Pixel</button>`
        : `<button class="secondary-btn" id="closeOnly">Close</button>`;
      if ($("editPixel")) $("editPixel").onclick = startEdit;
      if ($("closeOnly")) $("closeOnly").onclick = closeModal;
    }

    $("pixelModal").classList.remove("hidden");
  }

  function claimPixel(id) {
    const pixel = state.pixels[id - 1];
    if (!pixel || pixel.status !== "available") return;

    pixel.status = "yours";
    pixel.color = "#2d7cff";
    pixel.owner = "You";
    pixel.title = "My Origo Space";
    pixel.description = "Welcome to my space on Origo Marketplace.";
    saveState();
    renderGrid();
    showToast(`${pixelId(id)} claimed successfully.`);
    startEdit();
  }

  function startEdit() {
    const pixel = state.pixels[state.selectedId - 1];
    if (!pixel || pixel.status !== "yours") return;

    state.editing = true;
    $("modalBody").classList.add("hidden");
    $("normalActions").classList.add("hidden");
    $("editArea").classList.remove("hidden");

    $("colorInput").value = pixel.color || "#2d7cff";
    $("titleInput").value = pixel.title || "";
    $("descriptionInput").value = pixel.description || "";
    $("websiteInput").value = pixel.website || "";
  }

  function cancelEdit() {
    state.editing = false;
    $("modalBody").classList.remove("hidden");
    $("normalActions").classList.remove("hidden");
    $("editArea").classList.add("hidden");
    openPixel(state.selectedId);
  }

  function savePixel() {
    const pixel = state.pixels[state.selectedId - 1];
    if (!pixel || pixel.status !== "yours") return;

    const website = $("websiteInput").value.trim();
    if (website && !safeWebsite(website)) {
      showToast("Website must start with HTTPS.");
      return;
    }

    pixel.color = $("colorInput").value;
    pixel.title = $("titleInput").value.trim() || "Untitled Pixel";
    pixel.description = $("descriptionInput").value.trim();
    pixel.website = website;
    saveState();
    renderGrid();
    showToast("Pixel saved.");
    openPixel(pixel.id);
  }

  function safeWebsite(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function closeModal() {
    $("pixelModal").classList.add("hidden");
    state.selectedId = null;
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setupPanZoom() {
    const shell = $("canvasShell");

    shell.addEventListener("pointerdown", e => {
      if (e.target.closest(".pixel")) return;
      state.dragging = false;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.startPanX = state.panX;
      state.startPanY = state.panY;
      shell.setPointerCapture(e.pointerId);
    });

    shell.addEventListener("pointermove", e => {
      if (!shell.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      if (Math.abs(dx) + Math.abs(dy) > 5) state.dragging = true;
      state.panX = state.startPanX + dx;
      state.panY = state.startPanY + dy;
      applyTransform();
    });

    shell.addEventListener("pointerup", e => {
      if (shell.hasPointerCapture(e.pointerId)) shell.releasePointerCapture(e.pointerId);
      setTimeout(() => state.dragging = false, 0);
    });

    shell.addEventListener("wheel", e => {
      e.preventDefault();
      setZoom(state.zoom + (e.deltaY > 0 ? -0.1 : 0.1), e.clientX, e.clientY);
    }, { passive: false });
  }

  function setupMiniGrid() {
    const mini = $("miniGrid");
    for (let i = 0; i < 144; i++) {
      const cell = document.createElement("i");
      mini.appendChild(cell);
    }
  }

  function setupEvents() {
    $("exploreBtn").onclick = () => $("marketplace").scrollIntoView({ behavior: "smooth" });
    $("themeBtn").onclick = () => {
      document.body.classList.toggle("light");
      localStorage.setItem("origo-theme", document.body.classList.contains("light") ? "light" : "dark");
      $("themeBtn").textContent = document.body.classList.contains("light") ? "☾" : "☀";
    };
    $("helpBtn").onclick = () => showToast("Choose an available pixel to claim it for free.");
    $("searchInput").oninput = renderGrid;
    $("filterSelect").onchange = renderGrid;
    $("zoomIn").onclick = () => setZoom(state.zoom + 0.15);
    $("zoomOut").onclick = () => setZoom(state.zoom - 0.15);
    $("resetZoom").onclick = () => {
      state.zoom = 1; state.panX = 0; state.panY = 0; applyTransform();
    };
    $("modalClose").onclick = closeModal;
    $("cancelEdit").onclick = cancelEdit;
    $("savePixel").onclick = savePixel;

    $("pixelModal").addEventListener("click", e => {
      if (e.target === $("pixelModal")) closeModal();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeModal();
    });
  }

  function init() {
    loadState();
    setupMiniGrid();
    setupEvents();
    setupPanZoom();

    if (localStorage.getItem("origo-theme") === "light") {
      document.body.classList.add("light");
      $("themeBtn").textContent = "☾";
    }

    renderGrid();
  }

  init();
})();
    
