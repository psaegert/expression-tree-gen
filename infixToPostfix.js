function isBracketed(expr) {
  var stack = []
  for (var i = 0; i < expr.length; i++) {
    if ('(' === expr[i]) {
      stack.push('(')
    } else if (')' === expr[i]) {
      stack.pop()
      if (stack.length === 0) {
        if (i !== expr.length - 1) {
          return false
        } else {
          return true
        }
      }
    }
  }
  return false;
}

const VARIABLES = 'abcdefghijklmnopqrstuvwxyz'
const BINARY_OPERATORS = ['*', '/', '-', '+']
const UNARY_FUNCTIONS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'exp', 'abs']

function tokenize(expression) {
  var tokens = []
  for (var i = 0; i < expression.length; i++) {
    var current = expression[i]
    if (current === ' ') {
      continue
    }
    if (BINARY_OPERATORS.indexOf(current) !== -1 || current === '(' || current === ')') {
      tokens.push(current)
      continue
    }
    if (VARIABLES.indexOf(current) !== -1) {
      var ident = current
      while (i + 1 < expression.length && VARIABLES.indexOf(expression[i + 1]) !== -1) {
        ident += expression[i + 1]
        i++
      }
      if (ident.length === 1) {
        tokens.push(ident)
      } else if (UNARY_FUNCTIONS.indexOf(ident) !== -1) {
        tokens.push(ident)
      } else {
        return null
      }
      continue
    }
    return null
  }
  return tokens
}

function hasUnaryPlusOrMinus(node) {
  if (!node || typeof node !== 'object') {
    return false
  }
  if (node.type === 'OperatorNode' && (node.fn === 'unaryPlus' || node.fn === 'unaryMinus')) {
    return true
  }
  if (node.args && node.args.length) {
    for (var i = 0; i < node.args.length; i++) {
      if (hasUnaryPlusOrMinus(node.args[i])) {
        return true
      }
    }
  }
  if (node.content && hasUnaryPlusOrMinus(node.content)) {
    return true
  }
  return false
}

function isValidParsedNode(node) {
  if (!node || typeof node !== 'object') {
    return false
  }
  if (node.type === 'ParenthesisNode') {
    return isValidParsedNode(node.content)
  }
  if (node.type === 'SymbolNode') {
    return typeof node.name === 'string' && node.name.length === 1 && VARIABLES.indexOf(node.name) !== -1
  }
  if (node.type === 'OperatorNode') {
    if (node.implicit === true) {
      return false
    }
    if (['add', 'subtract', 'multiply', 'divide'].indexOf(node.fn) === -1) {
      return false
    }
    if (!node.args || node.args.length !== 2) {
      return false
    }
    return isValidParsedNode(node.args[0]) && isValidParsedNode(node.args[1])
  }
  if (node.type === 'FunctionNode') {
    var fnName = node.fn && node.fn.name
    if (UNARY_FUNCTIONS.indexOf(fnName) === -1) {
      return false
    }
    if (!node.args || node.args.length !== 1) {
      return false
    }
    return isValidParsedNode(node.args[0])
  }
  return false
}

function isValidExpression(expr) {
  var tokens = tokenize(expr)
  if (null === tokens || tokens.length < 1) {
    return false;
  }
  try {
    while ("(" === expr[0] && ")" === expr[expr.length - 1]) {
      if (isBracketed(expr)) {
        expr = expr.substring(1, expr.length - 1);
      } else break;
    }
    var res = math.parse(expr);
    if (hasUnaryPlusOrMinus(res) || !isValidParsedNode(res)) {
      return false;
    }
    return true;
  }
  catch (ex) {
    return false;
  }
}

function infixToPostfix(expression) {
  if (!isValidExpression(expression)) {
    return null;
  }
  const prec = { "*": 3, "/": 3, "-": 2, "+": 2, "(": 1 }
  var op_stack = []
  var postfixList = []
  var tokens = tokenize(expression)
  if (null === tokens) {
    return null
  }
  for (const token of tokens) {
    if (VARIABLES.indexOf(token) !== -1 && token.length === 1) {
      postfixList.push(token)
    } else if (UNARY_FUNCTIONS.indexOf(token) !== -1) {
      op_stack.push(token)
    } else if ("(" === token) {
      op_stack.push(token)
    } else if (")" === token) {
      var top_op_token = op_stack.pop()
      while (top_op_token !== '(') {
        if (typeof top_op_token === 'undefined') {
          return null
        }
        postfixList.push(top_op_token)
        top_op_token = op_stack.pop()
      }
      var function_token = op_stack.slice(-1)[0]
      if (UNARY_FUNCTIONS.indexOf(function_token) !== -1) {
        postfixList.push(op_stack.pop())
      }
    } else {
      var peek_elem = op_stack.slice(-1)[0];
      while (
        op_stack.length > 0 &&
        (UNARY_FUNCTIONS.indexOf(peek_elem) !== -1 || prec[peek_elem] >= prec[token])
      ) {
        postfixList.push(op_stack.pop())
        peek_elem = op_stack.slice(-1)[0];
      }
      op_stack.push(token)
    }
  }
  while (op_stack.length > 0) {
    if (op_stack.slice(-1)[0] === '(') {
      return null
    }
    postfixList.push(op_stack.pop())
  }
  return postfixList
}
