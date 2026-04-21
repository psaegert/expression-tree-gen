const TREE_BINARY_OPERATORS = ['*', '/', '-', '+']
const TREE_UNARY_FUNCTIONS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'exp', 'abs']

// Names recognized as math symbols / operators for custom tokens with an
// explicit backslash prefix. Keys are the LaTeX command name (without the
// leading '\'), so '#\pi' -> lookup 'pi' -> '\pi'.
const LATEX_SYMBOL_MAP = {
    // Greek (lowercase)
    'alpha': '\\alpha', 'beta': '\\beta', 'gamma': '\\gamma', 'delta': '\\delta',
    'epsilon': '\\epsilon', 'varepsilon': '\\varepsilon', 'zeta': '\\zeta', 'eta': '\\eta',
    'theta': '\\theta', 'vartheta': '\\vartheta', 'iota': '\\iota', 'kappa': '\\kappa',
    'lambda': '\\lambda', 'mu': '\\mu', 'nu': '\\nu', 'xi': '\\xi', 'omicron': 'o',
    'pi': '\\pi', 'varpi': '\\varpi', 'rho': '\\rho', 'varrho': '\\varrho',
    'sigma': '\\sigma', 'varsigma': '\\varsigma', 'tau': '\\tau', 'upsilon': '\\upsilon',
    'phi': '\\phi', 'varphi': '\\varphi', 'chi': '\\chi', 'psi': '\\psi', 'omega': '\\omega',
    // Greek (uppercase)
    'Gamma': '\\Gamma', 'Delta': '\\Delta', 'Theta': '\\Theta', 'Lambda': '\\Lambda',
    'Xi': '\\Xi', 'Pi': '\\Pi', 'Sigma': '\\Sigma', 'Upsilon': '\\Upsilon',
    'Phi': '\\Phi', 'Psi': '\\Psi', 'Omega': '\\Omega',
    // Common constants / operators
    'infty': '\\infty', 'infinity': '\\infty',
    'sum': '\\sum', 'prod': '\\prod', 'int': '\\int',
    'nabla': '\\nabla', 'partial': '\\partial',
    'emptyset': '\\emptyset'
}

// Escape a plain string so it is safe inside LaTeX \text{...}.
// Done in a single pass so substitutions cannot re-escape each other
// (e.g. the braces produced by \textbackslash{} must not be treated as
// further `{`/`}` occurrences in the input).
function escapeLatexText(value) {
    var replacements = {
        '\\': '\\textbackslash{}',
        '&': '\\&',
        '%': '\\%',
        '$': '\\$',
        '#': '\\#',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
        '^': '\\^{}',
        '~': '\\~{}'
    }
    return String(value == null ? '' : value).replace(/[\\&%$#_{}^~]/g, function (ch) {
        return replacements[ch]
    })
}

// Convert an identifier like "x1", "a_2", "theta12" into LaTeX with a trailing subscript.
// Returns an object { latex, handled } where `handled` is false if the identifier
// should fall through to the default mapping.
function identifierToLatex(name) {
    if (typeof name !== 'string' || name.length === 0) {
        return { latex: '', handled: false }
    }
    // Detect an optional leading backslash that marks the identifier as a
    // LaTeX command. It is stripped while splitting on "_" / trailing digits
    // and re-attached before looking up the base identifier.
    var prefix = ''
    var bare = name
    if (bare.charAt(0) === '\\') {
        prefix = '\\'
        bare = bare.slice(1)
    }
    // Explicit underscore split: everything after the first `_` becomes the subscript.
    var underscoreIdx = bare.indexOf('_')
    if (underscoreIdx > 0 && underscoreIdx < bare.length - 1) {
        var base = bare.slice(0, underscoreIdx)
        var sub = bare.slice(underscoreIdx + 1)
        var baseLatex = baseIdentifierToLatex(prefix + base)
        return { latex: baseLatex + '_{' + escapeLatexText(sub) + '}', handled: true }
    }
    // Trailing digits: "x1" -> x_{1}, "theta12" -> \theta_{12}.
    var match = bare.match(/^([A-Za-z]+)(\d+)$/)
    if (match) {
        var baseLatex2 = baseIdentifierToLatex(prefix + match[1])
        return { latex: baseLatex2 + '_{' + match[2] + '}', handled: true }
    }
    return { latex: baseIdentifierToLatex(name), handled: true }
}

// Map a bare alphabetic identifier (no digits, no underscores) to LaTeX:
//   - single letter                    -> as-is (rendered italic in math mode)
//   - "\name" with name in symbol map  -> mapped LaTeX command (e.g. "\pi")
//   - "\name" not in symbol map        -> passed through as raw "\name" command
//   - anything else                    -> \mathrm{name}
function baseIdentifierToLatex(name) {
    if (name.charAt(0) === '\\') {
        var bare = name.slice(1)
        if (Object.prototype.hasOwnProperty.call(LATEX_SYMBOL_MAP, bare)) {
            return LATEX_SYMBOL_MAP[bare]
        }
        // Pass any other "\foo" through so users can reach arbitrary LaTeX
        // commands; KaTeX will render it or fall back gracefully.
        return name
    }
    if (name.length === 1) {
        return name
    }
    return '\\mathrm{' + escapeLatexText(name) + '}'
}

// Produce the LaTeX source that should be rendered inside a node for the given token.
function getTokenLatex(token) {
    if (isLiteralToken(token)) {
        if (token.kind === 'latex') {
            return token.value
        }
        return '\\text{' + escapeLatexText(token.value) + '}'
    }
    if (isCustomToken(token)) {
        var info = identifierToLatex(token.name)
        return info.latex || '\\text{' + escapeLatexText(token.name) + '}'
    }
    if (isBinaryOperator(token)) {
        if (token === '*') { return '\\cdot' }
        if (token === '/') { return '\\div' }
        return token
    }
    if (isUnaryFunction(token)) {
        if (token === 'sqrt') { return '\\sqrt{\\;}' }
        if (token === 'abs') { return '\\lvert\\,\\cdot\\,\\rvert' }
        // sin, cos, tan, log, ln, exp all have \-prefixed LaTeX commands.
        return '\\' + token
    }
    if (typeof token === 'string') {
        // Numeric literal: render digits as-is in math mode.
        if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
            return token
        }
        var ident = identifierToLatex(token)
        if (ident.handled) {
            return ident.latex
        }
        return '\\text{' + escapeLatexText(token) + '}'
    }
    return '\\text{' + escapeLatexText(String(token)) + '}'
}

function isBinaryOperator(token) {
    return TREE_BINARY_OPERATORS.includes(token)
}

function isUnaryFunction(token) {
    return TREE_UNARY_FUNCTIONS.includes(token)
}

function isCustomToken(token) {
    return token && typeof token === 'object' && token.type === 'custom' && typeof token.name === 'string'
}

function isLiteralToken(token) {
    return token && typeof token === 'object' && token.type === 'literal' &&
        (token.kind === 'text' || token.kind === 'latex') && typeof token.value === 'string'
}

function getTokenArity(token) {
    if (isBinaryOperator(token)) {
        return 2
    }
    if (isUnaryFunction(token)) {
        return 1
    }
    if (isCustomToken(token)) {
        return token.arity || 0
    }
    if (isLiteralToken(token)) {
        return token.arity || 0
    }
    return 0
}

function getTokenLabel(token) {
    if (isCustomToken(token)) {
        return token.name
    }
    if (isLiteralToken(token)) {
        return token.value
    }
    return token
}

function getNodeRadius() {
    return 32.5
}

function getNodeFontSize(value, context) {
    const baseSize = 25
    const radius = getNodeRadius()
    const maxTextWidth = (radius - 6) * 2
    context.font = baseSize + 'px Times New Roman'
    const textWidth = context.measureText(value).width
    if (textWidth <= maxTextWidth) {
        return baseSize
    }
    return Math.max(8, Math.floor(baseSize * (maxTextWidth / textWidth)))
}

// ---------------------------------------------------------------------------
// LaTeX label rasterization cache
// ---------------------------------------------------------------------------
// The canvas 2D API cannot render LaTeX directly, so we rasterize each
// (latex, color) pair via KaTeX -> HTML -> <foreignObject> SVG -> <img>.
// The cache is keyed by "<latex>|<color>" so theme switches (which change
// --fg) transparently produce a new rendering.
// ---------------------------------------------------------------------------

const KATEX_VERSION = '0.16.11'
const KATEX_FONT_BASE = 'https://cdn.jsdelivr.net/npm/katex@' + KATEX_VERSION + '/dist/'
const KATEX_CSS_URL = KATEX_FONT_BASE + 'katex.min.css'
const LATEX_BASE_FONT_SIZE = 25

var latexImageCache = new Map()
var latexRerenderHandler = null
var katexCssPromise = null

function setLatexRerenderHandler(handler) {
    latexRerenderHandler = handler
}

function invalidateLatexCache() {
    latexImageCache = new Map()
}

// Fetch the KaTeX stylesheet so rasterized images and exported SVGs render
// correctly (font files, spacing, radicals, etc.). The fetch is lazy and
// shared across all callers. Font URLs are rewritten to absolute so they
// resolve from inside data: URLs and downloaded SVGs.
function getKatexCss() {
    if (!katexCssPromise) {
        if (typeof fetch !== 'function') {
            katexCssPromise = Promise.resolve('')
        } else {
            katexCssPromise = fetch(KATEX_CSS_URL)
                .then(function (response) {
                    return response.ok ? response.text() : ''
                })
                .then(function (css) {
                    return css.replace(/url\(fonts\//g, 'url(' + KATEX_FONT_BASE + 'fonts/')
                })
                .catch(function () { return '' })
        }
    }
    return katexCssPromise
}

function renderLatexToHtml(latex) {
    if (typeof katex === 'undefined' || !katex || typeof katex.renderToString !== 'function') {
        return null
    }
    try {
        return katex.renderToString(latex, { throwOnError: false, output: 'html', displayMode: false })
    } catch (error) {
        return null
    }
}

// Extra pixels added to each side of the measured LaTeX bounding box when
// building the rasterized SVG. getBoundingClientRect() on KaTeX output does
// not account for the italic overshoot of math letters (e.g. the curved
// right edge of an italic `b`), which otherwise gets clipped at the SVG
// boundary. A small padding buffer keeps the glyph fully visible.
const LATEX_RASTER_PADDING_X = 4
const LATEX_RASTER_PADDING_Y = 2

function measureLatexHtml(html, color) {
    var measure = document.createElement('div')
    measure.setAttribute('aria-hidden', 'true')
    measure.style.cssText =
        'position:absolute;left:-9999px;top:-9999px;visibility:hidden;' +
        'color:' + color + ';font-size:' + LATEX_BASE_FONT_SIZE + 'px;' +
        'line-height:1.2;display:inline-block;white-space:nowrap;'
    measure.innerHTML = html
    document.body.appendChild(measure)
    var rect = measure.getBoundingClientRect()
    document.body.removeChild(measure)
    return {
        width: Math.max(1, Math.ceil(rect.width) + LATEX_RASTER_PADDING_X * 2),
        height: Math.max(1, Math.ceil(rect.height) + LATEX_RASTER_PADDING_Y * 2)
    }
}

function buildLatexSvg(html, width, height, color, cssText) {
    var style = cssText ? '<style>' + cssText + '</style>' : ''
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
        style +
        '<foreignObject width="100%" height="100%">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="color:' + color +
        ';font-size:' + LATEX_BASE_FONT_SIZE + 'px;line-height:1.2;' +
        'width:100%;height:100%;display:flex;align-items:center;justify-content:center;">' +
        '<span style="white-space:nowrap;">' + html + '</span>' +
        '</div>' +
        '</foreignObject></svg>'
}

// Returns a cache entry: { ready, image, width, height }.
// The entry object is returned synchronously; when the underlying image
// finishes loading, `ready` flips to true and the registered rerender
// handler is invoked so the node can be redrawn.
function getLatexImage(latex, color) {
    var key = latex + '|' + color
    var cached = latexImageCache.get(key)
    if (cached) { return cached }

    var entry = { ready: false, image: null, width: 0, height: 0 }
    latexImageCache.set(key, entry)

    var html = renderLatexToHtml(latex)
    if (html === null) {
        // KaTeX unavailable / failed: leave entry unready so the caller
        // falls back to plain text. Retry once KaTeX becomes available.
        if (typeof window !== 'undefined' && typeof katex === 'undefined') {
            var retry = function () {
                if (latexImageCache.get(key) === entry && !entry.ready) {
                    latexImageCache.delete(key)
                    if (latexRerenderHandler) { latexRerenderHandler() }
                }
            }
            if (typeof document !== 'undefined' && document.readyState === 'complete') {
                // `load` has already fired; try again on the next tick so the
                // CDN script (if still loading) has a chance to finish.
                setTimeout(retry, 0)
            } else {
                window.addEventListener('load', retry, { once: true })
            }
        }
        return entry
    }

    var size = measureLatexHtml(html, color)
    entry.width = size.width
    entry.height = size.height

    getKatexCss().then(function (cssText) {
        var svg = buildLatexSvg(html, size.width, size.height, color, cssText)
        var image = new Image()
        image.onload = function () {
            entry.image = image
            entry.ready = true
            if (latexRerenderHandler) { latexRerenderHandler() }
        }
        image.onerror = function () {
            // Leave entry unready so callers fall back to plain text.
        }
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })

    return entry
}

// Warm the cache for every label in the given tree and resolve once all
// images have loaded (or failed). Used before PNG export so the offscreen
// draw has the rasters ready.
function warmLatexCache(root, color) {
    var promises = []
    function walk(node) {
        if (!node) { return }
        var entry = getLatexImage(node.latex, color)
        if (!entry.ready && entry.width > 0) {
            promises.push(new Promise(function (resolve) {
                var resolved = false
                var pollId = 0
                var timeoutId = 0
                var finish = function () {
                    if (resolved) { return }
                    resolved = true
                    if (pollId) { clearTimeout(pollId) }
                    if (timeoutId) { clearTimeout(timeoutId) }
                    resolve()
                }
                var check = function () {
                    if (entry.ready) { finish() }
                    else { pollId = setTimeout(check, 30) }
                }
                // Cap the wait so a broken image never blocks export forever.
                timeoutId = setTimeout(finish, 2000)
                check()
            }))
        }
        for (var i = 0; i < node.children.length; i++) { walk(node.children[i]) }
    }
    walk(root)
    return Promise.all(promises)
}

function Node(value, arity = 0, children, latex, rawLabel) {
    var self = this
    this.value = value;
    this.arity = arity;
    this.latex = (typeof latex === 'string' && latex.length > 0) ? latex : ('\\text{' + escapeLatexText(String(value)) + '}')
    this.rawLabel = (typeof rawLabel === 'string') ? rawLabel : String(value)
    this.x = null;
    this.y = null;
    this.children = children || [];

    Object.defineProperty(this, 'left', {
        get: function () {
            return self.children[0] || null
        },
        set: function (node) {
            self.children[0] = node
        }
    })
    Object.defineProperty(this, 'right', {
        get: function () {
            return self.children[1] || null
        },
        set: function (node) {
            self.children[1] = node
        }
    })

    this.isLeaf = () => this.children.length === 0;

    this.getRadius = function () {
        return getNodeRadius()
    }

    this.getFontSize = function (context) {
        return getNodeFontSize(this.value, context)
    }

    this.drawEdge = function (context, childNode) {
        const styles = getComputedStyle(document.documentElement)
        const radius = this.getRadius(context)
        const childRadius = childNode.getRadius(context)
        const edgeColor = styles.getPropertyValue('--edge').trim() || '#9e9e9e'
        context.strokeStyle = edgeColor
        const dx = childNode.x - this.x
        const dy = childNode.y - this.y
        const distance = Math.sqrt((dx * dx) + (dy * dy))
        if (distance === 0) {
            return
        }
        const startX = this.x + (dx / distance) * radius
        const startY = this.y + (dy / distance) * radius
        const endX = childNode.x - (dx / distance) * childRadius
        const endY = childNode.y - (dy / distance) * childRadius
        context.beginPath()
        context.moveTo(startX, startY)
        context.lineTo(endX, endY)
        context.stroke()
    }

    this.drawFallbackLabel = function (context, textColor) {
        const fontSize = this.getFontSize(context)
        context.font = fontSize + 'px Times New Roman'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillStyle = textColor
        context.fillText(this.rawLabel, this.x, this.y)
    }

    this.draw = function (context) {
        const styles = getComputedStyle(document.documentElement)
        const radius = this.getRadius(context)
        const nodeFill = styles.getPropertyValue('--node-fill').trim() || '#ffffff'
        const nodeStroke = styles.getPropertyValue('--node-stroke').trim() || '#212121'
        const textColor = styles.getPropertyValue('--fg').trim() || '#212121'

        context.beginPath()
        context.arc(this.x, this.y, radius, 0, Math.PI * 2, false)
        context.fillStyle = nodeFill
        context.fill()
        context.strokeStyle = nodeStroke
        context.stroke()

        var entry = getLatexImage(this.latex, textColor)
        if (entry && entry.ready && entry.image) {
            const maxDim = (radius - 6) * 2
            var w = entry.width
            var h = entry.height
            var scale = Math.min(1, maxDim / w, maxDim / h)
            var drawW = w * scale
            var drawH = h * scale
            context.drawImage(entry.image, this.x - drawW / 2, this.y - drawH / 2, drawW, drawH)
        } else {
            this.drawFallbackLabel(context, textColor)
        }
    }
}

function constructTree(postfix) {
    var stack = []
    for (var i = 0; i < postfix.length; i++) {
        var token = postfix[i]
        var arity = getTokenArity(token)
        var label = getTokenLabel(token)
        var latex = getTokenLatex(token)
        if (arity === 0) {
            stack.push(new Node(label, 0, [], latex, label))
        } else {
            if (stack.length < arity) {
                throw new Error('Invalid postfix expression')
            }
            var children = stack.splice(stack.length - arity, arity)
            stack.push(new Node(label, arity, children, latex, label))
        }
    }
    if (stack.length !== 1) {
        throw new Error('Invalid postfix expression')
    }
    return stack[0];
}

function getSize(root) {
    var size = 0
    function countSize(root) {
        if (null != root) {
            size++;
            for (var i = 0; i < root.children.length; i++) {
                countSize(root.children[i])
            }
        }
    }
    countSize(root);
    return size;
}

function print_coords(root) {
    if (null != root) {
        console.log(root.value, root.x, root.y)
        for (var i = 0; i < root.children.length; i++) {
            print_coords(root.children[i])
        }
    }
}

function setCoordinates(root) {
    const OFFSET = 50
    const HORIZONTAL_SPACING = 80
    if (null == root) {
        return
    }

    function getLeafCount(node) {
        if (node.children.length === 0) {
            node.leafCount = 1
            return 1
        }
        var leaves = 0
        for (var j = 0; j < node.children.length; j++) {
            leaves += getLeafCount(node.children[j])
        }
        node.leafCount = leaves
        return leaves
    }

    const size = getLeafCount(root)
    const canvas_mid_point = window.innerWidth / 2;
    function assignCoordinates(node, depth, startX, endX) {
        node.x = (startX + endX) / 2
        node.y = 1.75 * OFFSET + (depth * 1.5 * OFFSET)
        if (node.children.length === 0) {
            return
        }
        var totalLeaves = 0
        for (var i = 0; i < node.children.length; i++) {
            totalLeaves += node.children[i].leafCount
        }
        var currentX = startX
        for (var childIndex = 0; childIndex < node.children.length; childIndex++) {
            var child = node.children[childIndex]
            var width = (endX - startX) * (child.leafCount / totalLeaves)
            assignCoordinates(child, depth + 1, currentX, currentX + width)
            currentX += width
        }
    }
    var totalWidth = size * HORIZONTAL_SPACING
    assignCoordinates(root, 0, canvas_mid_point - (totalWidth / 2), canvas_mid_point + (totalWidth / 2))
}

function drawTree(root, context) {
    if (null != root) {
        root.draw(context)
        for (var i = 0; i < root.children.length; i++) {
            var child = root.children[i]
            root.drawEdge(context, child)
            drawTree(child, context)
        }
    }
}
