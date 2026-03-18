(function () {
  const images = document.querySelectorAll('.portfolio-img');

  function makeFallback(img) {
    const title = img.dataset.fallbackTitle || 'Image unavailable';
    const text = img.dataset.fallbackText || 'Add the referenced image file to this project folder.';
    const box = document.createElement('div');
    box.className = 'image-fallback';
    box.innerHTML = `<div><strong>${title}</strong><span>${text}</span></div>`;

    if (img.classList.contains('hero-bg')) {
      box.style.position = 'absolute';
      box.style.inset = '0';
      box.style.zIndex = '0';
    }

    img.replaceWith(box);
  }

  images.forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      makeFallback(img);
      return;
    }

    img.addEventListener('error', () => makeFallback(img), { once: true });
  });
})();
