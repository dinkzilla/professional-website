"""Compose the podcast intro/outro jingle as multitrack MIDI (no dependencies).

Usage: python3 compose.py <out_dir> [waltz|sleigh68]
Writes intro.mid and outro.mid (default: waltz). Both use the same melody:
  intro = bell peal lead-in -> melody -> recedes gently (easy to talk over)
  outro = fades in under the voice -> builds -> crash -> bell peal down to D
Render to WAV with build.sh.
"""
import random
import struct
import sys
from pathlib import Path

TPB = 480  # ticks per beat
Q, E, S, H = TPB, TPB // 2, TPB // 4, TPB * 2
DH = H + Q
BAR = 3 * Q  # 3/4
BPM = 150

NOTE_BASE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def n(name):
    """'F#5' -> MIDI number. Supports # and b."""
    if isinstance(name, int):
        return name
    letter, rest = name[0], name[1:]
    acc = 0
    while rest and rest[0] in "#b":
        acc += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + NOTE_BASE[letter] + acc


def vlq(value):
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


class Track:
    def __init__(self, name, channel, program=None, volume=100, pan=64, reverb=60, chorus=0):
        self.name, self.ch = name, channel
        self.events = []  # (tick, order, bytes)
        self.meta(0, 0x03, name.encode())
        if program is not None or channel == 9:
            for num, val in ((7, volume), (10, pan), (91, reverb), (93, chorus), (11, 127)):
                self.cc(0, num, val)
        if program is not None:
            self.events.append((0, 1, bytes([0xC0 | channel, program])))

    def meta(self, tick, kind, data):
        self.events.append((tick, 0, b"\xff" + bytes([kind]) + vlq(len(data)) + data))

    def cc(self, tick, num, val):
        self.events.append((tick, 1, bytes([0xB0 | self.ch, num, max(0, min(127, int(val)))])))

    def note(self, tick, pitch, dur, vel):
        pitch = n(pitch)
        vel = max(1, min(127, int(vel)))
        self.events.append((tick, 2, bytes([0x90 | self.ch, pitch, vel])))
        self.events.append((tick + dur, 0, bytes([0x80 | self.ch, pitch, 0])))

    def chord(self, tick, pitches, dur, vel):
        for p in pitches:
            self.note(tick, p, dur, vel)

    def ramp(self, start, end, num, v0, v1, steps=24):
        for i in range(steps + 1):
            self.cc(start + (end - start) * i // steps, num, v0 + (v1 - v0) * i / steps)

    def encode(self, end_tick):
        data, last = b"", 0
        for tick, _, ev in sorted(self.events, key=lambda e: (e[0], e[1])):
            tick = min(tick, end_tick)
            data += vlq(tick - last) + ev
            last = tick
        data += vlq(end_tick - last) + b"\xff\x2f\x00"
        return b"MTrk" + struct.pack(">I", len(data)) + data


def write_midi(path, tracks, end_tick, timesig=(3, 2)):
    tempo = Track("Tempo", 0)
    tempo.meta(0, 0x51, struct.pack(">I", round(60_000_000 / BPM))[1:])
    tempo.meta(0, 0x58, bytes([timesig[0], timesig[1], 24 if timesig[1] == 2 else 36, 8]))
    body = tempo.encode(end_tick) + b"".join(t.encode(end_tick) for t in tracks)
    header = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks) + 1, TPB)
    Path(path).write_bytes(header + body)


def bar(i, beat=0.0):
    return int(i * BAR + beat * Q)


def make_tracks():
    return {
        "celesta": Track("Celesta (lead)", 0, 8, volume=118, pan=64, reverb=95),
        "piano": Track("Piano", 1, 0, volume=110, pan=56, reverb=80),
        "strings": Track("Strings", 2, 48, volume=92, pan=70, reverb=105, chorus=25),
        "violins": Track("Violins (melody)", 3, 49, volume=84, pan=44, reverb=110),
        "bass": Track("Cello/Bass", 4, 42, volume=86, pan=60, reverb=80),
        "harp": Track("Harp", 5, 46, volume=88, pan=36, reverb=100),
        "tubular": Track("Tubular Bells", 6, 14, volume=88, pan=74, reverb=115),
        "timpani": Track("Timpani", 7, 47, volume=80, pan=64, reverb=95),
        "glock": Track("Glockenspiel", 8, 9, volume=78, pan=90, reverb=100),
        "drums": Track("Sleigh Bells/Perc", 9, None, volume=92, pan=72, reverb=85),
        "flute": Track("Flute (countermelody)", 10, 73, volume=72, pan=30, reverb=105),
    }


JINGLE, CRASH, RIDE, TRIANGLE = 83, 49, 51, 81

# --- shared material (bars relative to melody start; beats are quarter notes) ---
PEAL = ["D6", "C#6", "B5", "A5", "G5", "F#5", "E5", "D5"]
LANDING = ("D2", ["D4", "E4", "F#4", "A4"], ["D3", "A3", "D4", "E4", "F#4", "A4"])  # D add9

# Harmony: descending chromatic bass line under a held D chord, then IV - iv - I.
# (bar, beat, beats, bass, string pad, harp arpeggio)
_D, _DC = ["D4", "F#4", "A4"], ["D3", "A3", "D4", "F#4", "A4", "F#4"]

METERS = {
    "waltz": dict(
        timesig=(3, 2),
        chords=[
            (0, 0, 3, "D2", _D, _DC),                                            # D
            (1, 0, 3, "C#2", _D, ["C#3"] + _DC[1:]),                              # D/C#
            (2, 0, 3, "C2", _D, ["C3"] + _DC[1:]),                                # D7/C
            (3, 0, 2, "B1", ["D4", "G4", "B4"], ["B2", "G3", "D4", "G4"]),        # G/B
            (3, 2, 1, "Bb1", ["D4", "E4", "G4"], ["Bb2", "E3"]),                  # Gm6/Bb
            (4, 0, 2, "A1", _D, ["A2", "D3", "F#3", "A3"]),                       # D/A
            (4, 2, 1, "A1", ["C#4", "E4", "G4"], ["G3", "C#4"]),                  # A7
        ],
        # (bar, beat, note, beats, velocity)
        melody=[
            (0, 0, "A5", 1, 84), (0, 1, "F#5", .5, 72), (0, 1.5, "G5", .5, 76), (0, 2, "A5", 1, 86),
            (1, 0, "D6", 1.5, 92), (1, 1.5, "C#6", .5, 78), (1, 2, "B5", 1, 82),
            (2, 0, "A5", 1, 84), (2, 1, "F#5", .5, 72), (2, 1.5, "G5", .5, 76), (2, 2, "A5", 1, 88),
            (3, 0, "B5", 2, 98), (3, 2, "Bb5", 1, 90),
            (4, 0, "A5", 2, 86), (4, 2, "G5", 1, 78),
            (5, 0, "F#5", 3, 80),
        ],
        flute=[(0, 0, "D5", 3), (1, 0, "C#5", 3), (2, 0, "C5", 3), (3, 0, "B4", 2), (3, 2, "Bb4", 1),
               (4, 0, "A4", 2), (4, 2, "C#5", 1), (5, 0, "D5", 3)],
        sleigh=[(0, 1.3), (0.5, 0.8), (1, 1.0), (1.5, 0.8), (2, 1.0), (2.5, 0.8)],  # every 8th
        peal=[(0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1)],                       # quarters
        roll_at=2,
    ),
    "sleigh68": dict(
        timesig=(6, 3),
        chords=[
            (0, 0, 3, "D2", _D, _DC),
            (1, 0, 3, "C#2", _D, ["C#3"] + _DC[1:]),
            (2, 0, 3, "C2", _D, ["C3"] + _DC[1:]),
            (3, 0, 1.5, "B1", ["D4", "G4", "B4"], ["B2", "G3", "D4"]),
            (3, 1.5, 1.5, "Bb1", ["D4", "E4", "G4"], ["Bb2", "E3", "G3"]),
            (4, 0, 1.5, "A1", _D, ["A2", "D3", "F#3"]),
            (4, 1.5, 1.5, "A1", ["C#4", "E4", "G4"], ["E3", "G3", "C#4"]),
        ],
        # long-short gallop (positions/lengths written in eighths, converted below)
        melody=[(b, e / 2, p, d / 2, v) for b, e, p, d, v in [
            (0, 0, "A5", 2, 84), (0, 2, "F#5", 1, 72), (0, 3, "G5", 2, 80), (0, 5, "A5", 1, 78),
            (1, 0, "D6", 3, 92), (1, 3, "C#6", 2, 80), (1, 5, "B5", 1, 76),
            (2, 0, "A5", 2, 84), (2, 2, "F#5", 1, 72), (2, 3, "G5", 2, 80), (2, 5, "A5", 1, 82),
            (3, 0, "B5", 3, 98), (3, 3, "Bb5", 3, 90),
            (4, 0, "A5", 3, 86), (4, 3, "G5", 3, 78),
            (5, 0, "F#5", 6, 80),
        ]],
        flute=[(0, 0, "D5", 3), (1, 0, "C#5", 3), (2, 0, "C5", 3), (3, 0, "B4", 1.5), (3, 1.5, "Bb4", 1.5),
               (4, 0, "A4", 1.5), (4, 1.5, "C#5", 1.5), (5, 0, "D5", 3)],
        sleigh=[(0, 1.3), (1, 0.85), (1.5, 1.15), (2.5, 0.85)],   # gallop: x-x x-x
        peal=[(0, 1), (1, .5), (1.5, 1), (2.5, .5), (3, 1), (4, .5)],  # D-C# B-A G-F# (long-short)
        roll_at=1.5,
    ),
}

# Glockenspiel twinkles over held melody notes: (bar, beat, notes as 16ths)
TWINKLES = [(1, 0.5, ["A6", "F#6", "D6", "A5"]), (3, 0.5, ["B6", "G6", "D6", "B5"])]


def sleigh(drums, M, start, end, v0, v1, rng):
    """Sleigh bells in the meter's pattern, crescendo/decrescendo v0->v1."""
    b = start // BAR
    while bar(b) < end:
        for beat, acc in M["sleigh"]:
            t = bar(b, beat)
            if start <= t < end:
                v = v0 + (v1 - v0) * (t - start) / max(1, end - start)
                drums.note(t, JINGLE, E, v * acc + rng.uniform(-5, 5))
        b += 1


def cymbal_swell(drums, start, end, v0=20, v1=75):
    steps = (end - start) // (S // 2)
    for i in range(steps):
        drums.note(start + i * (S // 2), RIDE, S // 2, v0 + (v1 - v0) * i / steps)


def harp_gliss(harp, start, dur, lo="D4", hi="D6"):
    scale, base = [0, 2, 4, 5, 7, 9, 11], n(lo)
    notes, i = [], 0
    while True:
        octave, idx = divmod(i, 7)
        p = base + 12 * octave + scale[idx]
        if p > n(hi):
            break
        notes.append(p)
        i += 1
    step = dur // len(notes)
    for i, p in enumerate(notes):
        harp.note(start + i * step, p, Q, 45 + 40 * i / len(notes))


def peal(T, start, times, vel=90, notes=PEAL):
    """times: [(beat, beats)] relative to start."""
    for i, ((beat, beats), p) in enumerate(zip(times, notes)):
        t = start + int(beat * Q)
        T["tubular"].note(t, n(p) - 12, BAR * 2, vel - i * 2)
        T["glock"].note(t, p, int(beats * Q), vel - 10 - i * 2)


def melody(T, M, at, shape=lambda b: 1.0, twinkles=True):
    """Celesta lead, piano body in octaves, violins an octave below, glock sparkle,
    flute countermelody. shape(bar) scales velocity."""
    for b, beat, p, beats, v in M["melody"]:
        t, d, v = at + bar(b, beat), int(beats * Q), v * shape(b)
        T["celesta"].note(t, p, d, v + 8)
        T["piano"].note(t, p, d, v - 22)
        T["piano"].note(t, n(p) - 12, d, v - 28)
        if b >= 1:
            T["violins"].note(t, n(p) - 12, d, v - 10)
        if b <= 3:
            T["glock"].note(t, p, min(d, Q), v - 42)
    for b, beat, p, beats in M["flute"]:
        T["flute"].note(at + bar(b, beat), p, int(beats * Q), 72 * shape(b))
    T["flute"].ramp(at, at + bar(3), 11, 70, 115)
    if twinkles:
        for b, beat, notes in TWINKLES:
            for i, p in enumerate(notes):
                T["glock"].note(at + bar(b, beat) + i * S, p, E, (58 - i * 4) * shape(b))


def harmony(T, M, at, shape=lambda b: 1.0, landing_beats=3):
    prev_bass = None
    for b, beat, beats, bass, pad, arp in M["chords"]:
        t, s, d = at + bar(b, beat), shape(b), int(beats * Q)
        if bass != prev_bass or beat == 0:
            T["bass"].note(t, bass, d, 82 * s)
        prev_bass = bass
        T["strings"].chord(t, pad, d, 80 * s)
        for i, p in enumerate(arp):
            T["harp"].note(t + i * E, p, Q + E, (62 - (i % 3) * 4) * s)
        T["piano"].cc(max(0, t - 10), 64, 0)
        T["piano"].cc(t + 15, 64, 127)
    bass, pad, arp = LANDING
    t, s = at + bar(5), shape(5)
    T["bass"].note(t, bass, landing_beats * Q, 80 * s)
    T["strings"].chord(t, pad, landing_beats * Q, 80 * s)
    for i, p in enumerate(arp):
        T["harp"].note(t + i * (E // 2), p, BAR * 2, 60 * s)
    T["piano"].cc(t - 10, 64, 0)
    T["piano"].cc(t + 15, 64, 127)


# ---------------------------------------------------------------- intro
def intro(M, path):
    """Bells ring in -> melody at full warmth -> recedes gently (easy to talk over)."""
    rng = random.Random(7)
    T = make_tracks()
    # Bars 0-1: bell peal over a swelling D chord, sleigh bells building.
    peal(T, 0, M["peal"])
    T["strings"].chord(0, ["D3", "A3", "F#4"], 2 * BAR, 80)
    T["strings"].ramp(0, 2 * BAR, 11, 25, 85)
    T["bass"].note(0, "D2", 2 * BAR, 60)
    T["bass"].ramp(0, 2 * BAR, 11, 30, 95)
    sleigh(T["drums"], M, 0, 2 * BAR, 30, 72, rng)
    cymbal_swell(T["drums"], bar(1), bar(2), 10, 45)
    harp_gliss(T["harp"], bar(1, 1.5), int(1.5 * Q))
    roll = bar(1, M["roll_at"])
    for i in range(6):
        T["timpani"].note(roll + i * (bar(2) - roll) // 6, "A1", (bar(2) - roll) // 6, 30 + i * 6)
    T["timpani"].note(bar(2), "D2", Q, 70)
    T["drums"].note(bar(2), CRASH, BAR * 2, 45)  # arrival of the melody

    # Bars 2-7: melody. Full through the peak (bar 3), then eases off.
    at = bar(2)
    recede = lambda b: {4: 0.85, 5: 0.7}.get(b, 1.0)
    melody(T, M, at, recede)
    harmony(T, M, at, recede)
    for tr in (T["strings"], T["violins"]):
        tr.ramp(at, at + bar(3), 11, 88, 110)
        tr.ramp(at + bar(4), at + bar(6), 11, 110, 45)
    T["flute"].ramp(at + bar(4), at + bar(6), 11, 115, 50)
    T["bass"].ramp(at + bar(4), at + bar(6), 11, 95, 50)
    sleigh(T["drums"], M, at, at + bar(4), 64, 60, rng)
    sleigh(T["drums"], M, at + bar(4), at + bar(5), 45, 22, rng)
    end = at + bar(5)
    for i, p in enumerate(["D6", "C#6", "B5", "A5"]):  # quiet echo of the bells
        T["glock"].note(end + bar(0, 1) + i * E, p, Q, 44 - i * 3)
    T["tubular"].note(end, "D4", BAR * 2, 44)
    T["drums"].note(end, TRIANGLE, BAR, 28)
    write_midi(path, list(T.values()), end + BAR, M["timesig"])  # 8 bars = 9.6s


# ---------------------------------------------------------------- outro
def outro(M, path):
    """Melody fades in under the voice, builds, lands with a crash, bells peal down."""
    rng = random.Random(11)
    T = make_tracks()
    build = lambda b: {0: 0.7, 1: 0.8, 2: 0.9}.get(b, 1.0)
    melody(T, M, 0, build)
    harmony(T, M, 0, build, landing_beats=9)
    for tr in (T["strings"], T["violins"]):
        tr.ramp(0, bar(3), 11, 45, 112)
        tr.ramp(bar(3), bar(5), 11, 112, 118)
    sleigh(T["drums"], M, 0, bar(5), 35, 74, rng)
    cymbal_swell(T["drums"], bar(4), bar(5), 15, 60)

    land = bar(5)
    T["drums"].note(land, CRASH, BAR * 2, 62)
    T["timpani"].note(land, "D2", H, 85)
    T["drums"].note(land, JINGLE, Q, 95)
    # Full peal down the scale: D C# B A G F# in 8ths, then E ... and home to D.
    peal(T, land + E, [(i * 0.5, 0.5) for i in range(6)] + [(3, 1)], vel=84, notes=PEAL[:7])
    home = land + BAR + Q
    T["tubular"].note(home, "D4", BAR * 2, 80)
    T["glock"].chord(home, ["D5", "D6"], DH, 70)
    T["celesta"].chord(home, ["D5", "D6"], DH, 76)
    T["piano"].chord(home, ["D5", "D4"], DH, 66)
    for tr in (T["strings"], T["violins"], T["bass"], T["flute"]):
        tr.ramp(land, home + BAR, 11, 115, 30)
    sleigh(T["drums"], M, land, land + BAR, 60, 25, rng)
    T["drums"].note(home, TRIANGLE, BAR, 46)
    write_midi(path, list(T.values()), land + 3 * BAR, M["timesig"])  # 8 bars = 9.6s


if __name__ == "__main__":
    out = Path(sys.argv[1])
    meter = sys.argv[2] if len(sys.argv) > 2 else "waltz"  # or "sleigh68"
    out.mkdir(parents=True, exist_ok=True)
    intro(METERS[meter], out / "intro.mid")
    outro(METERS[meter], out / "outro.mid")
    print("wrote", out / "intro.mid", out / "outro.mid", f"({meter})")
