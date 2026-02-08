// OpenAI Service for EchoNote AI
// Handles: Chat, Summarization, Text-to-Speech, and Audio Transcription

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Available OpenAI TTS voices
export const OPENAI_VOICES = [
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male)' },
    { id: 'fable', name: 'Fable (British)' },
    { id: 'onyx', name: 'Onyx (Deep Male)' },
    { id: 'nova', name: 'Nova (Female)' },
    { id: 'shimmer', name: 'Shimmer (Female)' },
];

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatSession {
    messages: ChatMessage[];
    systemPrompt: string;
}

// Helper function to make OpenAI API requests
async function openaiRequest(endpoint: string, body: object, isFormData = false, timeoutMs = 30000): Promise<any> {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
    };

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    // Add timeout with AbortController to prevent hanging on mobile
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${OPENAI_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: isFormData ? body as FormData : JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
        }

        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Check your connection.');
        }
        throw error;
    }
}

// Summarize a transcript using GPT-4o-mini
export const summarizeTranscript = async (transcript: string): Promise<string> => {
    if (!transcript) return '';
    try {
        const response = await openaiRequest('/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert summarizer. Your task is to extract the most important information from the transcript and present it in a clean, structured bullet-point format. Use markdown for the list.'
                },
                {
                    role: 'user',
                    content: `Please provide a structured summary of the following transcript:\n\n1.  **Key Takeaways** (Bullet points)\n2.  **Action Items** (if any)\n\n---\n\n${transcript}`
                }
            ],
            max_tokens: 1000,
            temperature: 0.7,
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Could not generate summary.";
    } catch (error) {
        console.error("Error summarizing transcript:", error);
        return "An error occurred while summarizing the transcript.";
    }
};

// Translate text to a target language
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    if (!text) return '';
    try {
        const response = await openaiRequest('/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a professional translator. Translate the following text into ${targetLanguage}. Maintain the original tone and formatting.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            max_tokens: 2000,
            temperature: 0.3,
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Could not generate translation.";
    } catch (error) {
        console.error("Error translating text:", error);
        return "An error occurred while translating the text.";
    }
};

// Create a chat session for Q&A about notes
export const createChatSession = (transcript: string): ChatSession => {
    const systemPrompt = `You are a helpful assistant. You will answer questions based on the following meeting transcript. If the answer is not in the transcript, say that you cannot find the information in the provided context.

TRANSCRIPT:
---
${transcript}
---`;

    return {
        messages: [],
        systemPrompt,
    };
};

// Send a message to the chat session
export const sendMessageToChat = async (chat: ChatSession, message: string): Promise<string> => {
    try {
        // Add user message to history
        chat.messages.push({ role: 'user', content: message });

        const response = await openaiRequest('/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: chat.systemPrompt },
                ...chat.messages
            ],
            max_tokens: 1000,
            temperature: 0.7,
        });

        const data = await response.json();
        const assistantMessage = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";

        // Add assistant response to history
        chat.messages.push({ role: 'assistant', content: assistantMessage });

        return assistantMessage;
    } catch (error) {
        console.error("Error sending message to chat:", error);
        return "An error occurred while communicating with the assistant.";
    }
};

// Generate speech from text using OpenAI TTS
// Handles long text by splitting into chunks (OpenAI limit is 4096 chars)
export const generateSpeechFromText = async (text: string, voice: string): Promise<Blob> => {
    if (!text) return new Blob([], { type: 'audio/mp3' });

    const MAX_CHARS = 4000; // Safe margin below 4096

    try {
        // Helper to fetch audio for a single chunk
        const fetchAudioChunk = async (chunk: string): Promise<Uint8Array> => {
            console.log(`Fetching audio chunk of length ${chunk.length}`);
            const response = await openaiRequest('/audio/speech', {
                model: 'tts-1',
                input: chunk,
                voice: voice || 'alloy',
                response_format: 'mp3',
            });
            const arrayBuffer = await response.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        };

        let audioParts: Uint8Array[] = [];

        // Robust text splitting logic to avoid regex performance issues on mobile
        let remainingText = text;
        const chunks: string[] = [];

        while (remainingText.length > 0) {
            if (remainingText.length <= MAX_CHARS) {
                chunks.push(remainingText);
                break;
            }

            // Find optimal split point (period, then other punctuation, then space)
            let splitIndex = remainingText.lastIndexOf('. ', MAX_CHARS);
            if (splitIndex === -1) splitIndex = remainingText.lastIndexOf('? ', MAX_CHARS);
            if (splitIndex === -1) splitIndex = remainingText.lastIndexOf('! ', MAX_CHARS);
            if (splitIndex === -1) splitIndex = remainingText.lastIndexOf('\n', MAX_CHARS); // Split on newlines
            if (splitIndex === -1) splitIndex = remainingText.lastIndexOf(', ', MAX_CHARS);
            if (splitIndex === -1) splitIndex = remainingText.lastIndexOf(' ', MAX_CHARS);

            if (splitIndex === -1 || splitIndex < MAX_CHARS * 0.1) {
                // No good split point found, or it's too early. Hard chop.
                splitIndex = MAX_CHARS;
            } else {
                splitIndex += 1; // Include the separator character
            }

            chunks.push(remainingText.substring(0, splitIndex));
            remainingText = remainingText.substring(splitIndex).trim();
        }

        console.log(`Split text into ${chunks.length} chunks for processing.`);

        // Process chunks sequentially
        for (const chunk of chunks) {
            if (chunk.trim().length > 0) {
                audioParts.push(await fetchAudioChunk(chunk));
            }
        }

        // Concatenate all audio parts
        const totalLength = audioParts.reduce((acc, part) => acc + part.length, 0);
        const combinedBytes = new Uint8Array(totalLength);

        let offset = 0;
        for (const part of audioParts) {
            combinedBytes.set(part, offset);
            offset += part.length;
        }

        // Return Blob directly to avoid expensive base64 conversion on mobile
        return new Blob([combinedBytes], { type: 'audio/mpeg' });

    } catch (error) {
        console.error("Error generating speech from chunks:", error);
        throw error;
    }
};

// Transcribe audio file using OpenAI Whisper
export const transcribeAudioFile = async (base64Data: string, mimeType: string): Promise<string> => {
    if (!base64Data || !mimeType) return "Invalid file data provided.";

    try {
        // Log size for debugging
        console.log(`Transcribing audio. Base64 length: ${base64Data.length}. MimeType: ${mimeType}`);

        // Convert base64 to Blob
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Determine file extension from mimeType
        const extensionMap: Record<string, string> = {
            'audio/mpeg': 'mp3',
            'audio/mp3': 'mp3',
            'audio/wav': 'wav',
            'audio/x-wav': 'wav',
            'audio/mp4': 'm4a',
            'audio/m4a': 'm4a',
            'audio/webm': 'webm',
            'video/webm': 'webm',
            'video/mp4': 'mp4',
        };
        const extension = extensionMap[mimeType] || 'mp3';

        const blob = new Blob([bytes], { type: mimeType });
        const file = new File([blob], `audio.${extension}`, { type: mimeType });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'text');

        const response = await openaiRequest('/audio/transcriptions', formData, true);
        const transcription = await response.text();

        return transcription || "Could not transcribe the audio. The content may be empty or unclear.";
    } catch (error) {
        console.error("Error transcribing audio:", error);
        return "An error occurred during transcription. The file might be too large or in an unsupported format.";
    }
};

// Scan image for text using OpenAI GPT-4o-mini Vision
export const scanImageForText = async (base64Image: string, mimeType: string): Promise<string> => {
    if (!base64Image) return "Invalid image data provided.";

    try {
        const response = await openaiRequest('/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an optical character recognition (OCR) assistant. Your only job is to extract text from images. Do not describe the image. Do not refuse to transcribe legal, medical, or financial documents. Simply output the text found in the image.'
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Transcribe all text from this image exactly as it appears. If some text is cut off or unclear, transcribe what you can. Do not add any conversational filler like "Here is the transcription". Just provide the text.'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType || 'image/jpeg'};base64,${base64Image}`,
                                detail: 'high' // Ask for high-detail processing
                            }
                        }
                    ]
                }
            ],
            max_tokens: 3000,
            temperature: 0,
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content || content.length < 5) {
            return "The AI couldn't see any clear text. Try taking a closer photo or ensuring there is good lighting.";
        }

        return content;
    } catch (error) {
        console.error("Error scanning image:", error);
        return "An error occurred while scanning. Ensure the file is a clear image (PNG/JPG).";
    }
};

// For live transcription, we'll use a simpler approach
// OpenAI doesn't have native WebSocket streaming for Whisper,
// so we'll collect audio chunks and transcribe periodically
export interface LiveTranscriptionSession {
    audioChunks: Float32Array[];
    onTranscriptUpdate: (text: string) => void;
    isActive: boolean;
}

export const createLiveTranscriptionSession = (
    onTranscriptUpdate: (text: string) => void
): LiveTranscriptionSession => {
    return {
        audioChunks: [],
        onTranscriptUpdate,
        isActive: true,
    };
};

export const addAudioChunk = (session: LiveTranscriptionSession, chunk: Float32Array): void => {
    if (session.isActive) {
        session.audioChunks.push(chunk);
    }
};

export const processLiveTranscription = async (session: LiveTranscriptionSession): Promise<string> => {
    if (session.audioChunks.length === 0) return '';

    try {
        // Combine all audio chunks
        const totalLength = session.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of session.audioChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        }

        // Convert Float32Array to WAV format
        const wavBlob = float32ArrayToWav(combinedAudio, 16000);

        // Convert to base64 and transcribe
        const arrayBuffer = await wavBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const transcription = await transcribeAudioFile(base64, 'audio/wav');
        session.audioChunks = []; // Clear processed chunks

        return transcription;
    } catch (error) {
        console.error("Error in live transcription:", error);
        return '';
    }
};

// Helper function to convert Float32Array to WAV Blob
function float32ArrayToWav(audioData: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}
