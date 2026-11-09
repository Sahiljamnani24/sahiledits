"""Generate a short original electronic backing loop for the F1 test."""
import math
import random
import struct
import wave

RATE = 24000
SECONDS = 20
BPM = 112
random.seed(11)
beat = 60 / BPM
with wave.open('public/music.wav', 'wb') as sound:
    sound.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
    data = bytearray()
    for i in range(RATE * SECONDS):
        t = i / RATE
        phase = t % beat
        bass = 0.23 * math.sin(2 * math.pi * 55 * t) * math.exp(-phase * 5)
        kick = 0.55 * math.sin(2 * math.pi * (48 * phase + 30 * (1 - math.exp(-phase * 20)) / 20)) * math.exp(-phase * 21)
        hatphase = (t + beat / 4) % (beat / 2)
        hat = 0.09 * random.uniform(-1, 1) * math.exp(-hatphase * 65)
        chord = .035 * (math.sin(2*math.pi*110*t) + math.sin(2*math.pi*130.81*t) + math.sin(2*math.pi*164.81*t))
        fade = min(1, t * 3, max(0, (SECONDS-t)*2))
        sample = max(-1, min(1, fade * (kick+bass+hat+chord)))
        data.extend(struct.pack('<h', int(sample * 32767)))
    sound.writeframes(data)
