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
const CUSTOM_IDENTIFIER_START = /[A-Za-z_]/
const CUSTOM_IDENTIFIER_BODY = /[A-Za-z0-9_]/
const ALLOWED_CHARACTERS_REGEX = /^[A-Za-z0-9_#,+\-*/()\s]*$/

function isCustomToken(token) {
  return token && typeof token === 'object' && token.type === 'custom' && typeof token.name === 'string'
}

function createCustomToken(name, arity) {
  var token = { type: 'custom', name: name }
  if (typeof arity === 'number') {
    token.arity = arity
  }
  return token
}

function isFunctionToken(token) {
  return UNARY_FUNCTIONS.indexOf(token) !== -1 || isCustomToken(token)
}

function isVariableToken(token) {
  return typeof token === 'string' && token.length === 1 && VARIABLES.indexOf(token) !== -1
}

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
    if (current === ',') {
      tokens.push(current)
      continue
    }
    if (current === '#') {
      if (i + 1 >= expression.length || !CUSTOM_IDENTIFIER_START.test(expression[i + 1])) {
        return null
      }
      var customName = expression[i + 1]
      i++
      while (i + 1 < expression.length && CUSTOM_IDENTIFIER_BODY.test(expression[i + 1])) {
        customName += expression[i + 1]
        i++
      }
      tokens.push(createCustomToken(customName))
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

function isStopToken(token, stopOnComma) {
  return typeof token === 'undefined' || token === ')' || (stopOnComma && token === ',')
}

function parsePrimary(tokens, index, stopOnComma) {
  var token = tokens[index]
  if (isStopToken(token, stopOnComma)) {
    return null
  }
  if (isVariableToken(token)) {
    return { nextIndex: index + 1 }
  }
  if (token === '(') {
    var grouped = parseAddSubtract(tokens, index + 1, stopOnComma)
    if (!grouped || tokens[grouped.nextIndex] !== ')') {
      return null
    }
    return { nextIndex: grouped.nextIndex + 1 }
  }
  if (UNARY_FUNCTIONS.indexOf(token) !== -1) {
    if (tokens[index + 1] !== '(') {
      return null
    }
    var unaryArg = parseAddSubtract(tokens, index + 2, false)
    if (!unaryArg || tokens[unaryArg.nextIndex] !== ')') {
      return null
    }
    return { nextIndex: unaryArg.nextIndex + 1 }
  }
  if (isCustomToken(token)) {
    if (tokens[index + 1] !== '(') {
      return { nextIndex: index + 1 }
    }
    var argsIndex = index + 2
    if (tokens[argsIndex] === ')') {
      return null
    }
    var arity = 0
    while (true) {
      var arg = parseAddSubtract(tokens, argsIndex, true)
      if (!arg) {
        return null
      }
      arity++
      if (arity > 3) {
        return null
      }
      argsIndex = arg.nextIndex
      if (tokens[argsIndex] === ',') {
        argsIndex++
        if (tokens[argsIndex] === ')' || typeof tokens[argsIndex] === 'undefined') {
          return null
        }
        continue
      }
      if (tokens[argsIndex] === ')') {
        return { nextIndex: argsIndex + 1 }
      }
      return null
    }
  }
  return null
}

function parseMultiplyDivide(tokens, index, stopOnComma) {
  var left = parsePrimary(tokens, index, stopOnComma)
  if (!left) {
    return null
  }
  var i = left.nextIndex
  while (tokens[i] === '*' || tokens[i] === '/') {
    var right = parsePrimary(tokens, i + 1, stopOnComma)
    if (!right) {
      return null
    }
    i = right.nextIndex
  }
  return { nextIndex: i }
}

function parseAddSubtract(tokens, index, stopOnComma) {
  var left = parseMultiplyDivide(tokens, index, stopOnComma)
  if (!left) {
    return null
  }
  var i = left.nextIndex
  while (tokens[i] === '+' || tokens[i] === '-') {
    var right = parseMultiplyDivide(tokens, i + 1, stopOnComma)
    if (!right) {
      return null
    }
    i = right.nextIndex
  }
  return { nextIndex: i }
}

function isValidCustomExpression(tokens) {
  var parsed = parseAddSubtract(tokens, 0, false)
  return !!parsed && parsed.nextIndex === tokens.length
}

function containsUnaryPlusOrMinus(node) {
  if (!node || typeof node !== 'object') {
    return false
  }
  if (node.type === 'OperatorNode' && (node.fn === 'unaryPlus' || node.fn === 'unaryMinus')) {
    return true
  }
  if (node.args && node.args.length) {
    for (var i = 0; i < node.args.length; i++) {
      if (containsUnaryPlusOrMinus(node.args[i])) {
        return true
      }
    }
  }
  if (node.content && containsUnaryPlusOrMinus(node.content)) {
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
  if (!ALLOWED_CHARACTERS_REGEX.test(expr)) {
    return false
  }
  var tokens = tokenize(expr)
  if (tokens === null || tokens.length === 0) {
    return false;
  }
  var hasCustom = tokens.some(function (token) { return isCustomToken(token) })
  if (hasCustom) {
    return isValidCustomExpression(tokens)
  }
  try {
    while ("(" === expr[0] && ")" === expr[expr.length - 1]) {
      if (isBracketed(expr)) {
        expr = expr.substring(1, expr.length - 1);
      } else break;
    }
    var res = math.parse(expr);
    if (containsUnaryPlusOrMinus(res) || !isValidParsedNode(res)) {
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
  var customCallStack = []
  var postfixList = []
  var tokens = tokenize(expression)
  if (tokens === null) {
    return null
  }
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]
    if (isVariableToken(token)) {
      postfixList.push(token)
    } else if (isCustomToken(token)) {
      if (tokens[i + 1] === '(') {
        op_stack.push(token)
      } else {
        postfixList.push(createCustomToken(token.name, 0))
      }
    } else if (UNARY_FUNCTIONS.indexOf(token) !== -1) {
      op_stack.push(token)
    } else if ("(" === token) {
      if (isCustomToken(tokens[i - 1])) {
        customCallStack.push({ token: tokens[i - 1], commaCount: 0 })
      }
      op_stack.push(token)
    } else if ("," === token) {
      var commaTop = op_stack.pop()
      while (commaTop !== '(') {
        if (typeof commaTop === 'undefined') {
          return null
        }
        postfixList.push(commaTop)
        commaTop = op_stack.pop()
      }
      op_stack.push('(')
      if (customCallStack.length === 0) {
        return null
      }
      customCallStack[customCallStack.length - 1].commaCount++
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
      if (isFunctionToken(function_token)) {
        var emittedFunction = op_stack.pop()
        if (isCustomToken(emittedFunction)) {
          var customFrame = customCallStack.pop()
          if (!customFrame || customFrame.token !== emittedFunction) {
            return null
          }
          postfixList.push(createCustomToken(emittedFunction.name, customFrame.commaCount + 1))
        } else {
          postfixList.push(emittedFunction)
        }
      }
    } else {
      var peek_elem = op_stack.slice(-1)[0];
      while (
        op_stack.length > 0 &&
        (isFunctionToken(peek_elem) || prec[peek_elem] >= prec[token])
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
    if (isCustomToken(op_stack.slice(-1)[0])) {
      return null
    }
    postfixList.push(op_stack.pop())
  }
  return postfixList
}
