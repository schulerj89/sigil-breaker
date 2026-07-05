import { publicAssetUrl } from './assetUrls';

export interface CharacterVoiceLine {
  id: string;
  label: string;
  category: 'catchphrase' | 'level-complete' | 'encouragement' | 'fail';
  text: string;
  rationale: string;
  path: string;
  bytes: number;
  durationSeconds: number;
  volume: number;
}

export const CHARACTER_VOICE_NAME = 'Glyph';

export const CHARACTER_VOICE_LINES = [
  {
    id: 'audio.voice.glyph.catchphrase.service.elevenlabs',
    label: 'At Your Service',
    category: 'catchphrase',
    text: '[confident] Glyph at your service!',
    rationale: 'Clean mascot intro, short enough for menus or level starts, with upbeat hero energy.',
    path: 'assets/audio/elevenlabs-foundation/glyph-at-your-service.mp3',
    bytes: 31_808,
    durationSeconds: 1.92,
    volume: 0.9,
  },
  {
    id: 'audio.voice.glyph.level-complete.rift-sealed.elevenlabs',
    label: 'Rift Sealed',
    category: 'level-complete',
    text: '[excited] Rift sealed! Nice work!',
    rationale: 'Celebrates success and ties directly to the Gadget Rift theme.',
    path: 'assets/audio/elevenlabs-foundation/glyph-rift-sealed.mp3',
    bytes: 36_824,
    durationSeconds: 2.24,
    volume: 0.9,
  },
  {
    id: 'audio.voice.glyph.level-complete.slick.elevenlabs',
    label: 'That Was Slick',
    category: 'level-complete',
    text: '[laughs] That was slick!',
    rationale: 'Fast, playful praise that works after a stylish clear or combo.',
    path: 'assets/audio/elevenlabs-foundation/glyph-that-was-slick.mp3',
    bytes: 31_808,
    durationSeconds: 1.92,
    volume: 0.9,
  },
  {
    id: 'audio.voice.glyph.encouragement.keep-moving.elevenlabs',
    label: 'Keep Moving',
    category: 'encouragement',
    text: '[determined] Keep moving, we got this!',
    rationale: 'Mobile-game short, supportive, and action-forward.',
    path: 'assets/audio/elevenlabs-foundation/glyph-keep-moving.mp3',
    bytes: 34_316,
    durationSeconds: 2.08,
    volume: 0.9,
  },
  {
    id: 'audio.voice.glyph.encouragement.sparks-up.elevenlabs',
    label: 'Sparks Up',
    category: 'encouragement',
    text: '[playful] Sparks up, feet fast!',
    rationale: 'Gives the character a punchy tech-magic flavor without overexplaining.',
    path: 'assets/audio/elevenlabs-foundation/glyph-sparks-up-feet-fast.mp3',
    bytes: 29_301,
    durationSeconds: 1.76,
    volume: 0.9,
  },
  {
    id: 'audio.voice.glyph.fail.reboot.elevenlabs',
    label: 'Reboot Me',
    category: 'fail',
    text: '[gasp] Oof! Reboot me!',
    rationale: 'A light fail line that keeps defeat funny instead of frustrating.',
    path: 'assets/audio/elevenlabs-foundation/glyph-oof-reboot-me.mp3',
    bytes: 41_839,
    durationSeconds: 2.56,
    volume: 0.92,
  },
  {
    id: 'audio.voice.glyph.fail.stars.elevenlabs',
    label: 'Stars And Snacks',
    category: 'fail',
    text: '[dizzy] Stars... sigils... snacks?',
    rationale: 'Mascot-style comedy for death/fail states, weird but not derivative.',
    path: 'assets/audio/elevenlabs-foundation/glyph-stars-sigils-snacks.mp3',
    bytes: 40_586,
    durationSeconds: 2.48,
    volume: 0.92,
  },
] as const satisfies readonly CharacterVoiceLine[];

export function createCharacterVoiceLab(root: HTMLElement): CharacterVoiceLab {
  return new CharacterVoiceLab(root);
}

class CharacterVoiceLab {
  private readonly screen: HTMLElement | null;
  private readonly list: HTMLElement | null;
  private readonly status: HTMLElement | null;
  private readonly stopButton: HTMLButtonElement | null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentLineId: string | null = null;

  constructor(root: HTMLElement) {
    this.screen = root.querySelector<HTMLElement>('[data-voice-lab]');
    this.list = root.querySelector<HTMLElement>('[data-voice-line-list]');
    this.status = root.querySelector<HTMLElement>('[data-voice-lab-status]');
    this.stopButton = root.querySelector<HTMLButtonElement>('[data-voice-lab-stop]');
    this.render();
    this.list?.addEventListener('click', this.onLineClick);
    this.stopButton?.addEventListener('click', this.onStopClick);
  }

  open(): void {
    this.setStatus(`${CHARACTER_VOICE_NAME.toUpperCase()} VOICE READY`);
    this.updateActiveRow();
  }

  close(): void {
    this.stop();
  }

  dispose(): void {
    this.list?.removeEventListener('click', this.onLineClick);
    this.stopButton?.removeEventListener('click', this.onStopClick);
    this.stop();
  }

  private render(): void {
    if (!this.list) {
      return;
    }

    this.list.innerHTML = CHARACTER_VOICE_LINES.map((line) => {
      const sourceUrl = publicAssetUrl(line.path);
      return `
        <article class="voice-line" data-voice-line="${escapeAttribute(line.id)}">
          <button
            class="voice-line__play"
            type="button"
            data-ui-control
            data-voice-line-play
            data-voice-line-id="${escapeAttribute(line.id)}"
            data-voice-src="${escapeAttribute(sourceUrl)}"
            aria-label="Play ${escapeAttribute(line.label)}"
          >PLAY</button>
          <div class="voice-line__copy">
            <div class="voice-line__meta">
              <span class="voice-line__label">${escapeHtml(line.label)}</span>
              <span class="voice-line__category">${escapeHtml(line.category)}</span>
              <span class="voice-line__duration">${line.durationSeconds.toFixed(2)}S</span>
            </div>
            <div class="voice-line__text">${escapeHtml(line.text)}</div>
          </div>
        </article>
      `;
    }).join('');
  }

  private readonly onLineClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>('[data-voice-line-play]');
    const lineId = button?.dataset.voiceLineId;
    if (!lineId) {
      return;
    }

    event.preventDefault();
    const line = CHARACTER_VOICE_LINES.find((candidate) => candidate.id === lineId);
    if (line) {
      void this.play(line);
    }
  };

  private readonly onStopClick = (event: MouseEvent): void => {
    event.preventDefault();
    this.stop();
    this.setStatus(`${CHARACTER_VOICE_NAME.toUpperCase()} VOICE READY`);
  };

  private async play(line: CharacterVoiceLine): Promise<void> {
    this.stop();
    const audio = new Audio(publicAssetUrl(line.path));
    audio.preload = 'auto';
    audio.volume = line.volume;
    audio.addEventListener('ended', this.onAudioEnded);
    this.currentAudio = audio;
    this.currentLineId = line.id;
    this.setStatus(`PLAYING ${line.label.toUpperCase()}`);
    this.updateActiveRow();

    try {
      await audio.play();
    } catch {
      if (this.currentAudio === audio) {
        this.setStatus('VOICE PLAYBACK BLOCKED');
        this.stop();
      }
    }
  }

  private stop(): void {
    const audio = this.currentAudio;
    if (audio) {
      audio.removeEventListener('ended', this.onAudioEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    this.currentAudio = null;
    this.currentLineId = null;
    this.updateActiveRow();
  }

  private readonly onAudioEnded = (): void => {
    this.currentAudio = null;
    this.currentLineId = null;
    this.setStatus(`${CHARACTER_VOICE_NAME.toUpperCase()} VOICE READY`);
    this.updateActiveRow();
  };

  private updateActiveRow(): void {
    if (!this.screen) {
      return;
    }

    for (const row of this.screen.querySelectorAll<HTMLElement>('[data-voice-line]')) {
      row.classList.toggle('is-active', row.dataset.voiceLine === this.currentLineId);
    }
  }

  private setStatus(text: string): void {
    if (this.status) {
      this.status.textContent = text;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
