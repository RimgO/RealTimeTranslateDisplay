import os
import io
import wave
import sys

# use the mock api key or real one if in env
api_key = os.environ.get("DEEPGRAM_API_KEY", "b304f5e55cd7dc81640bdcc06b52d9a32c256086") # I need a real key to test? No, wait, if it fails auth, I'll see the error.

# Create a fake 1 second audio wav
fake_audio = bytes([0] * 16000 * 2)
wav_io = io.BytesIO()
with wave.open(wav_io, 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(16000)
    wf.writeframes(fake_audio)
buffer = wav_io.getvalue()

from deepgram import DeepgramClient, PrerecordedOptions

deepgram = DeepgramClient(api_key)

payload = {"buffer": buffer}
options = PrerecordedOptions(
    model="nova-2",
    language="ja",
    smart_format=True,
)

try:
    response = deepgram.listen.rest.v("1").transcribe_file(payload, options)
    print("Type of response:", type(response))
    if hasattr(response, "to_dict"):
        print(response.to_dict())
    else:
        print(response)
    
    text = response.results.channels[0].alternatives[0].transcript
    print("Extracted text:", text)
except Exception as e:
    import traceback
    traceback.print_exc()
