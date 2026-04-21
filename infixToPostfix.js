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
        throw new Error("Expected an identifier after '#'")
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
        throw new Error("Unknown identifier '" + ident + "' (use '#" + ident + "' for a custom function)")
      }
      continue
    }
    throw new Error("Invalid character '" + current + "' in expression")
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
        if (isStopToken(tokens[argsIndex], false)) {
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

function isValidTokens(tokens) {
  var parsed = parseAddSubtract(tokens, 0, false)
  return !!parsed && parsed.nextIndex === tokens.length
}

function describeToken(token) {
  if (typeof token === 'undefined') {
    return 'end of expression'
  }
  if (isCustomToken(token)) {
    return "'#" + token.name + "'"
  }
  return "'" + token + "'"
}

function validateTokens(tokens) {
  var depth = 0
  for (var k = 0; k < tokens.length; k++) {
    if (tokens[k] === '(') {
      depth++
    } else if (tokens[k] === ')') {
      depth--
      if (depth < 0) {
        throw new Error("Mismatched ')' with no matching '('")
      }
    }
  }
  if (depth > 0) {
    throw new Error("Missing closing ')'")
  }
  var parsed = parseAddSubtract(tokens, 0, false)
  if (!parsed) {
    throw new Error('Incomplete or malformed expression')
  }
  if (parsed.nextIndex !== tokens.length) {
    throw new Error('Unexpected token ' + describeToken(tokens[parsed.nextIndex]) + ' at position ' + parsed.nextIndex)
  }
}

function isValidExpression(expr) {
  try {
    if (!ALLOWED_CHARACTERS_REGEX.test(expr)) {
      return false
    }
    var tokens = tokenize(expr)
    if (tokens === null || tokens.length === 0) {
      return false;
    }
    return isValidTokens(tokens)
  } catch (e) {
    return false
  }
}

function infixToPostfix(expression) {
  if (!ALLOWED_CHARACTERS_REGEX.test(expression)) {
    var badMatch = expression.match(/[^A-Za-z0-9_#,+\-*/()\s]/)
    throw new Error("Invalid character '" + (badMatch ? badMatch[0] : '?') + "' in expression")
  }
  var tokens = tokenize(expression)
  if (tokens.length === 0) {
    throw new Error('Empty expression')
  }
  validateTokens(tokens)
  const prec = { "*": 3, "/": 3, "-": 2, "+": 2, "(": 1 }
  var op_stack = []
  var customCallStack = []
  var postfixList = []
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
      if (i > 0 && isCustomToken(tokens[i - 1])) {
        customCallStack.push({ name: tokens[i - 1].name, commaCount: 0 })
      }
      op_stack.push(token)
    } else if ("," === token) {
      var commaTop = op_stack.pop()
      while (commaTop !== '(') {
        if (typeof commaTop === 'undefined') {
          throw new Error("Unexpected ',' outside of a function call")
        }
        postfixList.push(commaTop)
        commaTop = op_stack.pop()
      }
      op_stack.push('(')
      if (customCallStack.length === 0) {
        throw new Error("Unexpected ',' outside of a function call")
      }
      customCallStack[customCallStack.length - 1].commaCount++
    } else if (")" === token) {
      var top_op_token = op_stack.pop()
      while (top_op_token !== '(') {
        if (typeof top_op_token === 'undefined') {
          throw new Error("Mismatched ')' with no matching '('")
        }
        postfixList.push(top_op_token)
        top_op_token = op_stack.pop()
      }
      var function_token = op_stack.slice(-1)[0]
      if (isFunctionToken(function_token)) {
        var emittedFunction = op_stack.pop()
        if (isCustomToken(emittedFunction)) {
          var customFrame = customCallStack.pop()
          if (!customFrame || customFrame.name !== emittedFunction.name) {
            throw new Error("Mismatched custom function call for '#" + emittedFunction.name + "'")
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
    var tail = op_stack.slice(-1)[0]
    if (tail === '(') {
      throw new Error("Missing closing ')'")
    }
    if (isCustomToken(tail)) {
      throw new Error("Missing closing ')' for '#" + tail.name + "'")
    }
    postfixList.push(op_stack.pop())
  }
  return postfixList
}
