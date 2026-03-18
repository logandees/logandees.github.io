document.addEventListener("DOMContentLoaded", () => {
  setupImageFallbacks();
  setupVideoFallback();
});

function setupImageFallbacks() {
  const images = document.querySelectorAll(".fallback-img");

  images.forEach((img) => {
    img.addEventListener("error", () => {
      const card = img.closest(".media-card") || img.parentElement;

      const fallback = document.createElement("div");
      fallback.className = "fallback-box";
      fallback.innerHTML = `
        <div>
          <strong>Image unavailable</strong>
          <p>This media slot is ready for project documentation or build photos.</p>
        </div>
      `;

      img.replaceWith(fallback);
    });
  });
}

function setupVideoFallback() {
  const video = document.getElementById("elevatorVideo");
  const fallback = document.getElementById("videoFallback");

  if (!video || !fallback) return;

  const showFallback = () => {
    video.style.display = "none";
    fallback.style.display = "grid";
  };

  video.addEventListener("error", showFallback);

  const source = video.querySelector("source");
  if (!source || !source.getAttribute("src")) {
    showFallback();
    return;
  }

  video.addEventListener("loadeddata", () => {
    fallback.style.display = "none";
    video.style.display = "block";
  });

  setTimeout(() => {
    if (video.readyState === 0) {
      showFallback();
    }
  }, 1200);
}
