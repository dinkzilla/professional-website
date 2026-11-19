// Where the fixed things in the room are, for the objects that are made to fit them.

// The rack the objects go in, in world units (one is about half a metre): its width inside, between
// the posts; its depth, front to back; and the thickness of its shelves. They are here because
// some of the objects are made to fit it.
/** In place of a shelf number: pinned to the wall (see Placement). */
export const WALL = -1;
/** In place of a shelf number: on the floor under the rack, between its legs. */
export const FLOOR = -2;
// The board on the wall that the fliers are pinned to: its edges along the wall, and above the
// floor. Its right end is behind the rack, so that some of it shows where the window is only as
// wide as the rack. The heights are as it was laid out: it is hung with its top level with the top
// of the door's opening, which is as high as the rack and what stands on it, so the board and
// everything pinned to it are moved up or down together by the difference (`lift` in room.ts).
export const PINBOARD = { left: -1.7, right: 0, bottom: 1.21, top: 2.4 };

// The middle one of the three hooks by the door, which the tie hangs on (they are built in
// room.ts): where along the wall, and how far above the floor.
export const HOOK = { x: 0.99, y: 2.08 };

export const RACK_WIDTH = 1.1;
export const RACK_DEPTH = 0.7;
export const BOARD = 0.05;
// How far the back of the rack stands off the wall: clear of the pinboard, which runs behind it,
// with room for the cable that goes down behind the tv, and for a flier behind it to come forward
// under the pointer, pin and all.
export const STANDOFF = 0.14;
/** How far off the wall something pinned to it or hung on it is. */
export const WALL_OFF = 0.034;
/** The backs of the rack's posts, from the wall: they stand a touch proud of its shelves. */
export const RACK_BACK = STANDOFF - 0.005;
export const LEGS = 0.24; // how far the posts carry on below the bottom shelf, down to the floor

// The amp on the floor under the pinboard (built in room.ts): where along the wall its middle is,
// its size, and how far it stands off the wall. Its input jack is on its front, given here from
// the floor at the foot of the wall, because the cable plugged into the cassette player ends there.
export const AMP = { x: -1.22, w: 1.2, h: 1, d: 0.5, gap: 0.06 };
// It is level with the knobs: the middle of the strip they are on (see room.ts).
export const AMP_JACK = { x: AMP.x + 0.42, y: AMP.h - 0.16, z: AMP.gap + AMP.d };
