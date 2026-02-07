
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '../types';
import { summarizeTranscript, generateSpeechFromText, transcribeAudioFile, OPENAI_VOICES } from '../services/openaiService';
import { Mic, StopCircle, Loader, FileText, Send, ArrowLeft, Download, UploadCloud, Check, Pause, ChevronDown, Play } from 'lucide-react';

interface NotesViewProps {
  note: Note | null;
  onSave: (note: Note) => void;
  onStartChat: (note: Note) => void;
  onBack: () => void;
  showToast: (message: string) => void;
  shouldAutoPlay?: boolean;
}

// --- Audio Helper Functions ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode MP3 audio data using Web Audio API
async function decodeAudioDataFromMp3(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return await ctx.decodeAudioData(arrayBuffer);
}

// Use OpenAI voices instead of Gemini voices
const voices = OPENAI_VOICES;

// Play a notification sound (pleasant chime)
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create two oscillators for a pleasant two-tone chime
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Fade in and out for a smooth sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    playTone(523.25, now, 0.15);        // C5
    playTone(659.25, now + 0.1, 0.2);   // E5
    playTone(783.99, now + 0.2, 0.25);  // G5

    // Clean up after sounds complete
    setTimeout(() => audioContext.close(), 1000);
  } catch (e) {
    console.log('Could not play notification sound:', e);
  }
}

const playbackSpeeds = [0.75, 1, 1.25, 1.5, 2];

interface AudioWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({ analyser, isPlaying }) => {
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (analyser) {
      const bufferLength = analyser.frequencyBinCount;
      setDataArray(new Uint8Array(bufferLength));
    }
  }, [analyser]);

  const draw = useCallback(() => {
    if (!analyser || !dataArray) return;

    animationFrameIdRef.current = requestAnimationFrame(draw);
    const currentData = dataArray;
    const newData = new Uint8Array(currentData.length);
    analyser.getByteFrequencyData(newData);
    setDataArray(newData);
  }, [analyser, dataArray]);

  useEffect(() => {
    if (isPlaying && analyser) {
      draw();
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, analyser, draw]);

  if (!dataArray) return null;

  const currentData = dataArray;
  const barWidthPercent = 100 / currentData.length;
  const gapPercent = barWidthPercent * 0.15;
  const rectWidthPercent = barWidthPercent - gapPercent;

  return (
    <svg width="100%" height="40" preserveAspectRatio="none">
      {Array.from(currentData).map((value: number, i: number) => {
        const height = (value / 255) * 40;
        return (
          <rect
            key={i}
            x={`${i * barWidthPercent}%`}
            y={40 - height}
            width={`${rectWidthPercent}%`}
            height={height}
            className="text-brand-blue"
            fill="currentColor"
            rx="1"
          />
        );
      })}
    </svg>
  );
};


const NotesView: React.FC<NotesViewProps> = ({ note, onSave, onStartChat, onBack, showToast, shouldAutoPlay }) => {
  const [currentNote, setCurrentNote] = useState<Note | null>(note);
  const [isRecording, setIsRecording] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [driveSaveState, setDriveSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const voiceDropdownRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const cleanupAudio = useCallback(() => {
    if (audioSourceNodeRef.current) {
      try { audioSourceNodeRef.current.stop(); } catch (e) { }
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    audioBufferRef.current = null;
    audioSourceNodeRef.current = null;
    outputAudioContextRef.current = null;
    analyserRef.current = null;
    setIsPlayingAudio(false);
    setIsGeneratingSpeech(false);
  }, []);

  // Handle auto-play from Scanner
  useEffect(() => {
    if (shouldAutoPlay && transcription && transcription.length > 20 && !hasAutoPlayed && !isGeneratingSpeech && !isPlayingAudio) {
      setHasAutoPlayed(true);
      handlePlayPause();
    }
  }, [shouldAutoPlay, transcription, hasAutoPlayed, isGeneratingSpeech, isPlayingAudio]);

  useEffect(() => {
    if (note) {
      setCurrentNote(note);
      setTranscription(note.transcript);
    }
    return cleanupAudio;
  }, [note, cleanupAudio]);

  useEffect(() => {
    if (currentNote && transcription !== currentNote.transcript) {
      const handler = setTimeout(() => {
        onSave({ ...currentNote, transcript: transcription });
      }, 1000);
      return () => clearTimeout(handler);
    }
  }, [transcription, currentNote, onSave]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceDropdownRef.current && !voiceDropdownRef.current.contains(event.target as Node)) {
        setIsVoiceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const playFromBeginning = useCallback(() => {
    if (!audioBufferRef.current) return;
    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioSourceNodeRef.current) {
      audioSourceNodeRef.current.onended = null;
      try { audioSourceNodeRef.current.stop(); } catch (e) { }
    }
    if (outputAudioContextRef.current.state === 'suspended') {
      outputAudioContextRef.current.resume();
    }

    const audioCtx = outputAudioContextRef.current;
    if (!analyserRef.current || analyserRef.current.context !== audioCtx) {
      const newAnalyser = audioCtx.createAnalyser();
      newAnalyser.fftSize = 64;
      analyserRef.current = newAnalyser;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = playbackSpeed;

    source.connect(analyserRef.current);
    analyserRef.current.connect(audioCtx.destination);

    source.onended = () => {
      if (outputAudioContextRef.current?.state !== 'suspended') {
        setIsPlayingAudio(false);
        audioSourceNodeRef.current = null;
      }
    };
    source.start(0);
    audioSourceNodeRef.current = source;
    setIsPlayingAudio(true);
  }, [playbackSpeed]);


  const handlePlayPause = async () => {
    if (isPlayingAudio) {
      if (outputAudioContextRef.current?.state === 'running') {
        await outputAudioContextRef.current.suspend();
        setIsPlayingAudio(false);
      }
      return;
    }

    if (audioBufferRef.current) {
      if (outputAudioContextRef.current?.state === 'suspended') {
        await outputAudioContextRef.current.resume();
        setIsPlayingAudio(true);
      }
      else {
        playFromBeginning();
      }
    }
    else {
      if (!currentNote?.transcript) {
        showToast("There is no text to listen to.");
        return;
      }
      setIsGeneratingSpeech(true);
      try {
        const base64Audio = await generateSpeechFromText(currentNote.transcript, selectedVoice);
        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
          outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioBytes = decode(base64Audio);
        const buffer = await decodeAudioDataFromMp3(audioBytes, outputAudioContextRef.current);
        audioBufferRef.current = buffer;
        playFromBeginning();
      } catch (error) {
        console.error("Error generating speech:", error);
        showToast("Sorry, couldn't generate audio.");
      } finally {
        setIsGeneratingSpeech(false);
      }
    }
  };

  const handleStopAudio = useCallback(() => {
    if (audioSourceNodeRef.current) {
      audioSourceNodeRef.current.onended = null;
      try { audioSourceNodeRef.current.stop(); } catch (e) { }
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'suspended') {
      outputAudioContextRef.current.resume();
    }
    setIsPlayingAudio(false);
    audioSourceNodeRef.current = null;
  }, []);


  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setIsVoiceDropdownOpen(false);
    if (audioBufferRef.current) {
      handleStopAudio();
      audioBufferRef.current = null;
    }
  };

  const handleChangeSpeed = () => {
    const currentIndex = playbackSpeeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % playbackSpeeds.length;
    const newSpeed = playbackSpeeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioSourceNodeRef.current) {
      audioSourceNodeRef.current.playbackRate.value = newSpeed;
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use MediaRecorder to collect audio for OpenAI Whisper transcription
      // Try audio/webm;codecs=opus first, fallback to audio/webm
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Use timeslice of 1000ms to get data periodically
      mediaRecorder.start(1000);
      setIsRecording(true);
      showToast("Recording started. Speak now...");
    } catch (err) {
      console.error("Error starting recording:", err);
      showToast("Could not access microphone.");
      setIsRecording(false);
    }
  };

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    const stream = streamRef.current;

    // Wait for the MediaRecorder to properly stop and collect all data
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }

    // Stop all audio tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Transcribe the recorded audio using OpenAI Whisper
    if (audioChunksRef.current.length > 0) {
      showToast("Transcribing audio...");
      try {
        // Get the actual mime type from the recorder
        const mimeType = recorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        console.log(`Audio blob size: ${audioBlob.size} bytes, type: ${mimeType}`);

        const arrayBuffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        const newTranscription = await transcribeAudioFile(base64Audio, mimeType);

        const updatedTranscript = transcription
          ? transcription + ' ' + newTranscription
          : newTranscription;

        setTranscription(updatedTranscript);

        if (currentNote) {
          const updatedNote = { ...currentNote, transcript: updatedTranscript };
          setCurrentNote(updatedNote);
          onSave(updatedNote);
        }

        showToast("Transcription complete!");
      } catch (error) {
        console.error("Transcription error:", error);
        showToast("Failed to transcribe audio.");
      }

      audioChunksRef.current = [];
    }

    mediaRecorderRef.current = null;
  }, [transcription, currentNote, onSave, showToast]);

  const handleSummarize = async () => {
    if (!currentNote || !currentNote.transcript) return;
    setIsSummarizing(true);
    const summary = await summarizeTranscript(currentNote.transcript);
    const updatedNote = { ...currentNote, summary };
    setCurrentNote(updatedNote);
    onSave(updatedNote);
    setIsSummarizing(false);
    playNotificationSound(); // Play chime when summary is ready
    showToast("Summary ready!");
  };

  const handleExportNote = () => {
    if (!currentNote) return;
    const fileName = `${currentNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    const fileContent = `Title: ${currentNote.title}\n\n--- TRANSCRIPT ---\n${currentNote.transcript}\n\n--- SUMMARY ---\n${currentNote.summary || 'No summary generated.'}`;
    const blob = new window.Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleSaveToDrive = () => {
    if (driveSaveState !== 'idle' || !currentNote) return;
    setDriveSaveState('saving');
    setTimeout(() => {
      setDriveSaveState('success');
      showToast("Note saved to Google Drive (Simulated)");
      setTimeout(() => {
        setDriveSaveState('idle');
      }, 2000);
    }, 1500);
  };

  const renderDriveButtonIcon = () => {
    switch (driveSaveState) {
      case 'saving':
        return <Loader size={20} className="animate-spin text-light-text dark:text-gray-100" />;
      case 'success':
        return <Check size={20} className="text-green-500" />;
      case 'idle':
      default:
        return <UploadCloud size={20} className="text-light-text dark:text-gray-100" />;
    }
  };

  if (!currentNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-light-text-secondary dark:dark-text-secondary p-4">
        <FileText size={48} className="mb-4" />
        <h2 className="text-xl font-semibold">No active note</h2>
        <p>Select a note from "My Files" or start a new one.</p>
        <button onClick={onBack} className="mt-4 text-brand-blue font-semibold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 mb-2 px-1">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors touch-manipulation"
            aria-label="Go back to files"
          >
            <ArrowLeft size={24} className="text-light-text dark:text-gray-100" />
          </button>
          <h2 className="text-xl font-bold text-light-text dark:text-gray-100 truncate flex-1">{currentNote.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportNote}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Export note as .txt file"
            >
              <Download size={20} className="text-light-text dark:text-gray-100" />
            </button>
            <button
              onClick={handleSaveToDrive}
              disabled={driveSaveState !== 'idle'}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Save note to Google Drive (simulated)"
            >
              {renderDriveButtonIcon()}
            </button>
          </div>
        </div>

        {/* Voice & Playback Controls */}
        <div className="bg-light-bg dark:bg-dark-card/50 rounded-xl p-2 flex items-center gap-1 sm:gap-2 mb-2 h-[60px] sm:h-[68px]">
          <div ref={voiceDropdownRef} className="relative flex-shrink-0">
            <button onClick={() => setIsVoiceDropdownOpen(p => !p)} className="flex items-center gap-1 text-xs sm:text-sm p-1.5 sm:p-2 rounded-lg text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 transition-colors touch-manipulation">
              <span className="font-semibold">{selectedVoice}</span>
              <ChevronDown size={16} />
            </button>
            {isVoiceDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 animate-fade-in">
                <div className="p-2 text-sm font-semibold text-light-text dark:text-dark-text border-b border-gray-200 dark:border-slate-700">Select Voice</div>
                {voices.map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => handleSelectVoice(voice.id)}
                    className="w-full text-left px-3 py-2 text-sm flex justify-between items-center text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>{voice.name}</span>
                    {selectedVoice === voice.id && <Check size={16} className="text-brand-blue" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-grow h-full flex items-center justify-center mx-2 overflow-hidden">
            <AudioWaveformVisualizer analyser={analyserRef.current} isPlaying={isPlayingAudio} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleChangeSpeed} className="w-12 text-sm font-bold p-2 rounded-lg text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 transition-colors">
              {playbackSpeed}x
            </button>
            <button onClick={handleStopAudio} disabled={!audioBufferRef.current} className="p-2 rounded-full text-brand-blue dark:text-blue-400 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 transition-colors disabled:opacity-50">
              <StopCircle size={22} />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={isGeneratingSpeech}
              className="w-12 h-12 flex items-center justify-center bg-brand-blue text-white rounded-full transition-transform hover:scale-105 disabled:opacity-50"
            >
              {isGeneratingSpeech
                ? <Loader size={24} className="animate-spin" />
                : isPlayingAudio
                  ? <Pause size={24} />
                  : <Play size={24} className="ml-1" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Transcript Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative">
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            readOnly={isRecording}
            placeholder="Start speaking to begin your note..."
            className="w-full min-h-[150px] max-h-none bg-transparent resize-none focus:outline-none text-base sm:text-lg leading-relaxed text-light-text dark:text-gray-300 placeholder-light-text-secondary dark:placeholder-dark-text-secondary overflow-y-auto"
            aria-label="Note transcript"
            style={{ height: 'auto' }}
            rows={Math.max(8, transcription.split('\n').length + 2)}
          />
          {isRecording && <span className="absolute top-1 right-1 animate-pulse w-3 h-3 bg-red-500 rounded-full"></span>}
        </div>

        {currentNote.summary && (
          <div className="my-4 p-3 sm:p-4 bg-light-bg dark:bg-dark-card rounded-lg">
            <h3 className="font-bold mb-2 text-sm sm:text-base text-light-text dark:text-gray-100">Summary</h3>
            <p className="text-xs sm:text-sm whitespace-pre-wrap text-light-text-secondary dark:text-gray-400">{currentNote.summary}</p>
          </div>
        )}
      </div>

      {/* Fixed Footer with Recording Button */}
      <div className="flex-shrink-0 pt-2 pb-16 sm:pb-4 bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-sm">
        <div className="flex justify-center mb-3 sm:mb-6">
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-10 touch-manipulation"
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <div className={`absolute inset-0 rounded-full border-2 ${isRecording ? 'border-red-500 animate-pulse' : 'border-gray-500 dark:border-white/60'}`}></div>
            <div className="w-[88%] h-[88%] bg-light-card dark:bg-[#1D1E29] rounded-full flex items-center justify-center">
              {isRecording ?
                <StopCircle size={28} className="text-red-500" /> :
                <Mic size={28} className="text-brand-blue" />
              }
            </div>
          </button>
        </div>

        {transcription && !isRecording && (
          <div className="flex gap-2 sm:gap-4 px-1">
            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="flex-1 bg-light-card dark:bg-dark-card py-3 sm:py-4 px-3 sm:px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm sm:text-base text-light-text dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm touch-manipulation"
            >
              {isSummarizing ? <Loader size={18} className="animate-spin" /> : <FileText size={18} />}
              Summarize
            </button>
            <button
              onClick={() => onStartChat(currentNote)}
              className="flex-1 bg-brand-blue text-white py-3 sm:py-4 px-3 sm:px-4 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm sm:text-base hover:opacity-90 transition-opacity shadow-md shadow-brand-blue/20 touch-manipulation"
            >
              <Send size={18} />
              Ask AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesView;

