(function () {
    const SAMPLE_EXPRESSIONS = [
        '(a + b)*c - (x - y)/z',
        '(a * b) - c + z / x',
        'sin(a)+cos(b)',
        'sin(a+b)*cos(c)',
        'sin(#add(a,b))*#pi',
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
    var themeToggle = document.getElementById('theme-toggle')
    var exportPopover = document.getElementById('export-popover')
    var pngScaleRow = document.getElementById('png-scale-row')
    var pngScale = document.getElementById('png-scale')
    var formatInputs = document.querySelectorAll('input[name="export-format"]')
    var downloadExport = document.getElementById('download-export')

    var debounceId = null
    var currentRoot = null

    function resizeCanvas() {
        canvas.height = container.offsetHeight
        canvas.width = container.offsetWidth
    }

    function clearCanvas() {
        context.clearRect(0, 0, canvas.width, canvas.height)
    }

    function setWarningVisible(isVisible) {
        warning.hidden = !isVisible
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
            setWarningVisible(false)
            return
        }

        expression = expression.replace(/\s+/g, '')
        if (expression.length === 0) {
            currentRoot = null
            setWarningVisible(false)
            clearCanvas()
            return
        }

        try {
            var postfix = infixToPostfix(expression)
            if (postfix === null) {
                setWarningVisible(true)
                return
            }
            var root = constructTree(postfix)
            currentRoot = root
            setWarningVisible(false)
            renderRoot(root)
        } catch (error) {
            setWarningVisible(true)
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

    function exportPng(scale) {
        if (!currentRoot) {
            return
        }
        var exportScale = Math.max(1, scale || 1)
        var offscreen = document.createElement('canvas')
        offscreen.width = canvas.width * exportScale
        offscreen.height = canvas.height * exportScale
        var offscreenContext = offscreen.getContext('2d')
        offscreenContext.scale(exportScale, exportScale)
        drawTree(currentRoot, offscreenContext)
        triggerDownload(offscreen.toDataURL('image/png'), 'expression-tree.png')
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

    function treeToSvg(root) {
        if (!root) {
            return ''
        }
        var measureCanvas = document.createElement('canvas')
        var measureContext = measureCanvas.getContext('2d')
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
            var fontSize = getNodeFontSize(node.value, measureContext)
            nodes.push('<g><circle cx="' + node.x + '" cy="' + node.y + '" r="' + radius + '" fill="' + colors.nodeFill + '" stroke="' + colors.nodeStroke + '" /><text x="' + node.x + '" y="' + node.y + '" fill="' + colors.text + '" font-family="Times New Roman" font-size="' + fontSize + '" text-anchor="middle" dominant-baseline="middle">' + escapeXml(node.value) + '</text></g>')
        }

        walk(root)
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvas.width + '" height="' + canvas.height + '" viewBox="0 0 ' + canvas.width + ' ' + canvas.height + '">' +
            '<g stroke-width="2" fill="none">' + lines.join('') + '</g>' +
            nodes.join('') +
            '</svg>'
    }

    function exportSvg() {
        if (!currentRoot) {
            return
        }
        var svgString = treeToSvg(currentRoot)
        var blob = new Blob([svgString], { type: 'image/svg+xml' })
        var url = URL.createObjectURL(blob)
        triggerDownload(url, 'expression-tree.svg')
        setTimeout(function () {
            URL.revokeObjectURL(url)
        }, 1000)
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
        if (currentRoot) {
            renderRoot(currentRoot)
        } else {
            clearCanvas()
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
        setWarningVisible(false)
        clearCanvas()
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
