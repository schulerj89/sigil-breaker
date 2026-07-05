import { publicAssetUrl } from './assetUrls';

export interface CharacterVoiceLine {
  id: string;
  label: string;
  category: 'catchphrase' | 'level-complete' | 'encouragement' | 'fail' | 'intro-briefing';
  characterName: string;
  text: string;
  rationale: string;
  path: string;
  bytes: number;
  durationSeconds: number;
  volume: number;
}

export interface CharacterVoicePlaybackOptions {
  onEnded?: () => void;
}

export interface CharacterVoicePlayer {
  playVoice: (line: CharacterVoiceLine, options?: CharacterVoicePlaybackOptions) => boolean;
  stopVoice: () => void;
}

export const CHARACTER_VOICE_NAME = 'Glyph';
export const COMMANDER_VOICE_NAME = 'Commander Kade';
export const VOICE_LAB_TITLE = 'Mission Voices';

export const CHARACTER_VOICE_LINES = [
  {
    id: 'audio.voice.glyph.catchphrase.service.elevenlabs',
    label: 'At Your Service',
    category: 'catchphrase',
    characterName: CHARACTER_VOICE_NAME,
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
    characterName: CHARACTER_VOICE_NAME,
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
    characterName: CHARACTER_VOICE_NAME,
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
    characterName: CHARACTER_VOICE_NAME,
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
    characterName: CHARACTER_VOICE_NAME,
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
    characterName: CHARACTER_VOICE_NAME,
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
    characterName: CHARACTER_VOICE_NAME,
    text: '[dizzy] Stars... sigils... snacks?',
    rationale: 'Mascot-style comedy for death/fail states, weird but not derivative.',
    path: 'assets/audio/elevenlabs-foundation/glyph-stars-sigils-snacks.mp3',
    bytes: 40_586,
    durationSeconds: 2.48,
    volume: 0.92,
  },
] as const satisfies readonly CharacterVoiceLine[];

export const INTRO_COMMANDER_VOICE_LINES = [
  {
    id: 'audio.voice.commander-kade.intro.deck-breach.elevenlabs',
    label: 'Deck Breach',
    category: 'intro-briefing',
    characterName: COMMANDER_VOICE_NAME,
    text: '[urgent, controlled] Kade at command. Glyph, listen close: the Rift broke open under our launch deck.',
    rationale: 'Opens with immediate backstory and names the commander without overloading the first shot.',
    path: 'assets/audio/elevenlabs-foundation/commander-kade-intro-deck-breach.mp3',
    bytes: 84_471,
    durationSeconds: 5.2,
    volume: 0.94,
  },
  {
    id: 'audio.voice.commander-kade.intro.hostiles.elevenlabs',
    label: 'Hostiles',
    category: 'intro-briefing',
    characterName: COMMANDER_VOICE_NAME,
    text: '[focused] Those little monsters feed on loose energy. Clear each room, keep moving, and do not let them box you in.',
    rationale: 'Explains why enemies are present and frames the first level as room-clearing rather than pure wandering.',
    path: 'assets/audio/elevenlabs-foundation/commander-kade-intro-hostiles.mp3',
    bytes: 126_685,
    durationSeconds: 7.84,
    volume: 0.94,
  },
  {
    id: 'audio.voice.commander-kade.intro.weapons.elevenlabs',
    label: 'Spark And Bore',
    category: 'intro-briefing',
    characterName: COMMANDER_VOICE_NAME,
    text: '[confident] Spark is fast. Bore hits harder. Swap when the hallway changes shape.',
    rationale: 'Teaches the starting two-gun identity in one practical sentence.',
    path: 'assets/audio/elevenlabs-foundation/commander-kade-intro-weapons.mp3',
    bytes: 85_725,
    durationSeconds: 5.28,
    volume: 0.94,
  },
  {
    id: 'audio.voice.commander-kade.intro.survival.elevenlabs',
    label: 'Survival',
    category: 'intro-briefing',
    characterName: COMMANDER_VOICE_NAME,
    text: '[warning] Your suit is light: twenty-five hit points. Dodge, reload, then push.',
    rationale: 'Calls out the low HP change and the intended mobile FPS rhythm.',
    path: 'assets/audio/elevenlabs-foundation/commander-kade-intro-survival.mp3',
    bytes: 114_982,
    durationSeconds: 7.12,
    volume: 0.94,
  },
  {
    id: 'audio.voice.commander-kade.intro.exit-rift.elevenlabs',
    label: 'Exit Rift',
    category: 'intro-briefing',
    characterName: COMMANDER_VOICE_NAME,
    text: '[commanding] That exit beacon is your way out. Seal the rift and come home loud.',
    rationale: 'Ends on a clear destination and a short heroic push into player control.',
    path: 'assets/audio/elevenlabs-foundation/commander-kade-intro-exit-rift.mp3',
    bytes: 90_741,
    durationSeconds: 5.6,
    volume: 0.94,
  },
] as const satisfies readonly CharacterVoiceLine[];

export const GAME_VOICE_LINES = [
  ...CHARACTER_VOICE_LINES,
  ...INTRO_COMMANDER_VOICE_LINES,
] as const satisfies readonly CharacterVoiceLine[];

export function createCharacterVoiceLab(root: HTMLElement, player: CharacterVoicePlayer): CharacterVoiceLab {
  return new CharacterVoiceLab(root, player);
}

class CharacterVoiceLab {
  private readonly screen: HTMLElement | null;
  private readonly list: HTMLElement | null;
  private readonly status: HTMLElement | null;
  private readonly stopButton: HTMLButtonElement | null;
  private currentLineId: string | null = null;

  constructor(root: HTMLElement, private readonly player: CharacterVoicePlayer) {
    this.screen = root.querySelector<HTMLElement>('[data-voice-lab]');
    this.list = root.querySelector<HTMLElement>('[data-voice-line-list]');
    this.status = root.querySelector<HTMLElement>('[data-voice-lab-status]');
    this.stopButton = root.querySelector<HTMLButtonElement>('[data-voice-lab-stop]');
    this.render();
    this.list?.addEventListener('click', this.onLineClick);
    this.stopButton?.addEventListener('click', this.onStopClick);
  }

  open(): void {
    this.setStatus('VOICE LAB READY');
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

    this.list.innerHTML = GAME_VOICE_LINES.map((line) => {
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
              <span class="voice-line__speaker">${escapeHtml(line.characterName)}</span>
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
    const line = GAME_VOICE_LINES.find((candidate) => candidate.id === lineId);
    if (line) {
      this.play(line);
    }
  };

  private readonly onStopClick = (event: MouseEvent): void => {
    event.preventDefault();
    this.stop();
    this.setStatus('VOICE LAB READY');
  };

  private play(line: CharacterVoiceLine): void {
    this.stop();
    this.currentLineId = line.id;
    this.setStatus(`PLAYING ${line.label.toUpperCase()}`);
    this.updateActiveRow();

    if (!this.player.playVoice(line, { onEnded: this.onAudioEnded })) {
      this.setStatus('VOICE PLAYBACK UNAVAILABLE');
      this.currentLineId = null;
      this.updateActiveRow();
    }
  }

  private stop(): void {
    this.player.stopVoice();
    this.currentLineId = null;
    this.updateActiveRow();
  }

  private readonly onAudioEnded = (): void => {
    this.currentLineId = null;
    this.setStatus('VOICE LAB READY');
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
