"use strict";
'use client';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceChat = void 0;
const react_1 = __importStar(require("react"));
const client_polly_1 = require("@aws-sdk/client-polly");
const VoiceChat = ({ onCheckIn, onAgentResponse }) => {
    const [isRecording, setIsRecording] = (0, react_1.useState)(false);
    const [transcript, setTranscript] = (0, react_1.useState)('');
    const [recognition, setRecognition] = (0, react_1.useState)(null);
    const pollyClient = (0, react_1.useMemo)(() => new client_polly_1.PollyClient({
        region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || ''
        }
    }), []);
    const speakText = (0, react_1.useCallback)(async (text) => {
        try {
            const command = new client_polly_1.SynthesizeSpeechCommand({
                Text: text,
                OutputFormat: 'mp3',
                VoiceId: 'Joanna',
                Engine: 'neural'
            });
            const response = await pollyClient.send(command);
            if (response.AudioStream instanceof Blob) {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await response.AudioStream.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start(0);
            }
        }
        catch (error) {
            console.error('Error speaking text:', error);
        }
    }, [pollyClient]);
    (0, react_1.useEffect)(() => {
        if (onAgentResponse) {
            onAgentResponse(speakText);
        }
    }, [onAgentResponse, speakText]);
    const initializeSpeechRecognition = (0, react_1.useCallback)(() => {
        if (!('webkitSpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return null;
        }
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
            const lastResult = event.results[event.results.length - 1];
            const text = lastResult[0].transcript;
            setTranscript(text);
            if (lastResult.isFinal) {
                onCheckIn(text);
            }
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
        };
        recognition.onend = () => {
            setIsRecording(false);
        };
        return recognition;
    }, [onCheckIn]);
    (0, react_1.useEffect)(() => {
        const rec = initializeSpeechRecognition();
        if (rec) {
            setRecognition(rec);
        }
        return () => {
            if (recognition) {
                recognition.stop();
            }
        };
    }, [initializeSpeechRecognition, recognition]);
    const handleToggleRecording = async () => {
        if (!recognition) {
            console.error('Speech recognition not initialized');
            return;
        }
        if (isRecording) {
            recognition.stop();
            setIsRecording(false);
        }
        else {
            try {
                await recognition.start();
                setIsRecording(true);
                await speakText('Voice recognition started. You can speak now.');
            }
            catch (error) {
                console.error('Error starting speech recognition:', error);
            }
        }
    };
    return (<div className="flex flex-col items-center space-y-4 p-4">
      <button onClick={handleToggleRecording} className={`px-4 py-2 rounded-full ${isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'} text-white font-semibold transition-colors`}>
        {isRecording ? 'Stop Recording' : 'Start Voice Chat'}
      </button>
      {transcript && (<div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <p className="text-gray-700">{transcript}</p>
        </div>)}
    </div>);
};
exports.VoiceChat = VoiceChat;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVm9pY2VDaGF0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiVm9pY2VDaGF0LnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUViLCtDQUF5RTtBQUN6RSx3REFBNkU7QUFPdEUsTUFBTSxTQUFTLEdBQTZCLENBQUMsRUFBRSxTQUFTLEVBQUUsZUFBZSxFQUFFLEVBQUUsRUFBRTtJQUNwRixNQUFNLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxLQUFLLENBQUMsQ0FBQztJQUN0RCxNQUFNLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxFQUFFLENBQUMsQ0FBQztJQUNqRCxNQUFNLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBMkIsSUFBSSxDQUFDLENBQUM7SUFFL0UsTUFBTSxXQUFXLEdBQUcsSUFBQSxlQUFPLEVBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSwwQkFBVyxDQUFDO1FBQ2hELE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixJQUFJLFdBQVc7UUFDekQsV0FBVyxFQUFFO1lBQ1gsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsNkJBQTZCLElBQUksRUFBRTtZQUM1RCxlQUFlLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsSUFBSSxFQUFFO1NBQ3JFO0tBQ0YsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRVIsTUFBTSxTQUFTLEdBQUcsSUFBQSxtQkFBVyxFQUFDLEtBQUssRUFBRSxJQUFZLEVBQUUsRUFBRTtRQUNuRCxJQUFJLENBQUM7WUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFJLHNDQUF1QixDQUFDO2dCQUMxQyxJQUFJLEVBQUUsSUFBSTtnQkFDVixZQUFZLEVBQUUsS0FBSztnQkFDbkIsT0FBTyxFQUFFLFFB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QUMsQ0FBQyw2QkFBNkI7WUFDL0IsQ0FBQyxDQUFDLCtCQUNOLDZDQUE2QyxDQUFDLENBRTlDO1FBQUEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FDdEQ7TUFBQSxFQUFFLE1BQU0sQ0FDUjtNQUFBLENBQUMsVUFBVSxJQUFJLENBQ2IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGlDQUFpQyxDQUM5QztVQUFBLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQzlDO1FBQUEsRUFBRSxHQUFHLENBQUMsQ0FDUCxDQUNIO0lBQUEsRUFBRSxHQUFHLENBQUMsQ0FDUCxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBL0hXLFFBQUEsU0FBUyxhQStIcEIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIGNsaWVudCc7XG5cbmltcG9ydCBSZWFjdCwgeyB1c2VFZmZlY3QsIHVzZVN0YXRlLCB1c2VDYWxsYmFjaywgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IFBvbGx5Q2xpZW50LCBTeW50aGVzaXplU3BlZWNoQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1wb2xseSc7XG5cbmludGVyZmFjZSBWb2ljZUNoYXRQcm9wcyB7XG4gIG9uQ2hlY2tJbjogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZDtcbiAgb25BZ2VudFJlc3BvbnNlPzogKHNwZWFrRm46ICh0ZXh0OiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4pID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBWb2ljZUNoYXQ6IFJlYWN0LkZDPFZvaWNlQ2hhdFByb3BzPiA9ICh7IG9uQ2hlY2tJbiwgb25BZ2VudFJlc3BvbnNlIH0pID0+IHtcbiAgY29uc3QgW2lzUmVjb3JkaW5nLCBzZXRJc1JlY29yZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFt0cmFuc2NyaXB0LCBzZXRUcmFuc2NyaXB0XSA9IHVzZVN0YXRlKCcnKTtcbiAgY29uc3QgW3JlY29nbml0aW9uLCBzZXRSZWNvZ25pdGlvbl0gPSB1c2VTdGF0ZTxTcGVlY2hSZWNvZ25pdGlvbiB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IHBvbGx5Q2xpZW50ID0gdXNlTWVtbygoKSA9PiBuZXcgUG9sbHlDbGllbnQoe1xuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVdTX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbiAgICBjcmVkZW50aWFsczoge1xuICAgICAgYWNjZXNzS2V5SWQ6IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX0FXU19BQ0NFU1NfS0VZX0lEIHx8ICcnLFxuICAgICAgc2VjcmV0QWNjZXNzS2V5OiBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BV1NfU0VDUkVUX0FDQ0VTU19LRVkgfHwgJydcbiAgICB9XG4gIH0pLCBbXSk7XG5cbiAgY29uc3Qgc3BlYWtUZXh0ID0gdXNlQ2FsbGJhY2soYXN5bmMgKHRleHQ6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IFN5bnRoZXNpemVTcGVlY2hDb21tYW5kKHtcbiAgICAgICAgVGV4dDogdGV4dCxcbiAgICAgICAgT3V0cHV0Rm9ybWF0OiAnbXAzJyxcbiAgICAgICAgVm9pY2VJZDogJ0pvYW5uYScsXG4gICAgICAgIEVuZ2luZTogJ25ldXJhbCdcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHBvbGx5Q2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICBpZiAocmVzcG9uc2UuQXVkaW9TdHJlYW0gaW5zdGFuY2VvZiBCbG9iKSB7XG4gICAgICAgIGNvbnN0IGF1ZGlvQ29udGV4dCA9IG5ldyAod2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0KSgpO1xuICAgICAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGF3YWl0IHJlc3BvbnNlLkF1ZGlvU3RyZWFtLmFycmF5QnVmZmVyKCk7XG4gICAgICAgIGNvbnN0IGF1ZGlvQnVmZmVyID0gYXdhaXQgYXVkaW9Db250ZXh0LmRlY29kZUF1ZGlvRGF0YShhcnJheUJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgc291cmNlLmJ1ZmZlciA9IGF1ZGlvQnVmZmVyO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICBzb3VyY2Uuc3RhcnQoMCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNwZWFraW5nIHRleHQ6JywgZXJyb3IpO1xuICAgIH1cbiAgfSwgW3BvbGx5Q2xpZW50XSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAob25BZ2VudFJlc3BvbnNlKSB7XG4gICAgICBvbkFnZW50UmVzcG9uc2Uoc3BlYWtUZXh0KTtcbiAgICB9XG4gIH0sIFtvbkFnZW50UmVzcG9uc2UsIHNwZWFrVGV4dF0pO1xuXG4gIGNvbnN0IGluaXRpYWxpemVTcGVlY2hSZWNvZ25pdGlvbiA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoISgnd2Via2l0U3BlZWNoUmVjb2duaXRpb24nIGluIHdpbmRvdykpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1NwZWVjaCByZWNvZ25pdGlvbiBub3Qgc3VwcG9ydGVkJyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCByZWNvZ25pdGlvbiA9IG5ldyB3aW5kb3cud2Via2l0U3BlZWNoUmVjb2duaXRpb24oKTtcbiAgICByZWNvZ25pdGlvbi5jb250aW51b3VzID0gdHJ1ZTtcbiAgICByZWNvZ25pdGlvbi5pbnRlcmltUmVzdWx0cyA9IHRydWU7XG4gICAgcmVjb2duaXRpb24ubGFuZyA9ICdlbi1VUyc7XG5cbiAgICByZWNvZ25pdGlvbi5vbnJlc3VsdCA9IChldmVudDogU3BlZWNoUmVjb2duaXRpb25FdmVudCkgPT4ge1xuICAgICAgY29uc3QgbGFzdFJlc3VsdCA9IGV2ZW50LnJlc3VsdHNbZXZlbnQucmVzdWx0cy5sZW5ndGggLSAxXTtcbiAgICAgIGNvbnN0IHRleHQgPSBsYXN0UmVzdWx0WzBdLnRyYW5zY3JpcHQ7XG4gICAgICBzZXRUcmFuc2NyaXB0KHRleHQpO1xuXG4gICAgICBpZiAobGFzdFJlc3VsdC5pc0ZpbmFsKSB7XG4gICAgICAgIG9uQ2hlY2tJbih0ZXh0KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmVjb2duaXRpb24ub25lcnJvciA9IChldmVudDogU3BlZWNoUmVjb2duaXRpb25FcnJvckV2ZW50KSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKCdTcGVlY2ggcmVjb2duaXRpb24gZXJyb3I6JywgZXZlbnQuZXJyb3IpO1xuICAgICAgc2V0SXNSZWNvcmRpbmcoZmFsc2UpO1xuICAgIH07XG5cbiAgICByZWNvZ25pdGlvbi5vbmVuZCA9ICgpID0+IHtcbiAgICAgIHNldElzUmVjb3JkaW5nKGZhbHNlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHJlY29nbml0aW9uO1xuICB9LCBbb25DaGVja0luXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCByZWMgPSBpbml0aWFsaXplU3BlZWNoUmVjb2duaXRpb24oKTtcbiAgICBpZiAocmVjKSB7XG4gICAgICBzZXRSZWNvZ25pdGlvbihyZWMpO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKHJlY29nbml0aW9uKSB7XG4gICAgICAgIHJlY29nbml0aW9uLnN0b3AoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9LCBbaW5pdGlhbGl6ZVNwZWVjaFJlY29nbml0aW9uLCByZWNvZ25pdGlvbl0pO1xuXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZVJlY29yZGluZyA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXJlY29nbml0aW9uKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdTcGVlY2ggcmVjb2duaXRpb24gbm90IGluaXRpYWxpemVkJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzUmVjb3JkaW5nKSB7XG4gICAgICByZWNvZ25pdGlvbi5zdG9wKCk7XG4gICAgICBzZXRJc1JlY29yZGluZyhmYWxzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHJlY29nbml0aW9uLnN0YXJ0KCk7XG4gICAgICAgIHNldElzUmVjb3JkaW5nKHRydWUpO1xuICAgICAgICBhd2FpdCBzcGVha1RleHQoJ1ZvaWNlIHJlY29nbml0aW9uIHN0YXJ0ZWQuIFlvdSBjYW4gc3BlYWsgbm93LicpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc3RhcnRpbmcgc3BlZWNoIHJlY29nbml0aW9uOicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIHNwYWNlLXktNCBwLTRcIj5cbiAgICAgIDxidXR0b25cbiAgICAgICAgb25DbGljaz17aGFuZGxlVG9nZ2xlUmVjb3JkaW5nfVxuICAgICAgICBjbGFzc05hbWU9e2BweC00IHB5LTIgcm91bmRlZC1mdWxsICR7XG4gICAgICAgICAgaXNSZWNvcmRpbmdcbiAgICAgICAgICAgID8gJ2JnLXJlZC01MDAgaG92ZXI6YmctcmVkLTYwMCdcbiAgICAgICAgICAgIDogJ2JnLWJsdWUtNTAwIGhvdmVyOmJnLWJsdWUtNjAwJ1xuICAgICAgICB9IHRleHQtd2hpdGUgZm9udC1zZW1pYm9sZCB0cmFuc2l0aW9uLWNvbG9yc2B9XG4gICAgICA+XG4gICAgICAgIHtpc1JlY29yZGluZyA/ICdTdG9wIFJlY29yZGluZycgOiAnU3RhcnQgVm9pY2UgQ2hhdCd9XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIHt0cmFuc2NyaXB0ICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC00IHAtNCBiZy1ncmF5LTEwMCByb3VuZGVkLWxnXCI+XG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTcwMFwiPnt0cmFuc2NyaXB0fTwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufTtcbiJdfQ==