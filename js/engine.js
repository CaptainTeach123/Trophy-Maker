// Main-thread client for the geometry worker: a tiny promise-based RPC.
export class Engine {
  constructor() {
    // index.html starts the worker before any module has loaded so the WASM kernel downloads in parallel with the UI
    this.worker = window.__earlyWorker || new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.nextId = 1;
    this.worker.onmessage = (e) => {
      const { rid, ok, error, result } = e.data;
      const p = this.pending.get(rid);
      if (!p) return;
      this.pending.delete(rid);
      if (ok) p.resolve(result); else p.reject(new Error(error));
    };
    this.worker.onerror = (e) => {
      const err = new Error(e.message || 'The geometry worker failed to start');
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.failed = err;
    };
    this.ready = this.call('ping'); // resolves once the WASM kernel has initialised
  }
  call(type, payload = {}, transfer = []) {
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => {
      const rid = this.nextId++; // request id — kept apart from the payload so payload fields can never clobber it
      this.pending.set(rid, { resolve, reject });
      this.worker.postMessage({ rid, type, payload }, transfer);
    });
  }
  build(state) { return this.call('build', { state }); }
  importStl(assetId, name, buffer) { return this.call('importStl', { assetId, name, buffer }, [buffer]); }
  removeAsset(assetId) { return this.call('removeAsset', { assetId }); }
  registerFont(id, buffer) { return this.call('registerFont', { id, buffer }, [buffer]); }
  export(basename) { return this.call('export', { basename }); }
  thumb(kind, id) { return this.call('thumb', { kind, id }); }
}
