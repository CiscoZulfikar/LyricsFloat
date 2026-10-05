const { exec } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

const CP437_CHARS = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';
const CP437_BYTE_MAP = {};
for (let i = 0; i < CP437_CHARS.length; i++) {
  CP437_BYTE_MAP[CP437_CHARS[i]] = 0x80 + i;
}

function fixCP437Mojibake(str) {
  if (!str || typeof str !== 'string') return str;
  // If string contains box-drawing or symbols characteristic of CP437-decoded UTF-8:
  if (!/[│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌░▒▓σµτΦΘΩδ∞φε]/.test(str)) {
    return str;
  }
  try {
    const bytes = [];
    for (const ch of str) {
      if (CP437_BYTE_MAP[ch] !== undefined) {
        bytes.push(CP437_BYTE_MAP[ch]);
      } else {
        const code = ch.charCodeAt(0);
        if (code < 128) bytes.push(code);
        else return str;
      }
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    if (!decoded.includes('\ufffd') && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(decoded)) {
      return decoded;
    }
  } catch (e) {}
  return str;
}

class MediaWatcher extends EventEmitter {
  constructor(pollIntervalMs = 800) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.currentTrack = null;
    this.isPolling = false;
    this.scriptPath = path.join(__dirname, 'get-media.ps1').replace('app.asar', 'app.asar.unpacked');
    this.seekScriptPath = path.join(__dirname, 'seek-media.ps1').replace('app.asar', 'app.asar.unpacked');
    this.controlScriptPath = path.join(__dirname, 'control-media.ps1').replace('app.asar', 'app.asar.unpacked');
    this.lastSeekTime = 0;
    this.lastSeekPosition = 0;
  }

  control(action) {
    const validActions = {
      'play-pause': 'PlayPause',
      'toggle-play': 'PlayPause',
      'next': 'Next',
      'previous': 'Previous',
      'prev': 'Previous',
      'play': 'Play',
      'pause': 'Pause'
    };
    const mapped = validActions[(action || '').toLowerCase()] || 'PlayPause';

    if (mapped === 'PlayPause' && this.currentTrack) {
      this.currentTrack.IsPlaying = !this.currentTrack.IsPlaying;
      this.emit('playback-state', {
        title: this.currentTrack.Title,
        artist: this.currentTrack.Artist,
        album: this.currentTrack.Album || '',
        positionMs: this.currentTrack.PositionMs || 0,
        durationMs: this.currentTrack.DurationMs || 0,
        isPlaying: Boolean(this.currentTrack.IsPlaying)
      });
    }

    return new Promise((resolve) => {
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; & '${this.controlScriptPath}' -Action '${mapped}'"`;
      exec(cmd, { timeout: 2000, encoding: 'utf8' }, (err, stdout) => {
        if (err) {
          resolve(false);
          return;
        }
        const ok = stdout && stdout.toLowerCase().includes('true');
        resolve(Boolean(ok));
      });
    });
  }

  seek(positionMs) {
    const target = Math.max(0, Math.round(Number(positionMs) || 0));
    this.lastSeekTime = Date.now();
    this.lastSeekPosition = target;
    if (this.currentTrack) {
      this.currentTrack.PositionMs = target;
    }

    return new Promise((resolve) => {
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; & '${this.seekScriptPath}' -PositionMs ${target}"`;
      exec(cmd, { timeout: 2000, encoding: 'utf8' }, (err, stdout) => {
        if (err) {
          resolve(false);
          return;
        }
        const ok = stdout && stdout.toLowerCase().includes('true');
        if (ok && this.currentTrack) {
          this.currentTrack.PositionMs = target;
          this.emit('playback-state', {
            title: this.currentTrack.Title,
            artist: this.currentTrack.Artist,
            album: this.currentTrack.Album || '',
            positionMs: target,
            durationMs: this.currentTrack.DurationMs || 0,
            isPlaying: Boolean(this.currentTrack.IsPlaying)
          });
        }
        resolve(Boolean(ok));
      });
    });
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
          data.Title = fixCP437Mojibake(data.Title);
          data.Artist = fixCP437Mojibake(data.Artist);
          data.Album = fixCP437Mojibake(data.Album || '');

          const trackChanged = !this.currentTrack || 
            this.currentTrack.Title !== data.Title || 
            this.currentTrack.Artist !== data.Artist;

          // If a seek was executed recently (within 1500ms) and track hasn't changed,
          // suppress stale polled position from WinRT to prevent post-seek back-and-forth jitter
          if (!trackChanged && this.lastSeekTime && (Date.now() - this.lastSeekTime < 1500)) {
            data.PositionMs = this.lastSeekPosition;
          }

          this.currentTrack = data;

          if (trackChanged) {
            this.emit('track-change', {
              title: data.Title,
              artist: data.Artist,
              album: data.Album || '',
              trackNumber: data.TrackNumber || 0,
              durationMs: data.DurationMs || 0,
              positionMs: data.PositionMs || 0,
              isPlaying: Boolean(data.IsPlaying)
            });
          }

          this.emit('playback-state', {
            title: data.Title,
            artist: data.Artist,
            album: data.Album || '',
            trackNumber: data.TrackNumber || 0,
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

module.exports = { MediaWatcher, fixCP437Mojibake };
