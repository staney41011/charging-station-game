const slides = Array.from(document.querySelectorAll(".deck-slide"));
const prevBtn = document.getElementById("prevSlideBtn");
const nextBtn = document.getElementById("nextSlideBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const progressEl = document.getElementById("slideProgress");
const dotsEl = document.getElementById("slideDots");
const requestedSlide = Number(new URLSearchParams(window.location.search).get("slide"));
let currentSlide = Number.isInteger(requestedSlide)
  ? Math.max(0, Math.min(slides.length - 1, requestedSlide - 1))
  : 0;

function renderDots() {
  if (!dotsEl) return;

  dotsEl.innerHTML = slides.map((slide, index) => {
    const label = slide.dataset.slideTitle || `第 ${index + 1} 頁`;
    return `<button type="button" aria-label="${label}" data-slide="${index}"></button>`;
  }).join("");

  dotsEl.addEventListener("click", event => {
    const button = event.target.closest("button[data-slide]");
    if (!button) return;
    goToSlide(Number(button.dataset.slide));
  });
}

function updateSlide() {
  slides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === currentSlide);
  });

  if (progressEl) progressEl.textContent = `${currentSlide + 1} / ${slides.length}`;
  if (prevBtn) prevBtn.disabled = currentSlide === 0;
  if (nextBtn) nextBtn.disabled = currentSlide === slides.length - 1;

  Array.from(dotsEl?.querySelectorAll("button") || []).forEach((dot, index) => {
    dot.classList.toggle("is-active", index === currentSlide);
  });
}

function goToSlide(index) {
  currentSlide = Math.max(0, Math.min(slides.length - 1, index));
  updateSlide();
}

function nextSlide() {
  goToSlide(currentSlide + 1);
}

function prevSlide() {
  goToSlide(currentSlide - 1);
}

async function enterFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
    return;
  }

  await document.exitFullscreen?.();
}

document.addEventListener("keydown", event => {
  if (["ArrowRight", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    nextSlide();
  }

  if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    prevSlide();
  }

  if (event.key === "Home") goToSlide(0);
  if (event.key === "End") goToSlide(slides.length - 1);
});

prevBtn?.addEventListener("click", prevSlide);
nextBtn?.addEventListener("click", nextSlide);
fullscreenBtn?.addEventListener("click", enterFullscreen);

renderDots();
updateSlide();
