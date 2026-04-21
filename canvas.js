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

    function exportCanvas() {
        var link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = 'expression-tree.png'
        link.click()
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

    document.getElementById('export-tree').addEventListener('click', exportCanvas)

    themeToggle.addEventListener('click', function () {
        var nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
        applyTheme(nextTheme, true)
    })

    applyTheme(getPreferredTheme(), false)

    input.value = SAMPLE_EXPRESSIONS[Math.floor(Math.random() * SAMPLE_EXPRESSIONS.length)]
    renderExpression()
})();
