const TREE_BINARY_OPERATORS = ['*', '/', '-', '+']
const TREE_UNARY_FUNCTIONS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'exp', 'abs']

function isBinaryOperator(token) {
    return TREE_BINARY_OPERATORS.includes(token)
}

function isUnaryFunction(token) {
    return TREE_UNARY_FUNCTIONS.includes(token)
}

function isCustomToken(token) {
    return token && typeof token === 'object' && token.type === 'custom' && typeof token.name === 'string'
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
    return 0
}

function getTokenLabel(token) {
    if (isCustomToken(token)) {
        return token.name
    }
    return token
}

function Node(value, arity = 0, children) {
    var self = this
    this.value = value;
    this.arity = arity;
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

    this.getRadius = function (context) {
        return 32.5
    }

    this.getFontSize = function (context) {
        const baseSize = 25
        const radius = this.getRadius(context)
        const maxTextWidth = (radius - 6) * 2
        context.font = baseSize + 'px Times New Roman'
        const textWidth = context.measureText(this.value).width
        if (textWidth <= maxTextWidth) {
            return baseSize
        }
        return Math.max(8, Math.floor(baseSize * (maxTextWidth / textWidth)))
    }

    this.drawEdge = function (context, childNode, resolve, animate) {
        const radius = this.getRadius(context)
        const childRadius = childNode.getRadius(context)
        context.strokeStyle = 'gray';
        const dx = childNode.x - this.x
        const dy = childNode.y - this.y
        const distance = Math.sqrt((dx * dx) + (dy * dy))
        if (distance === 0) {
            resolve()
            return
        }
        const startX = this.x + (dx / distance) * radius
        const startY = this.y + (dy / distance) * radius
        const endX = childNode.x - (dx / distance) * childRadius
        const endY = childNode.y - (dy / distance) * childRadius
        if (animate) {
            drawEdgeAnimated(startX, startY, endX, endY, context, resolve)
        } else {
            context.beginPath()
            context.moveTo(startX, startY)
            context.lineTo(endX, endY)
            context.stroke()
            resolve()
        }
    }

    this.draw = function (context) {
        const radius = this.getRadius(context)
        context.beginPath()
        context.arc(this.x, this.y, radius, 0, Math.PI * 2, false)
        context.fillStyle = 'white'
        context.fill()
        context.strokeStyle = '#212121'
        context.stroke()
        const fontSize = this.getFontSize(context)
        context.font = fontSize + 'px Times New Roman'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillStyle = "#212121";
        context.fillText(this.value, this.x, this.y);
    }
}

function drawEdgeAnimated(origin_x, origin_y, destine_x, destine_y, ctx, resolve) {
    const vertices = [{ x: origin_x, y: origin_y }, { x: destine_x, y: destine_y }]
    const N = 35;
    var waypoints = [];
    for (var i = 1; i < vertices.length; i++) {
        var pt0 = vertices[i - 1];
        var pt1 = vertices[i];
        var dx = pt1.x - pt0.x;
        var dy = pt1.y - pt0.y;
        for (var j = 0; j <= N; j++) {
            var x = pt0.x + dx * j / N;
            var y = pt0.y + dy * j / N;
            waypoints.push({ x: x, y: y });
        }
    }
    var t = 1
    function resolveCallback(callback) {
        function animate() {
            if (t < waypoints.length - 1) { requestAnimationFrame(animate) }
            else { callback() }
            ctx.beginPath();
            ctx.moveTo(waypoints[t - 1].x, waypoints[t - 1].y);
            ctx.lineTo(waypoints[t].x, waypoints[t].y);
            ctx.stroke();
            t++;
        }
        return animate
    }

    requestAnimationFrame(resolveCallback(resolve))
}

function constructTree(postfix) {
    var stack = []
    for (var i = 0; i < postfix.length; i++) {
        var token = postfix[i]
        var arity = getTokenArity(token)
        if (arity === 0) {
            stack.push(new Node(getTokenLabel(token), 0, []))
        } else {
            if (stack.length < arity) {
                throw new Error('Invalid postfix expression')
            }
            var children = stack.splice(stack.length - arity, arity)
            stack.push(new Node(getTokenLabel(token), arity, children))
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

// must be async in order to await till animation is done
async function drawTree(root, context, animate = true) {
    if (null != root) {
        root.draw(context)
        for (var i = 0; i < root.children.length; i++) {
            var child = root.children[i]
            await new Promise(resolve => root.drawEdge(context, child, resolve, animate))
            await drawTree(child, context, animate)
        }
    }
}
