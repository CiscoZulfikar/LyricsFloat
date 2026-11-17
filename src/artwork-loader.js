(function(root) {
  function createArtworkLoader(applyArtwork, ImageConstructor = root.Image) {
    let requestId = 0;

    const loadArtwork = (url) => new Promise((resolve, reject) => {
      const currentRequestId = ++requestId;
      if (!url) {
        resolve(false);
        return;
      }

      const image = new ImageConstructor();
      let settled = false;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (!loaded || currentRequestId !== requestId) {
          resolve(false);
          return;
        }

        try {
          applyArtwork(url);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };

      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = url;
      if (image.complete) {
        finish(image.naturalWidth > 0);
      }
    });

    loadArtwork.cancel = () => {
      requestId++;
    };

    return loadArtwork;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createArtworkLoader };
  }
  root.createArtworkLoader = createArtworkLoader;
})(typeof window !== 'undefined' ? window : globalThis);
