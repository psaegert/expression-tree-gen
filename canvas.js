(function () {
    const SAMPLE_EXPRESSIONS = [
        '(a + b)*c - (x - y)/z',
        '(a * b) - c + z / x',
        'sin(a)+cos(b)',
        'sin(a+b)*cos(c)',
        'sin(#add(a,b))*#\\pi',
        '#clamp(x,#min(a,b),c)',
        'x - y + (c / (a + b))',
        '(a / y) + b - (c * x)',
        '(a - b) * (c + d) / z'
    ]
    const THEME_STORAGE_KEY = 'etg-theme'
    const DEBOUNCE_MS = 150

    var canvas = document.querySelector('canvas')
    var context = canvas.getContext('2d')
    var container = document.getElementById('canvas-container')
    var input = document.getElementById('expression-input')
    var warning = document.getElementById('warning')
    var errorMessage = document.getElementById('error-message')
    var themeToggle = document.getElementById('theme-toggle')
    var exportPopover = document.getElementById('export-popover')
    var pngScaleRow = document.getElementById('png-scale-row')
    var pngScale = document.getElementById('png-scale')
    var formatInputs = document.querySelectorAll('input[name="export-format"]')
    var downloadExport = document.getElementById('download-export')
    var copyExport = document.getElementById('copy-export')
    var copyInput = document.getElementById('copy-input')
    var exportStatus = document.getElementById('export-status')

    var debounceId = null
    var currentRoot = null
    var cssWidth = 0
    var cssHeight = 0

    function resizeCanvas() {
        var dpr = Math.max(1, window.devicePixelRatio || 1)
        cssWidth = container.offsetWidth
        cssHeight = container.offsetHeight
        canvas.width = Math.round(cssWidth * dpr)
        canvas.height = Math.round(cssHeight * dpr)
        canvas.style.width = cssWidth + 'px'
        canvas.style.height = cssHeight + 'px'
        // All drawing uses CSS pixels; the transform scales up to the
        // high-resolution backing store so the tree stays crisp on HiDPI
        // / mobile displays.
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function clearCanvas() {
        context.save()
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.restore()
    }

    function setWarningVisible(isVisible) {
        warning.hidden = !isVisible
    }

    function setErrorMessage(message) {
        if (message) {
            errorMessage.textContent = message
            errorMessage.hidden = false
        } else {
            errorMessage.textContent = ''
            errorMessage.hidden = true
        }
    }

    function showError(message) {
        setWarningVisible(true)
        setErrorMessage(message)
    }

    function clearError() {
        setWarningVisible(false)
        setErrorMessage('')
    }

    function renderRoot(root) {
        clearCanvas()
        if (!root) {
            return
        }
        setCoordinates(root)
        drawTree(root, context)
    }

    function renderExpression() {
        var expression = input.value
        if (typeof expression === 'undefined' || expression === null) {
            clearError()
            return
        }

        if (expression.trim().length === 0) {
            currentRoot = null
            clearError()
            clearCanvas()
            updateCanvasAccessibility('')
            return
        }

        try {
            var postfix = infixToPostfix(expression)
            var root = constructTree(postfix)
            currentRoot = root
            clearError()
            renderRoot(root)
            updateCanvasAccessibility(expression)
        } catch (error) {
            showError((error && error.message) ? error.message : 'Invalid expression')
        }
    }

    function debouncedRender() {
        clearTimeout(debounceId)
        debounceId = setTimeout(renderExpression, DEBOUNCE_MS)
    }

    function triggerDownload(url, filename) {
        var link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
    }

    function buildPngBlob(scale) {
        if (!currentRoot) {
            return Promise.resolve(null)
        }
        var exportScale = Math.max(1, scale || 1)
        var colors = getThemeColors()
        var warmPromise = (typeof warmLatexCache === 'function')
            ? warmLatexCache(currentRoot, colors.text)
            : Promise.resolve()
        return warmPromise.then(function () {
            var offscreen = document.createElement('canvas')
            offscreen.width = cssWidth * exportScale
            offscreen.height = cssHeight * exportScale
            var offscreenContext = offscreen.getContext('2d')
            offscreenContext.scale(exportScale, exportScale)
            drawTree(currentRoot, offscreenContext)
            return new Promise(function (resolve) {
                if (typeof offscreen.toBlob === 'function') {
                    offscreen.toBlob(function (blob) { resolve(blob) }, 'image/png')
                } else {
                    // Fallback: derive blob from data URL. Guard against a
                    // malformed data URL so we don't throw inside atob().
                    var dataUrl = offscreen.toDataURL('image/png')
                    var commaIndex = dataUrl.indexOf(',')
                    if (commaIndex === -1) {
                        resolve(null)
                        return
                    }
                    var binary = atob(dataUrl.slice(commaIndex + 1))
                    var bytes = new Uint8Array(binary.length)
                    for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i) }
                    resolve(new Blob([bytes], { type: 'image/png' }))
                }
            })
        })
    }

    function exportPng(scale) {
        return buildPngBlob(scale).then(function (blob) {
            if (!blob) { return }
            var url = URL.createObjectURL(blob)
            triggerDownload(url, 'expression-tree.png')
            setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
        })
    }

    function escapeXml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    }

    function getThemeColors() {
        var styles = getComputedStyle(document.documentElement)
        return {
            nodeFill: styles.getPropertyValue('--node-fill').trim() || '#ffffff',
            nodeStroke: styles.getPropertyValue('--node-stroke').trim() || '#212121',
            edge: styles.getPropertyValue('--edge').trim() || '#9e9e9e',
            text: styles.getPropertyValue('--fg').trim() || '#212121'
        }
    }

    function treeToSvg(root, cssText) {
        if (!root) {
            return ''
        }
        var radius = getNodeRadius()
        var colors = getThemeColors()
        var lines = []
        var nodes = []

        function walk(node) {
            for (var i = 0; i < node.children.length; i++) {
                var child = node.children[i]
                var dx = child.x - node.x
                var dy = child.y - node.y
                var distance = Math.sqrt((dx * dx) + (dy * dy))
                if (distance !== 0) {
                    var startX = node.x + (dx / distance) * radius
                    var startY = node.y + (dy / distance) * radius
                    var endX = child.x - (dx / distance) * radius
                    var endY = child.y - (dy / distance) * radius
                    lines.push('<line x1="' + startX + '" y1="' + startY + '" x2="' + endX + '" y2="' + endY + '" stroke="' + colors.edge + '" />')
                }
                walk(child)
            }

            var nodeSvg = '<g><circle cx="' + node.x + '" cy="' + node.y + '" r="' + radius +
                '" fill="' + colors.nodeFill + '" stroke="' + colors.nodeStroke + '" />'

            // Try to embed the KaTeX-rendered HTML as a foreignObject so the
            // exported SVG stays vector and editable. Fall back to a plain
            // <text> element with the raw label if KaTeX is unavailable.
            var html = (typeof renderLatexToHtml === 'function') ? renderLatexToHtml(node.latex) : null
            if (html) {
                var metrics = measureLatexHtml(html, colors.text)
                var maxDim = (radius - 6) * 2
                var scale = Math.min(1, maxDim / metrics.width, maxDim / metrics.height)
                var drawW = metrics.width * scale
                var drawH = metrics.height * scale
                var foX = node.x - drawW / 2
                var foY = node.y - drawH / 2
                nodeSvg += '<foreignObject x="' + foX + '" y="' + foY +
                    '" width="' + drawW + '" height="' + drawH + '">' +
                    '<div xmlns="http://www.w3.org/1999/xhtml" style="color:' + colors.text +
                    ';width:' + drawW + 'px;height:' + drawH + 'px;' +
                    'display:flex;align-items:center;justify-content:center;line-height:1.2;">' +
                    '<span style="display:inline-block;transform-origin:center;' +
                    'transform:scale(' + scale + ');white-space:nowrap;font-size:' +
                    '25px;">' + html + '</span></div></foreignObject>'
            } else {
                var fontSize = getNodeFontSize(node.rawLabel, measureContextForSvg())
                nodeSvg += '<text x="' + node.x + '" y="' + node.y + '" fill="' + colors.text +
                    '" font-family="Times New Roman" font-size="' + fontSize +
                    '" text-anchor="middle" dominant-baseline="middle">' +
                    escapeXml(node.rawLabel) + '</text>'
            }
            nodeSvg += '</g>'
            nodes.push(nodeSvg)
        }

        walk(root)
        var styleBlock = cssText ? '<defs><style type="text/css"><![CDATA[' + cssText + ']]></style></defs>' : ''
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="' + cssWidth + '" height="' + cssHeight + '" viewBox="0 0 ' + cssWidth + ' ' + cssHeight + '">' +
            styleBlock +
            '<g stroke-width="2" fill="none">' + lines.join('') + '</g>' +
            nodes.join('') +
            '</svg>'
    }

    var svgMeasureCanvas = null
    function measureContextForSvg() {
        if (!svgMeasureCanvas) {
            svgMeasureCanvas = document.createElement('canvas')
        }
        return svgMeasureCanvas.getContext('2d')
    }

    function buildSvgString() {
        if (!currentRoot) {
            return Promise.resolve('')
        }
        var cssPromise = (typeof getKatexCss === 'function') ? getKatexCss() : Promise.resolve('')
        return cssPromise.then(function (cssText) {
            return treeToSvg(currentRoot, cssText)
        })
    }

    function exportSvg() {
        return buildSvgString().then(function (svgString) {
            if (!svgString) { return }
            var blob = new Blob([svgString], { type: 'image/svg+xml' })
            var url = URL.createObjectURL(blob)
            triggerDownload(url, 'expression-tree.svg')
            setTimeout(function () {
                URL.revokeObjectURL(url)
            }, 1000)
        })
    }

    var statusTimeoutId = null
    function setExportStatus(message, isError) {
        if (!exportStatus) { return }
        exportStatus.textContent = message || ''
        if (isError) {
            exportStatus.classList.add('error')
        } else {
            exportStatus.classList.remove('error')
        }
        if (statusTimeoutId) { clearTimeout(statusTimeoutId) }
        if (message) {
            statusTimeoutId = setTimeout(function () {
                exportStatus.textContent = ''
                exportStatus.classList.remove('error')
            }, 2000)
        }
    }

    function canWriteClipboardItems() {
        return typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof navigator.clipboard.write === 'function' &&
            typeof window !== 'undefined' &&
            typeof window.ClipboardItem === 'function'
    }

    function copyPngToClipboard(scale) {
        if (!canWriteClipboardItems()) {
            setExportStatus('Clipboard image copy unsupported', true)
            return Promise.resolve()
        }
        return buildPngBlob(scale).then(function (blob) {
            if (!blob) { return }
            var item = new window.ClipboardItem({ 'image/png': blob })
            return navigator.clipboard.write([item]).then(function () {
                setExportStatus('Copied!', false)
            })
        }).catch(function () {
            setExportStatus('Copy failed', true)
        })
    }

    function copySvgToClipboard() {
        return buildSvgString().then(function (svgString) {
            if (!svgString) { return }
            // Prefer ClipboardItem so paste targets can pick up the SVG MIME
            // type, but fall back to plain text which works everywhere.
            if (canWriteClipboardItems()) {
                var blob = new Blob([svgString], { type: 'image/svg+xml' })
                var textBlob = new Blob([svgString], { type: 'text/plain' })
                var item = new window.ClipboardItem({
                    'image/svg+xml': blob,
                    'text/plain': textBlob
                })
                return navigator.clipboard.write([item]).then(function () {
                    setExportStatus('Copied!', false)
                }, function () {
                    return navigator.clipboard.writeText(svgString).then(function () {
                        setExportStatus('Copied as text', false)
                    })
                })
            }
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                return navigator.clipboard.writeText(svgString).then(function () {
                    setExportStatus('Copied as text', false)
                })
            }
            setExportStatus('Clipboard unsupported', true)
        }).catch(function () {
            setExportStatus('Copy failed', true)
        })
    }

    function getSelectedExportFormat() {
        for (var i = 0; i < formatInputs.length; i++) {
            if (formatInputs[i].checked) {
                return formatInputs[i].value
            }
        }
        return 'png'
    }

    function syncExportOptionsUi() {
        var isPng = getSelectedExportFormat() === 'png'
        pngScaleRow.hidden = !isPng
    }

    function getPreferredTheme() {
        var storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
        if (storedTheme === 'light' || storedTheme === 'dark') {
            return storedTheme
        }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    function applyTheme(theme, shouldPersist) {
        document.documentElement.setAttribute('data-theme', theme)
        if (shouldPersist) {
            localStorage.setItem(THEME_STORAGE_KEY, theme)
        }
        // Invalidate the rasterized LaTeX cache so labels re-render in the new --fg color.
        if (typeof invalidateLatexCache === 'function') {
            invalidateLatexCache()
        }
        if (currentRoot) {
            renderRoot(currentRoot)
        } else {
            clearCanvas()
        }
    }

    if (typeof setLatexRerenderHandler === 'function') {
        setLatexRerenderHandler(function () {
            if (currentRoot) {
                renderRoot(currentRoot)
            }
        })
    }

    function updateCanvasAccessibility(expression) {
        if (expression) {
            canvas.setAttribute('role', 'img')
            canvas.setAttribute('aria-label', 'Expression tree for ' + expression)
        } else {
            canvas.removeAttribute('role')
            canvas.removeAttribute('aria-label')
        }
    }

    resizeCanvas()

    window.addEventListener('resize', function () {
        resizeCanvas()
        if (currentRoot) {
            renderRoot(currentRoot)
        } else {
            clearCanvas()
        }
    })

    input.addEventListener('input', debouncedRender)

    document.getElementById('clear-tree').addEventListener('click', function () {
        input.value = ''
        currentRoot = null
        clearError()
        clearCanvas()
        updateCanvasAccessibility('')
        input.focus()
    })

    for (var formatIndex = 0; formatIndex < formatInputs.length; formatIndex++) {
        formatInputs[formatIndex].addEventListener('change', syncExportOptionsUi)
    }

    downloadExport.addEventListener('click', function () {
        if (getSelectedExportFormat() === 'svg') {
            exportSvg()
        } else {
            exportPng(parseInt(pngScale.value, 10) || 1)
        }
        exportPopover.open = false
    })

    if (copyExport) {
        copyExport.addEventListener('click', function () {
            if (!currentRoot) {
                setExportStatus('Nothing to copy', true)
                return
            }
            if (getSelectedExportFormat() === 'svg') {
                copySvgToClipboard()
            } else {
                copyPngToClipboard(parseInt(pngScale.value, 10) || 1)
            }
        })
    }

    if (copyInput) {
        var copyInputResetId = null
        copyInput.addEventListener('click', function () {
            var text = input.value || ''
            var showCopied = function () {
                copyInput.classList.add('copied')
                if (copyInputResetId) { clearTimeout(copyInputResetId) }
                copyInputResetId = setTimeout(function () {
                    copyInput.classList.remove('copied')
                }, 1500)
            }
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text).then(showCopied, function () {
                    // Ignore clipboard rejection (e.g. insecure context).
                })
            } else {
                // Fallback for environments without the async Clipboard API.
                // document.execCommand('copy') is deprecated but remains the
                // only option on older/insecure contexts.
                try {
                    input.focus()
                    input.select()
                    document.execCommand('copy')
                    showCopied()
                } catch (e) {
                    // No clipboard available; silently ignore.
                }
            }
        })
    }

    document.addEventListener('click', function (event) {
        if (!exportPopover.open) {
            return
        }
        if (!exportPopover.contains(event.target)) {
            exportPopover.open = false
        }
    })

    themeToggle.addEventListener('click', function () {
        var nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
        applyTheme(nextTheme, true)
    })

    applyTheme(getPreferredTheme(), false)
    syncExportOptionsUi()

    input.value = SAMPLE_EXPRESSIONS[Math.floor(Math.random() * SAMPLE_EXPRESSIONS.length)]
    renderExpression()
})();
