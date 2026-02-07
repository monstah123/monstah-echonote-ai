
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Zap, Loader } from 'lucide-react';

interface ScannerViewProps {
    onCapture: (base64Image: string) => void;
    onClose: () => void;
}

const ScannerView: React.FC<ScannerViewProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }, // Uses back camera on mobile
                audio: false,
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access camera. Please check permissions.");
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [startCamera]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current || isCapturing) return;

        setIsCapturing(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            onCapture(base64Image);
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-between p-6">
            <div className="w-full flex justify-between items-center z-10">
                <button onClick={onClose} className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white">
                    <X size={24} />
                </button>
                <div className="text-white font-semibold">Scan Page</div>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            <div className="relative w-full flex-1 my-6 rounded-3xl overflow-hidden border-2 border-white/20">
                {error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
                        <p>{error}</p>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {/* Scanner Guides */}
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                    <div className="w-full h-full border-2 border-brand-blue/50 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-blue -mt-1 -ml-1"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-blue -mt-1 -mr-1"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-blue -mb-1 -ml-1"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-blue -mb-1 -mr-1"></div>
                    </div>
                </div>
            </div>

            <div className="w-full flex items-center justify-around pb-8 z-10">
                <div className="p-2 text-white/50"><Zap size={24} /></div>

                <button
                    onClick={handleCapture}
                    disabled={isCapturing}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                    {isCapturing ? (
                        <div className="flex flex-col items-center">
                            <Loader size={32} className="text-brand-blue animate-spin" />
                            <span className="text-[10px] text-brand-blue font-bold mt-1">READING</span>
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-full border-4 border-brand-blue flex items-center justify-center">
                            <Camera size={32} className="text-brand-blue" />
                        </div>
                    )}
                </button>

                <div className="w-10"></div> {/* Spacer */}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default ScannerView;
