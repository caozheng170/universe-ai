
export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  bgmNodes: AudioScheduledSourceNode[] = [];
  isMuted: boolean = false;
  isInitialized: boolean = false;

  // Effects
  convolver: ConvolverNode;
  compressor: DynamicsCompressorNode;

  constructor() {
    // Cross-browser support
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6; 
    
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.convolver = this.ctx.createConvolver();
    this.setupReverb();
    
    // Chain: Source -> Convolver(Parallel) -> Compressor -> Master
    this.convolver.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  // Generate an impulse response for a wide spacey reverb
  setupReverb() {
    const rate = this.ctx.sampleRate;
    const length = rate * 4.0; // 4 seconds tail
    const decay = 3.0;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        // Exponential decay noise
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }
    this.convolver.buffer = impulse;
  }

  // Pink noise generator for texture
  createPinkNoise() {
      const bufferSize = 4096;
      const pinkNoise = this.ctx.createScriptProcessor(bufferSize, 1, 1);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      pinkNoise.onaudioprocess = function(e) {
          const output = e.outputBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
              const white = Math.random() * 2 - 1;
              b0 = 0.99886 * b0 + white * 0.0555179;
              b1 = 0.99332 * b1 + white * 0.075076;
              b2 = 0.96900 * b2 + white * 0.1538520;
              b3 = 0.86650 * b3 + white * 0.3104856;
              b4 = 0.55000 * b4 + white * 0.5329522;
              b5 = -0.7616 * b5 - white * 0.0168980;
              output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
              output[i] *= 0.11; // (roughly) compensate for gain
              b6 = white * 0.115926;
          }
      };
      return pinkNoise;
  }

  async init() {
    if (this.isInitialized) return;
    
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
    
    this.startBGM();
    this.isInitialized = true;
  }

  startBGM() {
    this.bgmNodes.forEach(n => {
        try { n.stop(); } catch(e) {}
        try { n.disconnect(); } catch(e) {}
    });
    this.bgmNodes = [];

    const now = this.ctx.currentTime;

    // Layer 1: Deep Space Drone (Filtered Sawtooths)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 36.71; // D1 (Deep)
    
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.value = 120;
    filter1.Q.value = 1;

    // Slow Filter Modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05; // Very slow breathe
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain);
    lfoGain.connect(filter1.frequency);

    const gain1 = this.ctx.createGain();
    gain1.gain.value = 0.15;

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.convolver); // Full wet reverb

    osc1.start(now);
    lfo.start(now);

    // Layer 2: High Ethereal Pad (Sine)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 146.83; // D3
    
    const gain2 = this.ctx.createGain();
    gain2.gain.value = 0.05;
    
    // Stereo spread (fake)
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0.3;

    osc2.connect(gain2);
    gain2.connect(panner);
    panner.connect(this.convolver);
    osc2.start(now);

    this.bgmNodes.push(osc1, lfo, osc2);
  }

  playExpand() {
    if (this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // Concept: "Celestial Chime" - Multiple sines in a chord with rapid arpeggio + sparkle
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major chord high
    
    freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        // Pitch drift up
        osc.frequency.exponentialRampToValueAtTime(f * 1.05, t + 1);
        
        const gain = this.ctx.createGain();
        // Staggered entry
        const startTime = t + i * 0.05;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15 / freqs.length, startTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);
        
        osc.connect(gain);
        gain.connect(this.convolver);
        gain.connect(this.compressor); // Dry signal too
        
        osc.start(startTime);
        osc.stop(startTime + 2.1);
    });

    // Add a "Sparkle" noise burst
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 3000;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.convolver);
    noise.start(t);
  }

  playContract() {
    if (this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // Concept: "Implosion" - Lowpass sweep on noise + Sub drop
    
    // 1. Noise Sweep (Suction)
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.6); // Sweep down

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.3, t + 0.2);
    noiseGain.gain.linearRampToValueAtTime(0, t + 0.6);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.convolver);
    noiseGain.connect(this.compressor);
    noise.start(t);

    // 2. Sub Bass Drop (Heavy Impact)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.5);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    subOsc.connect(subGain);
    subGain.connect(this.compressor); // Direct to master (no reverb for sub to keep it tight)
    
    subOsc.start(t);
    subOsc.stop(t + 0.6);
  }

  toggleMute(muted: boolean) {
    this.isMuted = muted;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.6, t, 0.2);
    
    if (!muted && this.ctx.state === 'suspended') {
        this.ctx.resume();
    }
  }
}
