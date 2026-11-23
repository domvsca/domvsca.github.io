/*
 * Rods and nodes.
 *
 * A small structure of rods and round nodes. Nodes are point masses and rods
 * are distance constraints. Normally it hangs from a thread and every node is
 * pulled gently back to where the markup drew it: scrolling the page twists
 * it, a tap pushes it, and a sideways drag moves one node. With
 * data-free="on" on the figure it has no thread: it floats over the whole
 * first screen, behind the text, and can be pushed and thrown. With
 * data-free="fall" it also has weight: it drops, tips over and comes to rest.
 *
 * No dependencies and no build step. The geometry lives in the page's SVG:
 * this script reads the rest pose from data attributes and moves those same
 * elements, so without it the drawing simply stays still.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.RodsAndNodes = api;
    if (root.document) api.autoMount(root);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '0.4.0';

  var CONFIG = Object.freeze({
    step: 1 / 120,          // seconds per simulation step, whatever the screen rate
    maxStepsPerFrame: 4,    // cap on the time recovered after a slow frame or a pause
    iterations: 10,         // constraint passes per step, at least: a structure with many nodes takes more
    restPull: 30,           // 1/s^2: how hard a node is pulled to its rest position
    damping: 3.4,           // 1/s
    cameraPitch: 0.22,      // radians: the viewer looks slightly from above
    focal: 620,             // viewBox units: larger means flatter perspective
    twistPerScroll: 0.018,  // twist drive per px/s of page scroll
    maxTwist: 22,           // must stay below restPull, or the structure never settles
    swingPerScroll: 0.3,    // push away from the viewer per px/s of page scroll
    maxSwing: 520,
    reach: 85,              // how far a held node may leave its rest position
    holdSpeed: 700,         // units/s a held node may travel toward the pointer
    sleepSpeed: 3,          // units/s
    sleepOffset: 0.5,       // units: under half a pixel on screen
    sleepAfter: 0.35,       // seconds under both thresholds before stopping
    faceMin: 0.14,          // opacity of a face that catches no light
    faceRange: 0.6,         // added for a face turned fully to the light
    shineAt: 0.34,          // highlight on a node: offset up and left, in radii
    shineSize: 0.27,        // and its size, in radii

    // Idle motion, when the figure asks for it with data-idle.
    idleTwist: 4.5,         // "vivo": a slow turn back and forth
    idleSwing: 70,
    idleSpin: 0.35,         // "giro": radians per second
    idleLean: 0.07,         // "pendolo": radians to each side
    idleLook: 0.7,          // "segue": radians turned toward the pointer

    // A floating structure: no thread and no rest position.
    floatDamping: 0.6,      // 1/s: a push glides for a few seconds
    floatWall: 160,         // 1/s^2: how hard an edge of its area pushes the whole structure back
    floatEdge: 50,          // 1/s^2: and, on top, each node that has crossed it: this is what makes it tumble
    floatWallDamping: 12,   // 1/s: what an edge takes from the speed of the whole structure toward it
    floatGrip: 9,           // 1/s more, along an edge, for a node pressed against it: it rolls, not slides
    floatLevel: 5,          // 1/s^2: keeps it at the depth of the page
    floatScroll: 0.06,      // the share of the scroll twist it takes
    floatSink: 0.1,         // units/s^2 per px/s of scroll: it lags behind the page
    maxSink: 160,
    floatWind: 14,          // units/s^2: its drift in idle motion
    floatTurn: 0.22,        // 1/s^2: its turning in idle motion
    fallGravity: 700,       // units/s^2: the weight of a structure that falls instead of floating
    fallFloor: 2500         // 1/s^2: how hard an edge pushes back each node of a structure with weight
  });

  var COS = Math.cos(CONFIG.cameraPitch);
  var SIN = Math.sin(CONFIG.cameraPitch);

  /* World point to screen point. `depth` grows away from the viewer. */
  function project(x, y, z) {
    var yv = y * COS - z * SIN;
    var zv = y * SIN + z * COS;
    var scale = CONFIG.focal / (CONFIG.focal + zv);
    return { x: x * scale, y: yv * scale, scale: scale, depth: zv };
  }

  /* Screen point at a known depth back to a world point. */
  function unproject(sx, sy, depth) {
    var scale = CONFIG.focal / (CONFIG.focal + depth);
    var yv = sy / scale;
    return { x: sx / scale, y: yv * COS + depth * SIN, z: depth * COS - yv * SIN };
  }

  // Light falls from the upper left, in front of the drawing.
  var LIGHT = (function () {
    var x = 0.35, y = 0.55, z = 0.76;
    var length = Math.sqrt(x * x + y * y + z * z);
    return [x / length, y / length, z / length];
  })();

  /*
   * Opacity for a flat face, from three of its corners: more when it is
   * turned to the light, zero when it faces away from the viewer. The corners
   * are world points, listed so that the face's normal points out of the solid.
   */
  function faceOpacity(ax, ay, az, bx, by, bz, cx, cy, cz) {
    var ayv = ay * COS - az * SIN, azv = ay * SIN + az * COS;
    var byv = by * COS - bz * SIN, bzv = by * SIN + bz * COS;
    var cyv = cy * COS - cz * SIN, czv = cy * SIN + cz * COS;
    var ux = bx - ax, uy = byv - ayv, uz = bzv - azv;
    var vx = cx - ax, vy = cyv - ayv, vz = czv - azv;
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    var length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    // The viewer sits at depth -focal, looking along the depth axis.
    if (length === 0 || nx * ax + ny * ayv + nz * (azv + CONFIG.focal) >= 0) return 0;
    var lit = Math.max(0, -(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / length);
    return CONFIG.faceMin + CONFIG.faceRange * lit;
  }

  function clamp(value, limit) {
    return value > limit ? limit : value < -limit ? -limit : value;
  }

  /*
   * The simulation. `shape.nodes` is a list of { x, y, z, pinned }, and
   * `shape.rods` a list of { a, b } node indices. `shape.floating` is true
   * for a structure with no rest position. It knows nothing about the page,
   * so it runs the same under Node for the tests.
   */
  function createSim(shape) {
    var count = shape.nodes.length;
    var floating = !!shape.floating;
    var gravity = floating ? shape.gravity || 0 : 0;
    // The more nodes, the more passes it takes for a push to cross the structure.
    var passes = Math.max(CONFIG.iterations, Math.round(count * 0.7));
    var pos = new Float64Array(count * 3);
    var prev = new Float64Array(count * 3);
    var rest = new Float64Array(count * 3);
    var free = new Uint8Array(count);

    shape.nodes.forEach(function (node, i) {
      rest[i * 3] = node.x;
      rest[i * 3 + 1] = node.y;
      rest[i * 3 + 2] = node.z;
      free[i] = node.pinned ? 0 : 1;
    });
    pos.set(rest);
    prev.set(rest);
    // The pose as drawn. `rest` starts there and can be turned away from it.
    var drawn = new Float64Array(rest);

    var rods = shape.rods.map(function (rod) {
      var a = rod.a * 3;
      var b = rod.b * 3;
      var dx = rest[b] - rest[a];
      var dy = rest[b + 1] - rest[a + 1];
      var dz = rest[b + 2] - rest[a + 2];
      return {
        a: rod.a,
        b: rod.b,
        length: Math.sqrt(dx * dx + dy * dy + dz * dz),
        // A rod with one fixed end is a thread: it can pull but not push.
        thread: free[rod.a] !== free[rod.b]
      };
    });

    // The rest of the structure is rigid, so each thread limits how far any
    // node can be pulled from the point it hangs from.
    var tethers = [];
    rods.forEach(function (rod) {
      if (rod.thread) {
        tethers.push({
          pin: free[rod.a] ? rod.b : rod.a,
          end: free[rod.a] ? rod.a : rod.b,
          length: rod.length
        });
      }
    });

    /* The middle of the free nodes, written into `out`. */
    function middle(out) {
      var x = 0, y = 0, z = 0, n = 0;
      for (var i = 0; i < count; i++) {
        if (!free[i]) continue;
        x += pos[i * 3];
        y += pos[i * 3 + 1];
        z += pos[i * 3 + 2];
        n++;
      }
      out[0] = x / n;
      out[1] = y / n;
      out[2] = z / n;
      return out;
    }

    // What a turned rest pose turns about: the point the structure hangs
    // from, or its own middle.
    var pivot = tethers.length
      ? [rest[tethers[0].pin * 3], rest[tethers[0].pin * 3 + 1], rest[tethers[0].pin * 3 + 2]]
      : middle([0, 0, 0]);

    var held = -1;
    var target = [0, 0, 0];
    var twist = 0;
    var swing = 0;
    var windX = 0;
    var windY = 0;
    var roll = 0;
    var sink = 0;
    var posed = false;
    var box = null;
    var mid = [0, 0, 0];
    var loose = 0;       // seconds left of an entrance in which the rods are still slack
    var looseFor = 1;
    var homing = 0;      // seconds left of an entrance in which even a floating structure is pulled home
    var carry = 0;
    var quiet = 0;
    var steps = 0;

    function reset() {
      rest.set(drawn);
      pos.set(rest);
      prev.set(rest);
      held = -1;
      twist = swing = windX = windY = roll = sink = 0;
      loose = homing = 0;
      posed = false;
      carry = 0;
      quiet = 0;
    }

    function moveHeld(h) {
      var o = held * 3;
      var dx = target[0] - pos[o];
      var dy = target[1] - pos[o + 1];
      var dz = target[2] - pos[o + 2];
      var gap = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var most = CONFIG.holdSpeed * h;
      var part = gap > most ? most / gap : 1;
      prev[o] = pos[o];
      prev[o + 1] = pos[o + 1];
      prev[o + 2] = pos[o + 2];
      pos[o] += dx * part;
      pos[o + 1] += dy * part;
      pos[o + 2] += dz * part;
    }

    /* One pass over the rods. `share` is how much of each error is corrected: 1 for rigid rods. */
    function solveRods(share) {
      for (var r = 0; r < rods.length; r++) {
        var rod = rods[r];
        var wa = free[rod.a] && rod.a !== held ? 1 : 0;
        var wb = free[rod.b] && rod.b !== held ? 1 : 0;
        if (wa + wb === 0) continue;
        var a = rod.a * 3;
        var b = rod.b * 3;
        var dx = pos[b] - pos[a];
        var dy = pos[b + 1] - pos[a + 1];
        var dz = pos[b + 2] - pos[a + 2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d === 0 || (rod.thread && d <= rod.length)) continue;
        var fix = (d - rod.length) / d / (wa + wb) * share;
        pos[a] += dx * fix * wa;
        pos[a + 1] += dy * fix * wa;
        pos[a + 2] += dz * fix * wa;
        pos[b] -= dx * fix * wb;
        pos[b + 1] -= dy * fix * wb;
        pos[b + 2] -= dz * fix * wb;
      }
    }

    /* How far a value is outside a range: positive below it, negative above. */
    function outside(value, low, high) {
      return clamp(value < low ? low - value : value > high ? high - value : 0, 80);
    }

    function step() {
      var h = CONFIG.step;
      var h2 = h * h;
      // During an entrance even a floating structure is pulled to the pose it was drawn in.
      var guided = homing > 0;
      // While the rods are slack the nodes glide home without overshooting,
      // so none is caught on the wrong side of the others when they tighten.
      var drag = loose > 0 ? 2 * Math.sqrt(CONFIG.restPull) : floating && !guided ? CONFIG.floatDamping : CONFIG.damping;
      var keep = Math.exp(-drag * h);
      var keepGrip = Math.exp(-(CONFIG.floatDamping + CONFIG.floatGrip) * h);
      var pull = floating && !guided ? 0 : CONFIG.restPull;
      // A hung structure turns about its thread, a floating one about its middle.
      if (floating) middle(mid);

      // The edges of the floating area push on the structure as a whole, by
      // as much as its outermost node has crossed them.
      var edgeX = 0;
      var edgeY = 0;
      if (floating && box) {
        var lowX = Infinity, highX = -Infinity, lowY = Infinity, highY = -Infinity;
        var movedX = 0, movedY = 0;
        for (var n = 0; n < count; n++) {
          lowX = Math.min(lowX, pos[n * 3]);
          highX = Math.max(highX, pos[n * 3]);
          lowY = Math.min(lowY, pos[n * 3 + 1]);
          highY = Math.max(highY, pos[n * 3 + 1]);
          movedX += pos[n * 3] - prev[n * 3];
          movedY += pos[n * 3 + 1] - prev[n * 3 + 1];
        }
        var acrossX = outside(lowX, box[0], Infinity) + outside(highX, -Infinity, box[1]);
        var acrossY = outside(lowY, box[2], Infinity) + outside(highY, -Infinity, box[3]);
        // A structure with weight is held up only where it touches, or it
        // would balance on a point; so the push on the whole is left out and
        // the one on each node is made strong enough to carry it.
        edgeX = gravity ? 0 : CONFIG.floatWall * acrossX;
        edgeY = gravity ? 0 : CONFIG.floatWall * acrossY;
        // An edge it touches also takes away the speed of the whole structure
        // toward it, but not its turning: it lands without bouncing like a
        // ball, and can still tip over and roll.
        if (acrossX !== 0) edgeX -= CONFIG.floatWallDamping * movedX / count / h;
        if (acrossY !== 0) edgeY -= CONFIG.floatWallDamping * movedY / count / h;
      }
      var nodeEdge = gravity ? CONFIG.fallFloor * count / 12 : CONFIG.floatEdge;

      for (var i = 0; i < count; i++) {
        if (!free[i] || i === held) continue;
        var o = i * 3;
        var x = pos[o];
        var y = pos[o + 1];
        var z = pos[o + 2];
        var ax = pull * (rest[o] - x) - twist * (z - mid[2]) + windX;
        var ay = pull * (rest[o + 1] - y) - roll * (z - mid[2]) + windY + sink;
        var az = pull * (rest[o + 2] - z) + twist * (x - mid[0]) + roll * (y - mid[1]) + swing;
        var kx = keep;
        var ky = keep;
        var kz = keep;
        if (floating) {
          if (box) {
            var overX = outside(x, box[0], box[1]);
            var overY = outside(y, box[2], box[3]);
            ax += edgeX + nodeEdge * overX;
            ay += edgeY + nodeEdge * overY;
            // A node pressed against an edge is held back along it.
            if (overY !== 0) kx = kz = keepGrip;
            if (overX !== 0) ky = kz = keepGrip;
          }
          az -= CONFIG.floatLevel * mid[2];
          if (!guided) ay += gravity;
        }
        pos[o] = x + (x - prev[o]) * kx + ax * h2;
        pos[o + 1] = y + (y - prev[o + 1]) * ky + ay * h2;
        pos[o + 2] = z + (z - prev[o + 2]) * kz + az * h2;
        prev[o] = x;
        prev[o + 1] = y;
        prev[o + 2] = z;
      }

      // While the structure assembles the rods are slack, and tighten only
      // at the end, when every node is close to its place.
      var share = 1;
      if (loose > 0) {
        loose -= h;
        var done = Math.max(0, (0.3 - Math.max(loose, 0) / looseFor) / 0.3);
        share = 1 - Math.pow(1 - done * done, 1 / passes);
      }
      if (homing > 0) homing -= h;

      if (held >= 0) moveHeld(h);
      for (var k = 0; k < passes; k++) solveRods(share);

      for (var c = 0; c < pos.length; c++) {
        if (!isFinite(pos[c])) {
          reset();
          return;
        }
      }
      steps++;
    }

    /* Runs whole steps for the time that passed. Returns how many ran. */
    function advance(seconds) {
      var most = CONFIG.maxStepsPerFrame * CONFIG.step;
      carry = Math.min(carry + Math.max(seconds, 0), most);
      var ran = 0;
      while (carry >= CONFIG.step) {
        step();
        carry -= CONFIG.step;
        ran++;
      }
      return ran;
    }

    function measure() {
      var speed = 0;
      var offset = 0;
      for (var i = 0; i < count; i++) {
        if (!free[i]) continue;
        var o = i * 3;
        var vx = pos[o] - prev[o];
        var vy = pos[o + 1] - prev[o + 1];
        var vz = pos[o + 2] - prev[o + 2];
        var dx = pos[o] - rest[o];
        var dy = pos[o + 1] - rest[o + 1];
        var dz = pos[o + 2] - rest[o + 2];
        speed = Math.max(speed, Math.sqrt(vx * vx + vy * vy + vz * vz) / CONFIG.step);
        offset = Math.max(offset, Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
      return { speed: speed, offset: offset };
    }

    /* Largest relative length error over all rods. */
    function strain() {
      var worst = 0;
      for (var r = 0; r < rods.length; r++) {
        var a = rods[r].a * 3;
        var b = rods[r].b * 3;
        var dx = pos[b] - pos[a];
        var dy = pos[b + 1] - pos[a + 1];
        var dz = pos[b + 2] - pos[a + 2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var error = rods[r].thread ? Math.max(0, d - rods[r].length) : Math.abs(d - rods[r].length);
        worst = Math.max(worst, error / rods[r].length);
      }
      return worst;
    }

    /*
     * Call once per frame with the frame time. Returns true when the
     * structure has been still long enough to stop drawing. A hung structure
     * is then snapped exactly onto its rest pose; a floating one stays where
     * it stopped.
     */
    function settle(seconds) {
      var now = measure();
      var driven = posed || twist !== 0 || swing !== 0 || windX !== 0 || windY !== 0 || roll !== 0 || sink !== 0;
      var still = held < 0 && !driven && loose <= 0 && homing <= 0 && now.speed < CONFIG.sleepSpeed &&
        (floating || now.offset < CONFIG.sleepOffset);
      quiet = still ? quiet + seconds : 0;
      // Something with weight may be still for a moment while it tips over: it waits longer.
      if (quiet < CONFIG.sleepAfter * (gravity ? 3 : 1)) return false;
      if (floating) {
        prev.set(pos);
      } else {
        pos.set(rest);
        prev.set(rest);
      }
      carry = 0;
      return true;
    }

    /* Changes a node's velocity, in units per second. */
    function kick(i, vx, vy, vz) {
      if (!free[i]) return;
      var o = i * 3;
      prev[o] -= vx * CONFIG.step;
      prev[o + 1] -= vy * CONFIG.step;
      prev[o + 2] -= vz * CONFIG.step;
      quiet = 0;
    }

    return {
      pos: pos,
      rest: rest,
      rods: rods,
      count: count,
      floating: floating,
      step: step,
      advance: advance,
      measure: measure,
      strain: strain,
      settle: settle,
      reset: reset,
      kick: kick,
      middle: middle,
      steps: function () { return steps; },

      /*
       * Scroll speed in px/s, signed: positive when the page moves down.
       * The two extras add a turn and a push of their own, for idle motion.
       */
      drive: function (scrollSpeed, extraTwist, extraSwing) {
        var moving = Math.abs(scrollSpeed) >= 1;
        var turn = moving ? clamp(scrollSpeed * CONFIG.twistPerScroll, CONFIG.maxTwist) : 0;
        var push = moving ? clamp(scrollSpeed * CONFIG.swingPerScroll, CONFIG.maxSwing) : 0;
        // A floating structure turns less, and sinks a little instead of swinging.
        twist = (floating ? turn * CONFIG.floatScroll : turn) + (extraTwist || 0);
        swing = (floating ? 0 : push) + (extraSwing || 0);
        sink = floating && moving ? clamp(scrollSpeed * CONFIG.floatSink, CONFIG.maxSink) : 0;
      },

      /* A steady push across the page, and a tumble about the horizontal axis. */
      blow: function (x, y, tumble) {
        windX = x || 0;
        windY = y || 0;
        roll = tumble || 0;
      },

      /* The area a floating structure stays in. */
      confine: function (minX, maxX, minY, maxY) {
        box = [minX, maxX, minY, maxY];
      },

      /*
       * Turns the rest pose itself: `turn` about the vertical line through
       * the point the structure hangs from, then `lean` about that point,
       * like a pendulum. The nodes follow.
       */
      pose: function (turn, lean) {
        posed = turn !== 0 || lean !== 0;
        var ct = Math.cos(turn), st = Math.sin(turn);
        var cl = Math.cos(lean), sl = Math.sin(lean);
        for (var i = 0; i < count; i++) {
          if (!free[i]) continue;
          var o = i * 3;
          var x = drawn[o] - pivot[0];
          var y = drawn[o + 1] - pivot[1];
          var z = drawn[o + 2] - pivot[2];
          var tx = x * ct - z * st;
          rest[o] = pivot[0] + tx * cl - y * sl;
          rest[o + 1] = pivot[1] + tx * sl + y * cl;
          rest[o + 2] = pivot[2] + x * st + z * ct;
        }
      },

      /*
       * An entrance: the nodes start scattered within `amount` of their
       * places and come together over `seconds`, as the rods tighten.
       */
      scatter: function (amount, seconds) {
        for (var i = 0; i < count; i++) {
          if (!free[i]) continue;
          var o = i * 3;
          var angle = Math.random() * 2 * Math.PI;
          var up = Math.random() * 2 - 1;
          var flat = Math.sqrt(1 - up * up);
          var far = amount * Math.cbrt(Math.random());
          pos[o] = prev[o] = rest[o] + far * flat * Math.cos(angle);
          pos[o + 1] = prev[o + 1] = rest[o + 1] + far * up;
          pos[o + 2] = prev[o + 2] = rest[o + 2] + far * flat * Math.sin(angle);
        }
        loose = looseFor = seconds;
        homing = seconds * 1.6;
        quiet = 0;
      },

      /* An entrance: the structure starts `height` above its place and comes down to it. */
      drop: function (height, seconds) {
        for (var i = 0; i < count; i++) {
          if (!free[i]) continue;
          var o = i * 3;
          pos[o] = prev[o] = rest[o];
          pos[o + 1] = prev[o + 1] = rest[o + 1] - height;
          pos[o + 2] = prev[o + 2] = rest[o + 2];
        }
        homing = seconds;
        quiet = 0;
      },

      /* Gives every free node the same velocity. */
      push: function (vx, vy, vz) {
        for (var i = 0; i < count; i++) kick(i, vx, vy, vz);
      },

      /* Sets the structure turning about the vertical, in radians per second. */
      spin: function (rate) {
        if (floating) middle(mid);
        for (var i = 0; i < count; i++) {
          kick(i, -rate * (pos[i * 3 + 2] - mid[2]), 0, rate * (pos[i * 3] - mid[0]));
        }
      },

      hold: function (i) {
        if (!free[i]) return;
        held = i;
        target[0] = pos[i * 3];
        target[1] = pos[i * 3 + 1];
        target[2] = pos[i * 3 + 2];
        quiet = 0;
      },

      /*
       * Where the held node should go. A floating structure follows it
       * anywhere. A hung one keeps the node within reach of its rest
       * position, and no farther from a fixed point than a taut thread
       * allows: asking for more would only stretch the rods.
       */
      moveTo: function (x, y, z) {
        if (held < 0) return;
        if (floating) {
          target[0] = x;
          target[1] = y;
          target[2] = z;
          return;
        }
        var o = held * 3;
        var dx = x - rest[o];
        var dy = y - rest[o + 1];
        var dz = z - rest[o + 2];
        var far = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var part = far > CONFIG.reach ? CONFIG.reach / far : 1;
        target[0] = rest[o] + dx * part;
        target[1] = rest[o + 1] + dy * part;
        target[2] = rest[o + 2] + dz * part;

        for (var t = 0; t < tethers.length; t++) {
          var p = tethers[t].pin * 3;
          var j = tethers[t].end * 3;
          var chord = Math.sqrt(
            (rest[o] - rest[j]) * (rest[o] - rest[j]) +
            (rest[o + 1] - rest[j + 1]) * (rest[o + 1] - rest[j + 1]) +
            (rest[o + 2] - rest[j + 2]) * (rest[o + 2] - rest[j + 2]));
          var most = (tethers[t].length + chord) * 0.995;
          var tx = target[0] - rest[p];
          var ty = target[1] - rest[p + 1];
          var tz = target[2] - rest[p + 2];
          var out = Math.sqrt(tx * tx + ty * ty + tz * tz);
          if (out > most) {
            target[0] = rest[p] + tx * most / out;
            target[1] = rest[p + 1] + ty * most / out;
            target[2] = rest[p + 2] + tz * most / out;
          }
        }
      },

      release: function () { held = -1; },
      held: function () { return held; }
    };
  }

  /* Reads the structure the page drew and brings it to life. */
  function mount(figure, win) {
    var doc = figure.ownerDocument;
    var svg = figure.querySelector('svg');
    var group = svg && svg.querySelector('.pieces');
    if (!svg || !group || figure.getAttribute('data-element') !== 'on') return null;

    var circles = Array.prototype.slice.call(svg.querySelectorAll('circle[data-id]'));
    var rodEls = Array.prototype.slice.call(svg.querySelectorAll('g[data-a][data-b]'));
    var threadEl = svg.querySelector('line[data-anchor]');
    if (!circles.length) return null;

    // data-free="on": no thread, and the whole first screen to move in.
    // data-free="fall": the same, but with weight: it falls, bounces and rests.
    var freedom = figure.getAttribute('data-free');
    var stage = freedom === 'on' || freedom === 'fall'
      ? (figure.closest && figure.closest('header')) || figure.parentNode
      : null;
    var floating = !!stage;
    var weighty = freedom === 'fall';
    // data-enter: how it first appears. "giro" (a small turn), "monta", "cala" or "none".
    var entrance = figure.getAttribute('data-enter') || 'giro';
    var idle = figure.getAttribute('data-idle') || '';
    if (idle === 'on') idle = 'vivo';

    var indexOf = {};
    var nodes = circles.map(function (circle, i) {
      indexOf[circle.getAttribute('data-id')] = i;
      return {
        x: +circle.getAttribute('data-x'),
        y: +circle.getAttribute('data-y'),
        z: +circle.getAttribute('data-z'),
        pinned: false
      };
    });
    var count = nodes.length;
    var rodDefs = rodEls.map(function (el) {
      return { a: indexOf[el.getAttribute('data-a')], b: indexOf[el.getAttribute('data-b')] };
    });
    // Hidden braces: they keep shapes with square or open faces from folding.
    var simRods = rodDefs.concat((svg.getAttribute('data-braces') || '').split(/\s+/).filter(Boolean).map(function (text) {
      var ends = text.split('-');
      return { a: indexOf[ends[0]], b: indexOf[ends[1]] };
    }));

    // The thread is one more rod, tied to a fixed point above the drawing.
    var hung = -1;
    if (threadEl && floating) {
      threadEl.parentNode.removeChild(threadEl);
      threadEl = null;
    }
    if (threadEl) {
      var anchor = threadEl.getAttribute('data-anchor').split(/\s+/).map(Number);
      hung = indexOf[threadEl.getAttribute('data-node')];
      nodes.push({ x: anchor[0], y: anchor[1], z: anchor[2], pinned: true });
      simRods.push({ a: nodes.length - 1, b: hung });
    }

    var sim = createSim({ nodes: nodes, rods: simRods, floating: floating, gravity: weighty ? CONFIG.fallGravity : 0 });
    var nodeRadius = +svg.getAttribute('data-node-r');
    var rodWidth = +svg.getAttribute('data-rod-w');
    var caseWidth = +svg.getAttribute('data-case-w');
    var depthSpan = +svg.getAttribute('data-depth');
    var home = {
      x: svg.viewBox.baseVal.x,
      y: svg.viewBox.baseVal.y,
      width: svg.viewBox.baseVal.width,
      height: svg.viewBox.baseVal.height
    };

    var corners = function (text) {
      return text.trim().split(/\s+/).map(function (id) { return indexOf[id]; });
    };

    var pieces = [];
    rodEls.forEach(function (el, r) {
      // A cable carries its own widths: "ink sleeve".
      var own = (el.getAttribute('data-w') || '').split(/\s+/).map(Number);
      pieces.push({
        el: el,
        rod: r,
        lines: el.querySelectorAll('line'),
        inkW: own.length === 2 ? own[0] : rodWidth,
        caseW: own.length === 2 ? own[1] : caseWidth,
        sides: null,
        behind: el.classList.contains('back'),
        bucket: -1,
        depth: 0
      });
    });
    circles.forEach(function (el, i) {
      pieces.push({
        el: el,
        node: i,
        shine: svg.querySelector('circle[data-of="' + el.getAttribute('data-id') + '"]'),
        bucket: -1,
        depth: 0
      });
    });
    // Shaded faces are optional: the markup may or may not draw them.
    Array.prototype.forEach.call(svg.querySelectorAll('polygon[data-face]'), function (el) {
      pieces.push({ el: el, face: corners(el.getAttribute('data-face')), depth: 0 });
    });

    pieces.forEach(function (piece, i) { piece.index = i; });

    // Faces that are listed but not drawn: enough to tell which rods are
    // behind the solid, for a drawing that shows hidden edges differently.
    var ghosts = (svg.getAttribute('data-faces') || '').split(';').filter(Boolean).map(corners);
    var away = ghosts.map(function () { return false; });
    if (ghosts.length) {
      pieces.forEach(function (piece) {
        if (piece.rod === undefined) return;
        var rod = rodDefs[piece.rod];
        piece.sides = [];
        ghosts.forEach(function (face, f) {
          for (var c = 0; c < face.length; c++) {
            var next = face[(c + 1) % face.length];
            if ((face[c] === rod.a && next === rod.b) || (face[c] === rod.b && next === rod.a)) piece.sides.push(f);
          }
        });
      });
    }

    var order = '';
    var screen = nodes.map(function () { return { x: 0, y: 0, scale: 1, depth: 0 }; });
    // How far a floating structure is from where the markup drew it. It is
    // drawn as if seen from straight ahead wherever it goes.
    var shift = [0, 0, 0];
    var homeMiddle = sim.middle([0, 0, 0]);
    var area = null;   // the part of the stage it may move in: left, right, top, bottom

    // How far the drawn pose is from the one this script computes. Shown in
    // the debug view: it should be zero, or the two were edited apart.
    var drift = 0;
    circles.forEach(function (circle, i) {
      var p = project(nodes[i].x, nodes[i].y, nodes[i].z);
      drift = Math.max(drift,
        Math.abs(p.x - circle.getAttribute('cx')), Math.abs(p.y - circle.getAttribute('cy')));
    });

    function fmt(value) {
      return String(Math.round(value * 100) / 100);
    }

    function setBucket(piece, depth) {
      var bucket = Math.floor((depth + depthSpan) / (2 * depthSpan) * 4);
      bucket = bucket < 0 ? 0 : bucket > 3 ? 3 : bucket;
      if (bucket === piece.bucket) return;
      if (piece.bucket >= 0) piece.el.classList.remove('d' + piece.bucket);
      piece.el.classList.add('d' + bucket);
      piece.bucket = bucket;
    }

    function light(face) {
      var pos = sim.pos;
      var a = face[0] * 3, b = face[1] * 3, c = face[2] * 3;
      return faceOpacity(
        pos[a] - shift[0], pos[a + 1] - shift[1], pos[a + 2] - shift[2],
        pos[b] - shift[0], pos[b + 1] - shift[1], pos[b + 2] - shift[2],
        pos[c] - shift[0], pos[c + 1] - shift[1], pos[c + 2] - shift[2]);
    }

    /* Where every node is on the screen. */
    function place() {
      var pos = sim.pos;
      if (floating) {
        sim.middle(shift);
        shift[0] -= homeMiddle[0];
        shift[1] -= homeMiddle[1];
        shift[2] -= homeMiddle[2];
      }
      for (var i = 0; i < nodes.length; i++) {
        var p = project(pos[i * 3] - shift[0], pos[i * 3 + 1] - shift[1], pos[i * 3 + 2] - shift[2]);
        screen[i].x = p.x + shift[0];
        screen[i].y = p.y + shift[1];
        screen[i].scale = p.scale;
        screen[i].depth = p.depth;
      }
      if (area) fence();
    }

    /*
     * The simulation keeps the nodes inside a box, but perspective draws the
     * near ones farther out than they are. The box is drawn in by that
     * difference on each side, so what stays inside the area is the drawing.
     */
    function fence() {
      var pos = sim.pos;
      var left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      var drawnLeft = Infinity, drawnRight = -Infinity, drawnTop = Infinity, drawnBottom = -Infinity;
      for (var i = 0; i < count; i++) {
        left = Math.min(left, pos[i * 3]);
        right = Math.max(right, pos[i * 3]);
        top = Math.min(top, pos[i * 3 + 1]);
        bottom = Math.max(bottom, pos[i * 3 + 1]);
        drawnLeft = Math.min(drawnLeft, screen[i].x);
        drawnRight = Math.max(drawnRight, screen[i].x);
        drawnTop = Math.min(drawnTop, screen[i].y);
        drawnBottom = Math.max(drawnBottom, screen[i].y);
      }
      sim.confine(
        area[0] + left - drawnLeft, area[1] - (drawnRight - right),
        area[2] + top - drawnTop, area[3] - (drawnBottom - bottom));
    }

    function draw() {
      var i;
      place();
      for (i = 0; i < ghosts.length; i++) away[i] = light(ghosts[i]) === 0;

      for (i = 0; i < pieces.length; i++) {
        var piece = pieces[i];
        if (piece.node !== undefined) {
          var s = screen[piece.node];
          var radius = nodeRadius * s.scale;
          piece.el.setAttribute('cx', fmt(s.x));
          piece.el.setAttribute('cy', fmt(s.y));
          piece.el.setAttribute('r', fmt(radius));
          if (piece.shine) {
            piece.shine.setAttribute('cx', fmt(s.x - radius * CONFIG.shineAt));
            piece.shine.setAttribute('cy', fmt(s.y - radius * CONFIG.shineAt));
            piece.shine.setAttribute('r', fmt(radius * CONFIG.shineSize));
          }
          piece.depth = s.depth;
          setBucket(piece, s.depth);
        } else if (piece.face) {
          var points = '';
          var far = -Infinity;
          for (var c = 0; c < piece.face.length; c++) {
            var corner = screen[piece.face[c]];
            points += (c ? ' ' : '') + fmt(corner.x) + ',' + fmt(corner.y);
            if (corner.depth > far) far = corner.depth;
          }
          piece.el.setAttribute('points', points);
          piece.el.setAttribute('fill-opacity', fmt(light(piece.face)));
          // A face goes behind its own rods and nodes.
          piece.depth = far + 0.02;
        } else {
          var a = screen[rodDefs[piece.rod].a];
          var b = screen[rodDefs[piece.rod].b];
          var scale = (a.scale + b.scale) / 2;
          for (var l = 0; l < piece.lines.length; l++) {
            var line = piece.lines[l];
            line.setAttribute('x1', fmt(a.x));
            line.setAttribute('y1', fmt(a.y));
            line.setAttribute('x2', fmt(b.x));
            line.setAttribute('y2', fmt(b.y));
            line.setAttribute('stroke-width', fmt((l === 0 ? piece.caseW : piece.inkW) * scale));
          }
          // A rod is drawn just before the farther of its two nodes, so a
          // node always sits on top of the rods that end in it.
          piece.depth = Math.max(a.depth, b.depth) + 0.01;
          setBucket(piece, (a.depth + b.depth) / 2);
          if (piece.sides && piece.sides.length) {
            var behind = true;
            for (var k = 0; k < piece.sides.length; k++) {
              if (!away[piece.sides[k]]) behind = false;
            }
            if (behind !== piece.behind) {
              piece.behind = behind;
              piece.el.classList.toggle('back', behind);
            }
          }
        }
      }

      if (threadEl) {
        threadEl.setAttribute('x2', fmt(screen[hung].x));
        threadEl.setAttribute('y2', fmt(screen[hung].y));
      }

      // Far pieces first, so near ones cover them. Re-insert only on change.
      var sorted = pieces.slice().sort(function (m, n) { return n.depth - m.depth; });
      var key = sorted.map(function (piece) { return piece.index; }).join(',');
      if (key !== order) {
        order = key;
        for (i = 0; i < sorted.length; i++) {
          group.appendChild(sorted[i].el);
          if (sorted[i].shine) group.appendChild(sorted[i].shine);
        }
      }
    }

    /* ---- when to run ---- */

    var reduce = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var motionOK = !(reduce && reduce.matches);
    var onScreen = !('IntersectionObserver' in win);
    var awake = false;
    var dead = false;
    var frozen = false;
    var greeted = false;
    var frames = 0;
    var last = 0;
    var scrollSpeed = 0;
    var scrollY = win.scrollY || 0;
    var scrollAt = 0;
    var pointer = null;

    function canRun() {
      return motionOK && onScreen && !doc.hidden && !dead && !frozen;
    }

    function wake() {
      if (awake || !canRun()) return;
      awake = true;
      last = 0;
      win.requestAnimationFrame(tick);
    }

    function fail(error) {
      dead = true;
      awake = false;
      try {
        sim.reset();
        draw();
      } catch (ignored) { /* the markup still shows the rest pose */ }
      if (win.console) win.console.error('rods-and-nodes stopped:', error);
    }

    /* ---- idle motion: data-idle on the figure ---- */

    var force = { twist: 0, swing: 0, x: 0, y: 0, roll: 0 };
    var turn = 0;
    var lean = 0;
    var roam = null;   // "segue": where the pointer last was, and until when it counts

    function idleStep(clock, seconds) {
      force.twist = force.swing = force.x = force.y = force.roll = 0;
      if (idle === 'vivo') {
        // A slow turn back and forth; a floating structure also wanders.
        if (floating) {
          force.x = Math.cos(clock * 0.23) * CONFIG.floatWind;
          force.y = Math.sin(clock * 0.31 + 1) * CONFIG.floatWind;
          force.twist = Math.sin(clock * 0.19) * CONFIG.floatTurn;
          force.roll = Math.cos(clock * 0.13) * CONFIG.floatTurn * 0.6;
        } else {
          force.twist = Math.sin(clock * 0.7) * CONFIG.idleTwist;
          force.swing = Math.cos(clock * 0.5) * CONFIG.idleSwing;
        }
      } else if (idle === 'giro') {
        // It keeps turning, like something on show.
        if (floating) {
          force.twist = CONFIG.floatTurn;
        } else {
          turn = (turn + seconds * CONFIG.idleSpin) % (2 * Math.PI);
          sim.pose(turn, 0);
        }
      } else if (idle === 'pendolo') {
        // It swings from the point it hangs from; a floating one drifts side to side.
        if (floating) force.x = Math.sin(clock * 0.6) * CONFIG.floatWind;
        else sim.pose(0, Math.sin(clock * 1.5) * CONFIG.idleLean);
      } else if (idle === 'segue') {
        // It turns toward the pointer, or drifts toward it, while the pointer moves.
        var at = roam && clock < roam.until ? toSvg(roam.x, roam.y) : null;
        if (floating) {
          if (at) {
            var here = sim.middle([0, 0, 0]);
            force.x = clamp((at.x - here[0]) * 0.4, 70);
            force.y = clamp((at.y - here[1]) * 0.4, 70);
          }
        } else {
          var side = at ? clamp(at.x / 260, 1) : 0;
          var ease = 1 - Math.exp(-seconds * 4);
          turn += (side * CONFIG.idleLook - turn) * ease;
          lean += (-side * 0.05 - lean) * ease;
          if (!at && Math.abs(turn) < 0.002) turn = lean = 0;
          sim.pose(turn, lean);
        }
      }
    }

    /* "brezza": now and then a puff of air, then stillness again. */
    function gust() {
      var angle = Math.random() * 2 * Math.PI;
      if (floating) {
        sim.push(Math.cos(angle) * 60, Math.sin(angle) * 45, 0);
        sim.spin((Math.random() - 0.5) * 2.4);
      } else {
        sim.push(Math.cos(angle) * 30, 0, 30 + Math.random() * 50);
        sim.spin((Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.4));
      }
    }

    function tick(now) {
      if (!awake) return;
      try {
        var seconds = last ? Math.min((now - last) / 1000, 0.1) : CONFIG.step;
        last = now;
        scrollSpeed *= Math.exp(-seconds / 0.09);
        idleStep(now / 1000, seconds);
        sim.drive(scrollSpeed, force.twist, force.swing);
        sim.blow(force.x, force.y, force.roll);
        sim.advance(seconds);
        var resting = !pointer && sim.settle(seconds);
        draw();
        frames++;
        if (resting || !canRun()) {
          awake = false;
          return;
        }
        win.requestAnimationFrame(tick);
      } catch (error) {
        fail(error);
      }
    }

    /* ---- a floating structure takes the whole first screen ---- */

    /*
     * The drawing is stretched over the stage, edge to edge and behind the
     * text. Its viewBox grows by the same amount, so the structure keeps its
     * size and starts exactly where the figure showed it.
     */
    function layOut() {
      var box = figure.getBoundingClientRect();
      var rect = stage.getBoundingClientRect();
      var page = doc.body.getBoundingClientRect();
      if (!box.width || !rect.height || !page.width) return;
      var unit = home.width / box.width;
      var view = [home.x - (box.left - page.left) * unit, home.y - (box.top - rect.top) * unit, page.width * unit, rect.height * unit];
      svg.style.left = fmt(page.left - rect.left) + 'px';
      svg.style.width = fmt(page.width) + 'px';
      svg.setAttribute('viewBox', view.map(fmt).join(' '));
      var pad = nodeRadius * 1.5;
      area = [view[0] + pad, view[0] + view[2] - pad, view[1] + pad, view[1] + view[3] - pad];
      place();
      // A pose held by ?at is worked out again for the new area.
      if (frozen) showAt();
      else wake();
    }

    if (floating) {
      stage.classList.add('stage');
      svg.classList.add('floating');
      stage.insertBefore(svg, stage.firstChild);
      layOut();
      if ('ResizeObserver' in win) new win.ResizeObserver(layOut).observe(stage);
      win.addEventListener('resize', layOut);
    }

    /* ---- inputs ---- */

    function onScroll() {
      var y = win.scrollY || 0;
      var at = win.performance.now();
      var gap = (at - scrollAt) / 1000;
      if (gap > 0 && gap < 0.25) scrollSpeed += ((y - scrollY) / gap - scrollSpeed) * 0.5;
      scrollY = y;
      scrollAt = at;
      wake();
    }

    function toSvg(x, y) {
      var matrix = svg.getScreenCTM();
      if (!matrix) return null;
      var point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      return point.matrixTransform(matrix.inverse());
    }

    /* Drawing units per CSS pixel. */
    function unitSize() {
      return svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
    }

    /* The node under the finger: the closest one, favouring those in front. */
    function pick(point) {
      var best = -1;
      var bestScore = Infinity;
      var bestGap = Infinity;
      for (var i = 0; i < count; i++) {
        var s = screen[i];
        var gap = Math.sqrt((s.x - point.x) * (s.x - point.x) + (s.y - point.y) * (s.y - point.y));
        var score = gap + (s.depth + depthSpan) / (2 * depthSpan) * 10;
        if (score < bestScore) {
          bestScore = score;
          bestGap = gap;
          best = i;
        }
      }
      return { node: best, gap: bestGap };
    }

    var touchRule = !!(win.CSS && win.CSS.supports && win.CSS.supports('touch-action', 'pan-y'));
    // A floating structure is behind the text, so the stage listens for it.
    var surface = floating ? stage : svg;

    function onDown(event) {
      if (pointer || !event.isPrimary || !canRun()) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // On the stage the text comes first: links and controls keep their taps.
      if (floating && event.target.closest && event.target.closest('a, button, input, select, textarea')) return;
      var point = toSvg(event.clientX, event.clientY);
      if (!point) return;
      var hit = pick(point);
      var unit = unitSize();
      if (floating && hit.gap > 60 * unit) return;
      // Without the CSS gesture rule a finger drag would fight the page scroll,
      // so touch falls back to taps only.
      var canHold = hit.gap <= 26 * unit && (event.pointerType !== 'touch' || touchRule);
      pointer = {
        id: event.pointerId,
        node: hit.node,
        x: event.clientX,
        y: event.clientY,
        at: point,
        depth: screen[hit.node].depth,
        canHold: canHold,
        holding: false
      };
      if (canHold) {
        try { surface.setPointerCapture(event.pointerId); } catch (ignored) { /* not fatal */ }
        // Keeps a mouse drag from selecting the text in front of the structure.
        if (floating && event.pointerType === 'mouse') event.preventDefault();
      }
    }

    function onMove(event) {
      if (!pointer) {
        if (floating && event.pointerType === 'mouse') {
          var over = toSvg(event.clientX, event.clientY);
          stage.classList.toggle('near', !!over && canRun() && pick(over).gap <= 26 * unitSize());
        }
        return;
      }
      if (event.pointerId !== pointer.id) return;
      if (!pointer.holding) {
        var dx = event.clientX - pointer.x;
        var dy = event.clientY - pointer.y;
        if (!pointer.canHold || dx * dx + dy * dy < 25) return;
        pointer.holding = true;
        sim.hold(pointer.node);
        circles[pointer.node].classList.add('held');
        if (floating) stage.classList.add('holding');
        wake();
      }
      var point = toSvg(event.clientX, event.clientY);
      if (!point) return;
      var world = unproject(point.x - shift[0], point.y - shift[1], pointer.depth);
      sim.moveTo(world.x + shift[0], world.y + shift[1], world.z + shift[2]);
    }

    function letGo() {
      if (!pointer) return;
      if (pointer.holding) {
        sim.release();
        circles[pointer.node].classList.remove('held');
        if (floating) stage.classList.remove('holding');
      }
      pointer = null;
      wake();
    }

    function onUp(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (!pointer.holding) {
        if (floating) {
          // A tap: the structure moves away from the finger, across the page.
          var here = sim.middle([0, 0, 0]);
          var dx = here[0] - pointer.at.x;
          var dy = here[1] - pointer.at.y;
          var far = Math.sqrt(dx * dx + dy * dy) || 1;
          // Something with weight needs a harder push to leave the ground.
          var hard = weighty ? 3.4 : 1;
          sim.push(dx / far * 110 * hard, dy / far * 110 * hard, 0);
          sim.spin(dx >= 0 ? 1.6 : -1.6);
          sim.kick(pointer.node, dx / far * 120 * hard, dy / far * 120 * hard, 0);
        } else {
          // A tap: the structure recoils from the finger and turns away from it.
          var side = sim.pos[pointer.node * 3] >= 0 ? 1 : -1;
          sim.push(0, 0, 90);
          sim.spin(2.4 * side);
          sim.kick(pointer.node, 0, 0, 260);
        }
      }
      letGo();
    }

    function onCancel(event) {
      if (pointer && event.pointerId === pointer.id) letGo();
    }

    win.addEventListener('scroll', onScroll, { passive: true });
    surface.addEventListener('pointerdown', onDown);
    surface.addEventListener('pointermove', onMove);
    surface.addEventListener('pointerup', onUp);
    surface.addEventListener('pointercancel', onCancel);
    surface.addEventListener('lostpointercapture', onCancel);
    doc.addEventListener('visibilitychange', wake);

    if (idle === 'segue') {
      win.addEventListener('pointermove', function (event) {
        roam = { x: event.clientX, y: event.clientY, until: win.performance.now() / 1000 + 2.5 };
        wake();
      }, { passive: true });
    }
    if (idle === 'brezza') {
      win.setInterval(function () {
        if (!canRun() || pointer) return;
        gust();
        wake();
      }, 6500);
    }

    function onMotionChange() {
      motionOK = !reduce.matches;
      if (motionOK) {
        wake();
      } else {
        letGo();
        awake = false;
        turn = lean = 0;
        sim.reset();
        draw();
      }
    }
    if (reduce) {
      if (reduce.addEventListener) reduce.addEventListener('change', onMotionChange);
      else if (reduce.addListener) reduce.addListener(onMotionChange);
    }

    function nudge() {
      if (floating) {
        // Toward the text: up on a phone, to the left on a wide screen.
        sim.spin(0.9);
        sim.push(-46, -30, 0);
      } else {
        sim.spin(1.9);
        sim.push(0, 0, 40);
      }
    }

    /* The first move, the first time the structure is seen. */
    function enter() {
      if (entrance === 'monta') sim.scatter(105, 1.1);
      else if (entrance === 'cala') sim.drop(floating ? 150 : 200, 1.3);
      else if (entrance === 'giro' && !weighty) nudge();
      // Something with weight needs no push: it falls. A nudge to one node
      // keeps it from landing balanced on a point.
      if (weighty) sim.kick(0, Math.random() < 0.5 ? -70 : 70, 0, 0);
    }

    function greet() {
      if (greeted || !canRun()) return;
      greeted = true;
      enter();
      wake();
    }

    place();

    // Debug: `?at=0.4` shows the structure 0.4 seconds into that first move
    // and holds it there, so a moving pose can be inspected or captured.
    var at = /[?&]at=([\d.]+)/.exec(win.location.search);
    function showAt() {
      sim.reset();
      turn = lean = 0;
      enter();
      for (var f = 0, total = Math.round(+at[1] * 60); f < total; f++) {
        idleStep(f / 60, 1 / 60);
        sim.drive(0, force.twist, force.swing);
        sim.blow(force.x, force.y, force.roll);
        sim.advance(1 / 60);
        place();
      }
      draw();
    }
    if (at) {
      frozen = true;
      showAt();
    }

    if ('IntersectionObserver' in win) {
      new win.IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) {
          greet();
          wake();
        }
      }).observe(floating ? stage : figure);
    } else {
      greet();
    }

    /* ---- debug view: add ?debug to the address ---- */

    if (/[?&]debug\b/.test(win.location.search)) {
      var panel = doc.createElement('pre');
      panel.className = 'element-debug';
      figure.appendChild(panel);
      var counted = 0;
      var report = function () {
        var box = svg.getBoundingClientRect();
        var state = sim.measure();
        panel.textContent = [
          'rods-and-nodes ' + VERSION,
          (weighty ? 'falling' : floating ? 'floating' : 'hung') + ', enters ' + entrance + (idle ? ', idle ' + idle : ''),
          'fps ' + (frames - counted) * 2,
          'box ' + Math.round(box.width) + 'x' + Math.round(box.height),
          'reduced motion ' + (motionOK ? 'off' : 'on'),
          'touch rule ' + (touchRule ? 'yes' : 'no'),
          'state ' + (dead ? 'stopped' : frozen ? 'held by ?at' : awake ? 'awake' : 'asleep'),
          'steps ' + sim.steps(),
          'offset ' + state.offset.toFixed(2),
          'pose drift ' + drift.toFixed(2)
        ].join('\n');
        counted = frames;
      };
      report();
      win.setInterval(report, 500);
    }

    return { sim: sim, draw: draw, wake: wake };
  }

  function autoMount(win) {
    var doc = win.document;
    function start() {
      var figure = doc.querySelector('figure.element');
      if (!figure) return;
      try {
        mount(figure, win);
      } catch (error) {
        if (win.console) win.console.error('rods-and-nodes did not start:', error);
      }
    }
    // A deferred script runs just before DOMContentLoaded: waiting for it
    // lets anything that prepares the drawing run first.
    var script = doc.currentScript;
    var early = doc.readyState === 'loading' || (doc.readyState === 'interactive' && script && script.defer);
    if (early) doc.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return {
    VERSION: VERSION,
    CONFIG: CONFIG,
    project: project,
    unproject: unproject,
    faceOpacity: faceOpacity,
    createSim: createSim,
    mount: mount,
    autoMount: autoMount
  };
});
