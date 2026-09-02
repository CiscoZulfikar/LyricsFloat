const { exec } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

class MediaWatcher extends EventEmitter {
  constructor(pollIntervalMs = 800) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.currentTrack = null;
    this.isPolling = false;
    this.scriptPath = path.join(__dirname, 'get-media.ps1').replace('app.asar', 'app.asar.unpacked');
  }


  start() {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; & '${this.scriptPath}'"`;

    exec(cmd, { timeout: 2500, encoding: 'utf8' }, (err, stdout) => {
      this.isPolling = false;
      if (err || !stdout || !stdout.trim()) return;


      try {
        const data = JSON.parse(stdout.trim());
        if (data && data.Title) {
          const trackChanged = !this.currentTrack || 
            this.currentTrack.Title !== data.Title || 
            this.currentTrack.Artist !== data.Artist;

          this.currentTrack = data;

          if (trackChanged) {
            this.emit('track-change', {
              title: data.Title,
              artist: data.Artist,
              album: data.Album || '',
              durationMs: data.DurationMs || 0,
              positionMs: data.PositionMs || 0,
              isPlaying: Boolean(data.IsPlaying)
            });
          }

          this.emit('playback-state', {
            title: data.Title,
            artist: data.Artist,
            positionMs: data.PositionMs || 0,
            durationMs: data.DurationMs || 0,
            isPlaying: Boolean(data.IsPlaying)
          });
        }
      } catch (e) {
        // Ignored parse error on empty/idle output
      }
    });
  }
}

module.exports = { MediaWatcher };
