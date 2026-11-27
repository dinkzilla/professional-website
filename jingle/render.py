"""Render a MIDI file to WAV using libfluidsynth via ctypes (no CLI needed).

Usage: python3 render.py <soundfont.sf2> <in.mid> <out.wav> [gain] [fade_in_s] [fade_out_s]
"""
import ctypes
import sys

sf2, mid, wav = sys.argv[1:4]
gain = float(sys.argv[4]) if len(sys.argv) > 4 else 0.6
FADE_IN = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
FADE = float(sys.argv[6]) if len(sys.argv) > 6 else 0.6

fl = ctypes.CDLL("libfluidsynth.so.3")
fl.new_fluid_settings.restype = ctypes.c_void_p
fl.new_fluid_synth.restype = ctypes.c_void_p
fl.new_fluid_synth.argtypes = [ctypes.c_void_p]
fl.new_fluid_player.restype = ctypes.c_void_p
fl.new_fluid_player.argtypes = [ctypes.c_void_p]
fl.new_fluid_file_renderer.restype = ctypes.c_void_p
fl.new_fluid_file_renderer.argtypes = [ctypes.c_void_p]
fl.fluid_settings_setstr.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p]
fl.fluid_settings_setnum.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_double]
fl.fluid_settings_setint.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
fl.fluid_synth_sfload.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
fl.fluid_player_add.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
fl.fluid_player_play.argtypes = [ctypes.c_void_p]
fl.fluid_player_get_status.argtypes = [ctypes.c_void_p]
fl.fluid_file_renderer_process_block.argtypes = [ctypes.c_void_p]
for f in ("delete_fluid_file_renderer", "delete_fluid_player", "delete_fluid_synth", "delete_fluid_settings"):
    getattr(fl, f).argtypes = [ctypes.c_void_p]

FLUID_PLAYER_PLAYING = 1

s = fl.new_fluid_settings()
fl.fluid_settings_setstr(s, b"audio.file.name", wav.encode())
fl.fluid_settings_setstr(s, b"audio.file.type", b"wav")
fl.fluid_settings_setstr(s, b"player.timing-source", b"sample")
fl.fluid_settings_setint(s, b"synth.lock-memory", 0)
fl.fluid_settings_setnum(s, b"synth.sample-rate", 44100.0)
fl.fluid_settings_setnum(s, b"synth.gain", gain)
fl.fluid_settings_setint(s, b"synth.reverb.active", 1)
fl.fluid_settings_setnum(s, b"synth.reverb.room-size", 0.8)
fl.fluid_settings_setnum(s, b"synth.reverb.width", 1.0)
fl.fluid_settings_setnum(s, b"synth.reverb.level", 0.7)

synth = fl.new_fluid_synth(s)
if fl.fluid_synth_sfload(synth, sf2.encode(), 1) < 0:
    sys.exit("failed to load soundfont")
player = fl.new_fluid_player(synth)
fl.fluid_player_add(player, mid.encode())
renderer = fl.new_fluid_file_renderer(synth)
fl.fluid_player_play(player)
while fl.fluid_player_get_status(player) == FLUID_PLAYER_PLAYING:
    if fl.fluid_file_renderer_process_block(renderer) != 0:
        break
# extra time for reverb/bell tail
for _ in range(int(0.7 * 44100 / 64)):
    fl.fluid_file_renderer_process_block(renderer)

fl.delete_fluid_file_renderer(renderer)
fl.delete_fluid_player(player)
fl.delete_fluid_synth(synth)
fl.delete_fluid_settings(s)

# Trim trailing silence, cap at max length, apply a short fade-out.
import array
import wave

MAX_SECONDS = 10.0
with wave.open(wav) as w:
    params, sr = w.getparams(), w.getframerate()
    samples = array.array("h", w.readframes(w.getnframes()))
last = len(samples) - 1
while last > 0 and abs(samples[last]) < 40:
    last -= 1
end = min(last + 1, int(MAX_SECONDS * sr) * 2)
end -= end % 2
samples = samples[:end]
fade_n = int(FADE * sr) * 2
for i in range(max(0, end - fade_n), end):
    samples[i] = int(samples[i] * ((end - i) / fade_n) ** 2)
fade_in_n = min(end, int(FADE_IN * sr) * 2)
for i in range(fade_in_n):
    samples[i] = int(samples[i] * (i / fade_in_n) ** 2)
with wave.open(wav, "wb") as w:
    w.setparams(params)
    w.writeframes(samples.tobytes())
print(f"rendered {wav} ({end / 2 / sr:.2f}s)")
