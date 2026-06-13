
  const spiral = document.getElementById('spiral');
  if (spiral) {
    const count = Math.ceil(document.body.scrollHeight / 38) + 2;
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('div');
      ring.className = 'spiral-ring';
      ring.style.top = (i * 38 + 6) + 'px';
      spiral.appendChild(ring);
    }
  }

  // Hide placeholder styling/tag once a real image loads successfully
  document.querySelectorAll('.img-slot').forEach(img => {
    img.addEventListener('load', () => {
      if (img.naturalWidth > 0) {
        img.style.border = 'none';
        img.style.background = 'none';
        img.style.objectFit = 'contain';
        const tag = img.parentElement.querySelector('.img-tag');
        if (tag) tag.style.display = 'none';
      }
    });
    img.addEventListener('error', () => {
      img.style.minHeight = '160px';
    });
  });
