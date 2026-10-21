# SO(3) Explorer

Interactive 3D models of **SO(3)**, the space of all rotations in 3D, with the formulas and the exact code behind each model.

Thirteen models, in four groups. Most of them share one rotation control (axis + spin, up to 720°):

| # | Model | Idea |
|---|-------|------|
| **The space** | | |
| 1 | Ball of rotations | A turn by θ about axis n̂ sits at θ·n̂ in a ball of radius π. Opposite surface points are glued. |
| 2 | Nested shells | All rotations by the same angle form one sphere. |
| 3 | Slice stack | The ball cut into discs. Rim colors show which points are glued. |
| 4 | Euler-angle box | ZYZ angles (α, β, γ) in a box, with glued faces and gimbal lock. |
| 5 | Quaternion rings | Unit quaternions (S³) projected to 3D. The rings are Hopf fibers, and any two are linked. |
| **Surfaces inside** | | |
| 6 | Boy’s surface | Glue the ball’s skin (the 180° turns) until each point meets its opposite: you get Boy’s surface, ℝP². |
| 7 | Sudanese Möbius band | A Möbius band of rotations whose round edge is a 720° spin. |
| **Loops and covers** | | |
| 8 | Belt trick | A 720° loop shrinks to a point and a twisted ribbon goes flat. A 360° loop can’t. π₁(SO(3)) = ℤ/2. |
| 9 | SU(2) double cover | Unit quaternions as a ball of radius 2π whose whole surface is the single point −1. |
| **Groups and motion** | | |
| 10 | Symmetry groups | Finite subgroups C₆, D₆, T, O, I as dots in the ball; the solid looks unchanged at every step. |
| 11 | Order matters | AB vs BA: composing rotations doesn’t commute. |
| 12 | Interpolation | Slerp (shortest path) vs blending Euler angles. |
| 13 | Random rotations | Uniform (Haar) sampling vs two common wrong recipes. |

A small window in the viewer shows an object turned by the current rotation (for symmetry groups, the solid itself).

## Structure

```
index.html            page layout and text
css/style.css         styles (light + dark)
js/main.js            renderer, controls, tabs, inset view
js/math.js            rotation math: axis-angle, quaternions, matrices, Euler angles
js/scene.js           three.js helpers (tubes, labels, colors)
js/models/*.js        one file per model: geometry, explanation, formulas
```

Each model file exports an object with:

- `build()` draws the static geometry
- `update()` draws the parts that follow the current rotation and returns the dot position (and optionally the rotation shown in the small window)
- `controls` lists the model’s own sliders, play buttons, menus and checkboxes
- `global: false` hides the shared rotation sliders for models that drive themselves
- `text`, `formulas`, and `code` fill the section under the viewer.

The comment at the top of `js/main.js` lists every option.

The code panel shows `fn.toString()` of the functions listed in `code`, so it always matches what runs.

## Libraries (loaded from CDNs)

- [three.js](https://threejs.org) 0.160.0, for 3D
- [KaTeX](https://katex.org) 0.16.9, for formulas (rendered as MathML)
- [Prism](https://prismjs.com) 1.29.0, for code highlighting
- IBM Plex fonts from Google Fonts
