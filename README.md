# expression-tree-gen
Building an expression tree of an arithmetic expression is something quite useful and it is one of the steps a compilers must take to generate machine code.

With that in mind, and inspired on my lectures on the tree data structure I decided to create a web app that simulates the creation of such a tree given an expression.

Visit this [website](https://lnogueir.github.io/expression-tree-gen/) to simulate an expression yourself.

Supported syntax includes:
- Binary operators: `+`, `-`, `*`, `/`
- Single-letter variables: `a`-`z`
- Unary functions: `sin`, `cos`, `tan`, `log`, `ln`, `sqrt`, `exp`, `abs`
- Custom operators/functions:
  - Arity 0: `#pi`
  - Arity 1-3 (inferred): `#sign(a)`, `#add(a,b)`, `#clamp(x,a,b)`

Examples:
- `a+b`
- `sin(a)`
- `sin(a)+cos(b)`
- `sin(cos(a))`
- `sin(a+b)*cos(c)`
- `#pi`
- `#sign(a)`
- `#add(a,b)`
- `sin(#add(a,b))*#pi`
- `#clamp(x,a,b)`

## LaTeX-rendered node labels

Node labels are typeset with [KaTeX](https://katex.org/) (loaded from a CDN,
so no build step is required) for both the interactive canvas and the
exported PNG / SVG files. A few conventions make common symbols render
nicely out of the box:

- **Operators**: `*` renders as `·` (`\cdot`), `/` as `÷` (`\div`); `+`
  and `-` are left as-is.
- **Unary functions**: `sin`, `cos`, `tan`, `log`, `ln`, `exp` render in
  upright math style; `sqrt` shows a radical (`√`) and `abs` shows
  `|·|`.
- **Custom token symbols**: well-known names are mapped to their LaTeX
  command, e.g. `#pi` → π, `#theta` → θ, `#alpha` → α, `#beta` → β,
  `#gamma` → γ, `#lambda` → λ, `#mu` → μ, `#sigma` → σ, `#phi` → φ,
  `#omega` → ω (plus uppercase variants like `#Gamma`, `#Delta`,
  `#Sigma`, `#Omega`, …), `#infty` / `#infinity` → ∞, `#sum` → ∑,
  `#prod` → ∏, `#int` → ∫, `#nabla` → ∇, `#partial` → ∂,
  `#emptyset` → ∅.
- **Subscripts**: identifiers ending in digits are rendered with the
  digits as a subscript — `x1` → *x*₁, `#theta12` → θ₁₂. An underscore
  also introduces a subscript — `#a_foo` → *a*<sub>foo</sub>.
- **Unknown custom names** fall back to upright `\mathrm{name}` so they
  remain legible without looking like variable products.

If KaTeX fails to load or a label cannot be parsed, the node falls back
to rendering the raw token text, so expressions will always be
displayed.

## Credits:

* This [article](https://llimllib.github.io/pymag-trees/) which helped me a lot introducing me to Knuth's algorithm for the layout of the tree.
* This [article](http://ice-web.cc.gatech.edu/ce21/1/static/audio/static/pythonds/BasicDS/InfixPrefixandPostfixExpressions.html) which introduced me to Dijkstra's Shunting-yard algorithm.
* The [mycodeschool](https://www.youtube.com/user/mycodeschool) youtube channel with great videos explaning the algorithms said above.
