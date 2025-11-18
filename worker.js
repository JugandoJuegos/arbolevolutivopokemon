// worker.js
// Worker simple para cargar data.json y devolver la estructura y lista de imágenes
self.addEventListener('message', async (ev) => {
  const msg = ev.data || {};
  if (!msg || msg.cmd !== 'load') return;

  const url = msg.url || 'data.json';
  try {
    postMessage({ type: 'status', status: 'fetching', url });

    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

    // Intentamos leer como texto y luego parsear (mejor mensaje de error si falla)
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      // si no es JSON puro, intentamos limpiar BOMs raros y reintentar
      const cleaned = text.replace(/^\uFEFF/, '');
      data = JSON.parse(cleaned);
    }

    // Recolectar todas las URLs de imagen de la estructura
    const urls = new Set();
    function collect(obj) {
      if (!obj || typeof obj !== 'object') return;
      // keys que suelen contener imágenes en tu estructura
      const checkImage = (val) => {
        if (!val) return;
        if (typeof val === 'string') {
          // ignore very short or not-url values
          if (val.length > 4) urls.add(val);
        } else if (Array.isArray(val)) {
          val.forEach(v => checkImage(v));
        } else if (typeof val === 'object') {
          collect(val);
        }
      };

      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k === 'image' || k === 'href' || k === 'icon' || k === 'src') {
          checkImage(v);
        } else if (k === 'images' && Array.isArray(v)) {
          v.forEach(i => checkImage(i));
        } else if (k === 'circleChild' && v && v.image) {
          checkImage(v.image);
        } else if (k === 'variations' && Array.isArray(v)) {
          v.forEach(varObj => {
            if (varObj && (varObj.icon || varObj.image)) checkImage(varObj.icon || varObj.image);
            collect(varObj);
          });
        } else {
          // recursión genérica
          collect(v);
        }
      }
    }
    collect(data);

    const images = Array.from(urls).filter(Boolean);

    postMessage({ type: 'data', data, images });

  } catch (err) {
    postMessage({ type: 'error', error: String(err) });
  }
});
