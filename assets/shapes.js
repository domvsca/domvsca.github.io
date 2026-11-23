/*
 * Shapes for the rods-and-nodes structure, and the SVG that draws one at rest.
 *
 * The pages load it after element.js: assets/look.js uses it to draw the
 * shape and style of the look in place of the drawing in the markup. The same
 * code, under Node, writes that drawing into the pages (tools/make-pose.js).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./element.js'));
  } else {
    root.RodsAndNodesPose = factory(root.RodsAndNodes);
  }
})(typeof self !== 'undefined' ? self : this, function (element) {
  'use strict';

  var THREAD = 300;          // length of the thread above the top node
  var VIEW = { x: -180, y: -150, width: 360, height: 285 };
  var YAW = 0.31;            // a slight turn, so no two nodes line up at rest

  /*
   * How a shape is drawn, in viewBox units. `caseW` is the paper-coloured
   * sleeve that separates crossing rods. `faces` is 'drawn' when each face is
   * a shaded polygon, or 'known' when the faces are only listed, so the script
   * can tell which rods are behind the solid. `shine` adds a highlight to
   * every node. `solid` is a style of faces alone: a shape without faces is
   * drawn as "filo" instead. `sketch` runs the drawing through a filter that
   * makes its lines waver, like a pencil's.
   */
  var STYLES = {
    filo:          { nodeR: 8.5, rodW: 3.4, caseW: 8.4 },
    facce:         { nodeR: 8.5, rodW: 3.4, caseW: 8.4, faces: 'drawn' },
    vetro:         { nodeR: 5, rodW: 2, caseW: 2, faces: 'drawn' },
    disegno:       { nodeR: 3.4, rodW: 1.5, caseW: 5.5, faces: 'known' },
    costellazione: { nodeR: 6.5, rodW: 1.1, caseW: 1.1 },
    magneti:       { nodeR: 11, rodW: 5.6, caseW: 9.6, shine: true },
    tubi:          { nodeR: 7, rodW: 9, caseW: 12 },
    origami:       { nodeR: 5, rodW: 1.3, caseW: 1.3, faces: 'drawn', solid: true },
    schizzo:       { nodeR: 6.5, rodW: 2.2, caseW: 6.6, sketch: true },
    neon:          { nodeR: 4.4, rodW: 2.6, caseW: 2.6 }
  };

  function ring(count, radius, y, turn) {
    var nodes = [];
    for (var k = 0; k < count; k++) {
      var a = YAW + turn + k * 2 * Math.PI / count;
      nodes.push({ x: radius * Math.cos(a), y: y, z: radius * Math.sin(a) });
    }
    return nodes;
  }

  /* A regular icosahedron standing on a vertex: 12 nodes, 30 equal rods. */
  function icosaedro() {
    var R = 100;
    var ringY = R / Math.sqrt(5);
    var ringR = 2 * R / Math.sqrt(5);
    var nodes = [{ x: 0, y: -R, z: 0 }]
      .concat(ring(5, ringR, -ringY, 0), ring(5, ringR, ringY, Math.PI / 5), [{ x: 0, y: R, z: 0 }]);
    var rods = [];
    var faces = [];
    for (var k = 0; k < 5; k++) {
      var n = (k + 1) % 5;
      rods.push([0, 1 + k], [1 + k, 1 + n], [1 + k, 6 + k], [1 + n, 6 + k], [6 + k, 6 + n], [6 + k, 11]);
      faces.push([0, 1 + k, 1 + n], [1 + k, 6 + k, 1 + n], [6 + k, 1 + n, 6 + n], [11, 6 + k, 6 + n]);
    }
    return { nodes: nodes, rods: rods, faces: faces, depth: 115 };
  }

  /* Two five-sided pyramids base to base: 7 nodes, 15 equal rods. */
  function diamante() {
    var a = 112;
    var ringR = a / (2 * Math.sin(Math.PI / 5));
    var h = Math.sqrt(a * a - ringR * ringR);
    var nodes = [{ x: 0, y: -h, z: 0 }].concat(ring(5, ringR, 0, 0), [{ x: 0, y: h, z: 0 }]);
    var rods = [];
    var faces = [];
    for (var k = 0; k < 5; k++) {
      var n = (k + 1) % 5;
      rods.push([0, 1 + k], [1 + k, 1 + n], [1 + k, 6]);
      faces.push([0, 1 + k, 1 + n], [6, 1 + k, 1 + n]);
    }
    return { nodes: nodes, rods: rods, faces: faces, depth: 105 };
  }

  /* A slender mast: a pyramid, two twisted bays and a pyramid. 11 nodes, 27 equal rods. */
  function torre() {
    var a = 64;
    var ringR = a / Math.sqrt(3);
    var bay = a * Math.sqrt(2 / 3);
    var nodes = [{ x: 0, y: -2 * bay, z: 0 }]
      .concat(ring(3, ringR, -bay, 0), ring(3, ringR, 0, Math.PI / 3), ring(3, ringR, bay, 0), [{ x: 0, y: 2 * bay, z: 0 }]);
    var rods = [];
    var faces = [];
    for (var k = 0; k < 3; k++) {
      var n = (k + 1) % 3;
      var A = 1 + k, An = 1 + n, B = 4 + k, Bn = 4 + n, C = 7 + k, Cn = 7 + n;
      rods.push([0, A], [A, An], [A, B], [An, B], [B, Bn], [C, B], [Cn, B], [C, Cn], [C, 10]);
      faces.push([0, A, An], [A, An, B], [B, Bn, An], [C, Cn, B], [B, Bn, Cn], [10, C, Cn]);
    }
    return { nodes: nodes, rods: rods, faces: faces, depth: 70 };
  }

  /* The simplest solid: 4 nodes, 6 equal rods. */
  function tetraedro() {
    var a = 168;
    var nodes = [{ x: 0, y: -a * Math.sqrt(2 / 3), z: 0 }].concat(ring(3, a / Math.sqrt(3), 0, 0));
    return {
      nodes: nodes,
      rods: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]],
      faces: [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 2, 3]]
    };
  }

  /* Two square pyramids base to base: 6 nodes, 12 equal rods. */
  function ottaedro() {
    var R = 100;
    var nodes = [{ x: 0, y: -R, z: 0 }].concat(ring(4, R, 0, 0), [{ x: 0, y: R, z: 0 }]);
    var rods = [];
    var faces = [];
    for (var k = 0; k < 4; k++) {
      var n = (k + 1) % 4;
      rods.push([0, 1 + k], [1 + k, 1 + n], [1 + k, 5]);
      faces.push([0, 1 + k, 1 + n], [5, 1 + k, 1 + n]);
    }
    return { nodes: nodes, rods: rods, faces: faces };
  }

  /*
   * A cube hanging from a corner: 8 nodes, 12 equal rods. Its square faces
   * would fold, so each has a hidden brace across it.
   */
  function cubo() {
    var a = 112;
    var ringR = a * Math.sqrt(2 / 3);
    var half = a * Math.sqrt(3) / 2;
    var ringY = a * Math.sqrt(3) / 6;
    var nodes = [{ x: 0, y: -half, z: 0 }]
      .concat(ring(3, ringR, -ringY, 0), ring(3, ringR, ringY, Math.PI / 3), [{ x: 0, y: half, z: 0 }]);
    var rods = [];
    var faces = [];
    var braces = [];
    for (var k = 0; k < 3; k++) {
      var n = (k + 1) % 3;
      var A = 1 + k, An = 1 + n, B = 4 + k, Bn = 4 + n;
      rods.push([0, A], [A, B], [An, B], [B, 7]);
      faces.push([0, A, B, An], [7, B, An, Bn]);
      braces.push([0, B], [7, An]);
    }
    return { nodes: nodes, rods: rods, faces: faces, braces: braces };
  }

  /* A lantern: a twisted square bay with a pyramid at each end. 10 nodes, 24 equal rods. */
  function lanterna() {
    var a = 88;
    var ringR = a / Math.SQRT2;
    var chord = 2 * ringR * Math.sin(Math.PI / 8);
    var bay = Math.sqrt(a * a - chord * chord);
    var cap = Math.sqrt(a * a - ringR * ringR);
    var nodes = [{ x: 0, y: -bay / 2 - cap, z: 0 }]
      .concat(ring(4, ringR, -bay / 2, 0), ring(4, ringR, bay / 2, Math.PI / 4), [{ x: 0, y: bay / 2 + cap, z: 0 }]);
    var rods = [];
    var faces = [];
    for (var k = 0; k < 4; k++) {
      var n = (k + 1) % 4;
      var A = 1 + k, An = 1 + n, B = 5 + k, Bn = 5 + n;
      rods.push([0, A], [A, An], [A, B], [An, B], [B, Bn], [B, 9]);
      faces.push([0, A, An], [A, B, An], [B, An, Bn], [9, B, Bn]);
    }
    return { nodes: nodes, rods: rods, faces: faces };
  }

  /*
   * A dome: the icosahedron without its lowest node. 11 nodes, 25 equal rods.
   * Two hidden braces keep the open five-sided base in shape.
   */
  function cupola() {
    var R = 100;
    var ringY = R / Math.sqrt(5);
    var ringR = 2 * R / Math.sqrt(5);
    var nodes = [{ x: 0, y: -R, z: 0 }].concat(ring(5, ringR, -ringY, 0), ring(5, ringR, ringY, Math.PI / 5));
    var rods = [];
    var faces = [];
    for (var k = 0; k < 5; k++) {
      var n = (k + 1) % 5;
      rods.push([0, 1 + k], [1 + k, 1 + n], [1 + k, 6 + k], [1 + n, 6 + k], [6 + k, 6 + n]);
      faces.push([0, 1 + k, 1 + n], [1 + k, 6 + k, 1 + n], [6 + k, 1 + n, 6 + n]);
    }
    faces.push([6, 7, 8, 9, 10]);
    return { nodes: nodes, rods: rods, faces: faces, braces: [[6, 8], [6, 9]] };
  }

  /* A helix of tetrahedra, each sharing a face with the next: 9 nodes, 21 equal rods. */
  function elica() {
    var a = 78;
    var count = 9;
    var radius = a * 3 * Math.sqrt(3) / 10;
    var rise = a / Math.sqrt(10);
    var turn = Math.acos(-2 / 3);
    var nodes = [];
    var rods = [];
    var faces = [[0, 1, 2], [count - 3, count - 2, count - 1]];
    for (var k = 0; k < count; k++) {
      nodes.push({ x: radius * Math.cos(YAW + k * turn), y: k * rise, z: radius * Math.sin(YAW + k * turn) });
      for (var j = 1; j <= 3 && k + j < count; j++) rods.push([k, k + j]);
      if (k + 3 < count) faces.push([k, k + 1, k + 3], [k, k + 2, k + 3]);
    }
    return { nodes: nodes, rods: rods, faces: faces };
  }

  /* A star: a tetrahedron with another on each of its faces. 8 nodes, 18 equal rods. */
  function stella() {
    var a = 96;
    var rho = a * Math.sqrt(6) / 4;
    var inner = [{ x: 0, y: rho, z: 0 }].concat(ring(3, a / Math.sqrt(3), -rho / 3, 0));
    // The point on each face is the opposite corner, pushed through the centre.
    var outer = inner.map(function (p) { return { x: -5 / 3 * p.x, y: -5 / 3 * p.y, z: -5 / 3 * p.z }; });
    var rods = [];
    var faces = [];
    for (var i = 0; i < 4; i++) {
      for (var j = i + 1; j < 4; j++) rods.push([i, j]);
      var others = [0, 1, 2, 3].filter(function (c) { return c !== i; });
      rods.push([4 + i, others[0]], [4 + i, others[1]], [4 + i, others[2]]);
      faces.push([4 + i, others[0], others[1]], [4 + i, others[1], others[2]], [4 + i, others[2], others[0]]);
    }
    return { nodes: inner.concat(outer), rods: rods, faces: faces };
  }

  /*
   * A tensegrity prism: three struts that never touch, held by nine cables.
   * 6 nodes. Three hidden braces stand in for the tension that keeps a real
   * one in shape.
   */
  function tensegrity() {
    var radius = 64;
    var half = 76;
    var nodes = ring(3, radius, -half, 5 * Math.PI / 6).concat(ring(3, radius, half, 0));
    var rods = [];
    var braces = [];
    for (var k = 0; k < 3; k++) {
      var n = (k + 1) % 3;
      rods.push([3 + k, k], [k, n, 'cable'], [3 + k, 3 + n, 'cable'], [3 + n, k, 'cable']);
      braces.push([3 + k, n]);
    }
    return { nodes: nodes, rods: rods, faces: [], braces: braces };
  }

  /* A square pyramid hanging from its tip: 5 nodes, 8 equal rods, one hidden brace across the base. */
  function piramide() {
    var a = 150;
    var nodes = [{ x: 0, y: -a / Math.SQRT2, z: 0 }].concat(ring(4, a / Math.SQRT2, 0, 0));
    var rods = [];
    var faces = [[1, 2, 3, 4]];
    for (var k = 0; k < 4; k++) {
      var n = (k + 1) % 4;
      rods.push([0, 1 + k], [1 + k, 1 + n]);
      faces.push([0, 1 + k, 1 + n]);
    }
    return { nodes: nodes, rods: rods, faces: faces, braces: [[1, 3]] };
  }

  /*
   * A cuboctahedron hanging from a corner: 12 nodes, 24 equal rods, eight
   * triangles and six squares, each square with a hidden brace.
   */
  function cubottaedro() {
    var a = 100;
    var corners = [];
    [-1, 1].forEach(function (p) {
      [-1, 1].forEach(function (q) {
        corners.push([p, q, 0], [p, 0, q], [0, p, q]);
      });
    });
    var at = {};
    corners.forEach(function (c, i) { at[c.join(',')] = i; });
    var cos = Math.cos(YAW);
    var sin = Math.sin(YAW);
    var nodes = corners.map(function (c) {
      // Turned so that the corner (1, 1, 0) is the highest point.
      var x = (c[0] - c[1]) * a / 2;
      var z = c[2] * a / Math.SQRT2;
      return { x: x * cos - z * sin, y: -(c[0] + c[1]) * a / 2, z: x * sin + z * cos };
    });
    var rods = [];
    corners.forEach(function (c, i) {
      corners.forEach(function (d, j) {
        var gap = (c[0] - d[0]) * (c[0] - d[0]) + (c[1] - d[1]) * (c[1] - d[1]) + (c[2] - d[2]) * (c[2] - d[2]);
        if (j > i && gap === 2) rods.push([i, j]);
      });
    });
    var faces = [];
    var braces = [];
    [-1, 1].forEach(function (p) {
      [-1, 1].forEach(function (q) {
        [-1, 1].forEach(function (r) {
          faces.push([at[[p, q, 0].join(',')], at[[p, 0, r].join(',')], at[[0, q, r].join(',')]]);
        });
      });
      // The square on each side of each axis.
      [0, 1, 2].forEach(function (axis) {
        var square = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(function (pair) {
          var c = pair.slice();
          c.splice(axis, 0, p);
          return at[c.join(',')];
        });
        faces.push(square);
        braces.push([square[0], square[2]]);
      });
    });
    return { nodes: nodes, rods: rods, faces: faces, braces: braces };
  }

  /*
   * A geodesic sphere: every face of the icosahedron split in four and pushed
   * out to the sphere. 42 nodes and 120 rods of two lengths, drawn finer.
   */
  function geode() {
    var R = 104;
    var base = icosaedro();
    var nodes = base.nodes.map(function (p) { return { x: p.x * R / 100, y: p.y * R / 100, z: p.z * R / 100 }; });
    var middles = {};
    var middle = function (a, b) {
      var key = Math.min(a, b) + '-' + Math.max(a, b);
      if (middles[key] === undefined) {
        var x = nodes[a].x + nodes[b].x, y = nodes[a].y + nodes[b].y, z = nodes[a].z + nodes[b].z;
        var out = R / Math.sqrt(x * x + y * y + z * z);
        middles[key] = nodes.length;
        nodes.push({ x: x * out, y: y * out, z: z * out });
      }
      return middles[key];
    };
    var rods = [];
    var faces = [];
    var seen = {};
    base.faces.forEach(function (f) {
      var ab = middle(f[0], f[1]), bc = middle(f[1], f[2]), ca = middle(f[2], f[0]);
      [[f[0], ab, ca], [f[1], bc, ab], [f[2], ca, bc], [ab, bc, ca]].forEach(function (face) {
        faces.push(face);
        face.forEach(function (a, i) {
          var b = face[(i + 1) % 3];
          var key = Math.min(a, b) + '-' + Math.max(a, b);
          if (!seen[key]) rods.push([a, b]);
          seen[key] = true;
        });
      });
    });
    return { nodes: nodes, rods: rods, faces: faces, depth: 120, mixed: true, fine: 0.6 };
  }

  var BUILDERS = {
    icosaedro: icosaedro,
    diamante: diamante,
    torre: torre,
    tetraedro: tetraedro,
    ottaedro: ottaedro,
    cubo: cubo,
    lanterna: lanterna,
    cupola: cupola,
    elica: elica,
    stella: stella,
    tensegrity: tensegrity,
    piramide: piramide,
    cubottaedro: cubottaedro,
    geode: geode
  };

  /*
   * A named shape, ready for the simulation and for drawing: nodes with ids,
   * rods as { a, b, cable }, hidden braces as { a, b }, faces wound so that
   * their normals point outwards, the node that hangs from the thread and the
   * fixed point above it.
   */
  function buildShape(name) {
    var raw = (BUILDERS[name] || icosaedro)();
    var count = raw.nodes.length;

    // Centred between its highest and lowest node.
    var low = Infinity;
    var high = -Infinity;
    raw.nodes.forEach(function (p) {
      low = Math.min(low, p.y);
      high = Math.max(high, p.y);
    });
    var lift = (low + high) / 2;
    var points = raw.nodes.map(function (p) { return { x: p.x, y: p.y - lift, z: p.z }; });

    var centre = points.reduce(function (sum, p) {
      return { x: sum.x + p.x / count, y: sum.y + p.y / count, z: sum.z + p.z / count };
    }, { x: 0, y: 0, z: 0 });

    var joined = points.map(function () { return {}; });
    raw.rods.forEach(function (rod) {
      joined[rod[0]][rod[1]] = true;
      joined[rod[1]][rod[0]] = true;
    });

    var faces = (raw.faces || []).map(function (face) {
      // A point inside the solid: a node joined to every corner of the face
      // when there is one, or else the middle of the shape.
      var inside = centre;
      for (var i = 0; i < count; i++) {
        var all = face.indexOf(i) < 0 && face.every(function (corner) { return joined[i][corner]; });
        if (all) {
          inside = points[i];
          break;
        }
      }
      var p = points[face[0]], q = points[face[1]], r = points[face[2]];
      var ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z;
      var vx = r.x - p.x, vy = r.y - p.y, vz = r.z - p.z;
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var out = nx * (p.x - inside.x) + ny * (p.y - inside.y) + nz * (p.z - inside.z);
      return out >= 0 ? face : [face[0]].concat(face.slice(1).reverse());
    });

    var top = 0;
    points.forEach(function (p, i) { if (p.y < points[top].y) top = i; });

    // Half the range of depths the nodes can take, for the tones of the drawing.
    var depth = raw.depth;
    if (!depth) {
      depth = 0;
      points.forEach(function (p) {
        depth = Math.max(depth, Math.abs(element.project(p.x, p.y, p.z).depth));
      });
      depth = Math.round(depth * 1.15);
    }

    return {
      name: BUILDERS[name] ? name : 'icosaedro',
      nodes: points.map(function (p, i) { return { id: 'n' + i, x: p.x, y: p.y, z: p.z }; }),
      rods: raw.rods.map(function (rod) { return { a: rod[0], b: rod[1], cable: rod[2] === 'cable' }; }),
      braces: (raw.braces || []).map(function (rod) { return { a: rod[0], b: rod[1] }; }),
      faces: faces,
      depth: depth,
      // False when the rods are not all one length, cables apart.
      equal: !raw.mixed,
      // A shape with many pieces is drawn with finer ones.
      fine: raw.fine || 1,
      hung: top,
      anchor: { x: points[top].x, y: points[top].y - THREAD, z: points[top].z }
    };
  }

  function num(value) {
    return String(Math.round(value * 100) / 100);
  }

  /*
   * The SVG block for a shape at rest.
   *   options.style   one of the STYLES above (default "filo")
   *   options.thread  false leaves the thread out, for a floating structure
   *   options.indent  spaces put before every line
   */
  function render(shape, options) {
    options = options || {};
    var indent = options.indent || '';
    var name = STYLES[options.style] ? options.style : options.faces ? 'facce' : 'filo';
    if (STYLES[name].solid && !shape.faces.length) name = 'filo';
    var style = {
      nodeR: STYLES[name].nodeR * shape.fine,
      rodW: STYLES[name].rodW * shape.fine,
      caseW: STYLES[name].caseW * shape.fine,
      faces: STYLES[name].faces,
      shine: STYLES[name].shine,
      sketch: STYLES[name].sketch
    };
    var drawn = style.faces === 'drawn' && shape.faces.length > 0;
    var known = style.faces === 'known' && shape.faces.length > 0;
    var cableW = Math.max(1, style.rodW * 0.36);
    var cableCase = cableW + (style.caseW - style.rodW) * 0.6;

    var screen = shape.nodes.map(function (n) { return element.project(n.x, n.y, n.z); });
    var bucket = function (depth) {
      return Math.max(0, Math.min(3, Math.floor((depth + shape.depth) / (2 * shape.depth) * 4)));
    };
    var ids = function (face) {
      return face.map(function (i) { return shape.nodes[i].id; }).join(' ');
    };
    var light = function (face) {
      var p = shape.nodes[face[0]], q = shape.nodes[face[1]], r = shape.nodes[face[2]];
      return element.faceOpacity(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    };

    // One node stands out: the nearest one in the lower half.
    var mark = -1;
    shape.nodes.forEach(function (node, i) {
      if (node.y <= 0 || i === shape.hung) return;
      if (mark < 0 || screen[i].depth < screen[mark].depth) mark = i;
    });

    var pieces = [];
    if (drawn) {
      shape.faces.forEach(function (face) {
        var corners = face.map(function (i) { return screen[i]; });
        pieces.push({
          // Behind its own rods and nodes: see draw() in element.js.
          depth: Math.max.apply(null, corners.map(function (c) { return c.depth; })) + 0.02,
          text: '<polygon class="face" data-face="' + ids(face) + '" ' +
            'points="' + corners.map(function (c) { return num(c.x) + ',' + num(c.y); }).join(' ') + '" ' +
            'fill-opacity="' + num(light(face)) + '"/>'
        });
      });
    }

    // A rod is behind the solid when every face it borders is turned away.
    var away = known ? shape.faces.map(function (face) { return light(face) === 0; }) : null;
    var behind = function (rod) {
      var sides = 0;
      var hidden = 0;
      shape.faces.forEach(function (face, f) {
        var borders = face.some(function (corner, c) {
          var next = face[(c + 1) % face.length];
          return (corner === rod.a && next === rod.b) || (corner === rod.b && next === rod.a);
        });
        if (borders) {
          sides++;
          if (away[f]) hidden++;
        }
      });
      return sides > 0 && sides === hidden;
    };

    shape.rods.forEach(function (rod) {
      var a = screen[rod.a], b = screen[rod.b];
      var scale = (a.scale + b.scale) / 2;
      var ink = rod.cable ? cableW : style.rodW;
      var sleeve = rod.cable ? cableCase : style.caseW;
      var ends = 'x1="' + num(a.x) + '" y1="' + num(a.y) + '" x2="' + num(b.x) + '" y2="' + num(b.y) + '"';
      pieces.push({
        // Drawn just before the farther of its two nodes.
        depth: Math.max(a.depth, b.depth) + 0.01,
        text: '<g class="rod' + (rod.cable ? ' cable' : '') + (known && behind(rod) ? ' back' : '') +
          ' d' + bucket((a.depth + b.depth) / 2) + '" data-a="' + shape.nodes[rod.a].id + '" data-b="' + shape.nodes[rod.b].id + '"' +
          (rod.cable ? ' data-w="' + num(ink) + ' ' + num(sleeve) + '"' : '') + '>' +
          '<line class="case" ' + ends + ' stroke-width="' + num(sleeve * scale) + '"/>' +
          '<line class="ink" ' + ends + ' stroke-width="' + num(ink * scale) + '"/></g>'
      });
    });

    shape.nodes.forEach(function (node, i) {
      var s = screen[i];
      var radius = style.nodeR * s.scale;
      var text = '<circle class="node d' + bucket(s.depth) + (i === mark ? ' mark' : '') + '" data-id="' + node.id + '" ' +
        'data-x="' + num(node.x) + '" data-y="' + num(node.y) + '" data-z="' + num(node.z) + '" ' +
        'cx="' + num(s.x) + '" cy="' + num(s.y) + '" r="' + num(radius) + '"/>';
      if (style.shine) {
        text += '<circle class="shine" data-of="' + node.id + '" cx="' + num(s.x - radius * element.CONFIG.shineAt) + '" ' +
          'cy="' + num(s.y - radius * element.CONFIG.shineAt) + '" r="' + num(radius * element.CONFIG.shineSize) + '"/>';
      }
      pieces.push({ depth: s.depth, text: text });
    });
    pieces.sort(function (m, n) { return n.depth - m.depth; });

    var pair = function (rod) { return shape.nodes[rod.a].id + '-' + shape.nodes[rod.b].id; };
    var lines = [
      '<svg class="rods' + (name === 'filo' ? '' : ' s-' + name) + '" viewBox="' + VIEW.x + ' ' + VIEW.y + ' ' + VIEW.width + ' ' + VIEW.height + '" role="presentation" focusable="false" ' +
        'data-node-r="' + num(style.nodeR) + '" data-rod-w="' + num(style.rodW) + '" data-case-w="' + num(style.caseW) + '" data-depth="' + shape.depth + '"' +
        (shape.braces.length ? ' data-braces="' + shape.braces.map(pair).join(' ') + '"' : '') +
        (known ? ' data-faces="' + shape.faces.map(ids).join(';') + '"' : '') + '>'
    ];
    if (options.thread !== false) {
      var top = screen[shape.hung];
      var anchor = element.project(shape.anchor.x, shape.anchor.y, shape.anchor.z);
      lines.push('  <line class="thread" data-anchor="' + num(shape.anchor.x) + ' ' + num(shape.anchor.y) + ' ' + num(shape.anchor.z) + '" ' +
        'data-node="' + shape.nodes[shape.hung].id + '" x1="' + num(anchor.x) + '" y1="' + num(anchor.y) + '" x2="' + num(top.x) + '" y2="' + num(top.y) + '"/>');
    }
    if (style.sketch) {
      lines.push('  <defs><filter id="schizzo" x="-10%" y="-10%" width="120%" height="120%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="noise"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>');
    }
    lines.push('  <g class="pieces"' + (style.sketch ? ' filter="url(#schizzo)"' : '') + '>');
    pieces.forEach(function (piece) { lines.push('    ' + piece.text); });
    lines.push('  </g>', '</svg>');
    return lines.map(function (line) { return indent + line; }).join('\n');
  }

  return { names: Object.keys(BUILDERS), styles: Object.keys(STYLES), buildShape: buildShape, render: render };
});
