const TREE_BINARY_OPERATORS = ['*', '/', '-', '+']
const TREE_UNARY_FUNCTIONS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'exp', 'abs']

function isBinaryOperator(token) {
    return TREE_BINARY_OPERATORS.includes(token)
}

function isUnaryFunction(token) {
    return TREE_UNARY_FUNCTIONS.includes(token)
}

function Node(value, arity = 0) {
    this.value = value;
    this.arity = arity;
    this.x = null;
    this.y = null;
    this.right = null;
    this.left = null;

    this.isLeaf = () => this.right == null && this.left == null;

    this.getRadius = function (context) {
        context.font = '25px Times New Roman'
        const textWidth = context.measureText(this.value).width
        return Math.max(32.5, (textWidth / 2) + 10)
    }

    this.drawEdge = function (context, x, y, left_way, resolve) {
        const radius = this.getRadius(context)
        context.strokeStyle = 'gray';
        context.beginPath()
        const x_y_ratio = Math.abs(this.y - y) / Math.abs(this.x - x)
        const w = radius * Math.sqrt(1 / (1 + Math.pow(x_y_ratio, 2)))
        const d = x_y_ratio * w
        if (left_way) {
            drawEdgeAnimated(this.x - w, this.y + d, x + w, y - d, context, resolve)
        } else {
            drawEdgeAnimated(this.x + w, this.y + d, x - w, y - d, context, resolve)
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
        context.font = '25px Times New Roman'
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
        if (isBinaryOperator(token)) {
            if (stack.length < 2) {
                throw new Error('Invalid postfix expression')
            }
            var rightNode = stack.pop()
            var leftNode = stack.pop()
            var binaryNode = new Node(token, 2)
            binaryNode.left = leftNode
            binaryNode.right = rightNode
            stack.push(binaryNode)
        } else if (isUnaryFunction(token)) {
            if (stack.length < 1) {
                throw new Error('Invalid postfix expression')
            }
            var childNode = stack.pop()
            var unaryNode = new Node(token, 1)
            unaryNode.right = childNode
            stack.push(unaryNode)
        } else {
            stack.push(new Node(token, 0))
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
            countSize(root.left)
            countSize(root.right)
        }
    }
    countSize(root);
    return size;
}

function print_coords(root) {
    if (null != root) {
        print_coords(root.left)
        console.log(root.value, root.x, root.y)
        print_coords(root.right)
    }
}

function setCoordinates(root) {
    var i = 0
    const OFFSET = 50
    const size = getSize(root)
    const canvas_mid_point = window.innerWidth / 2;
    function setCoordinates(subt, depth) {
        if (null != subt) {
            setCoordinates(subt.left, depth + 1)
            subt.x = canvas_mid_point + (OFFSET * (i - size / 2))
            subt.y = 1.75 * OFFSET + (depth * 1.5 * OFFSET)
            i++
            setCoordinates(subt.right, depth + 1)
            if (subt.left === null && subt.right !== null) {
                subt.right.x = subt.x
            }
        }
    }
    setCoordinates(root, 0)
}

// must be async in order to await till animation is done
async function drawTree(root, context) {
    if (null != root) {
        root.draw(context)
        if (null != root.left) {
            await new Promise(resolve => root.drawEdge(context, root.left.x, root.left.y, true, resolve))
        }
        drawTree(root.left, context)
        if (null != root.right) {
            await new Promise(resolve => root.drawEdge(context, root.right.x, root.right.y, false, resolve))
        }
        drawTree(root.right, context)
    }
}
