// src/html.ts
function* tokenizer(input) {
  const s = new TokenizerContext(input, 0);
  let tagToken = generateEmptyTagToken(false);
  let attribute = ["", ""];
  let doctypeToken = generateDoctypeToken();
  while (!s.eof()) {
    const state = s.state;
    switch (state) {
      case 0 /* data */: {
        for (const char of s) {
          if (char === "<") {
            s.setState(1 /* tagOpen */);
            break;
          } else if (char === "?") {
            s.reconsume();
            s.setState(13 /* bogusComment */);
            break;
          } else {
            yield generateCharacterToken(char);
          }
        }
        break;
      }
      case 1 /* tagOpen */: {
        const char = s.consume();
        if (char === "!") {
          s.setState(14 /* markupDeclarationOpen */);
        } else if (char === "/") {
          s.setState(2 /* endTagOpen */);
        } else if (isCharacterAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(false);
          s.setState(3 /* tagName */);
        } else {
          s.reconsume();
          s.setState(0 /* data */);
        }
        break;
      }
      case 2 /* endTagOpen */: {
        const char = s.consume();
        if (isCharacterAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(true);
          s.setState(3 /* tagName */);
        } else {
          s.reconsume();
          s.setState(13 /* bogusComment */);
        }
        break;
      }
      case 3 /* tagName */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(4 /* beforeAttributeName */);
            break;
          } else if (char === "/") {
            tagToken.selfClosing = true;
            s.setState(12 /* selfClosingStartTag */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            tagToken.name += char.toLowerCase();
          }
        }
        break;
      }
      case 4 /* beforeAttributeName */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else if (char === "/" || char === ">") {
            s.reconsume();
            s.setState(6 /* afterAttributeName */);
            break;
          } else if (char === "=") {
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(5 /* attributeName */);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case 5 /* attributeName */: {
        for (const char of s) {
          if (isCharacterSpace(char) || char === "/" || char === ">") {
            s.reconsume();
            s.setState(6 /* afterAttributeName */);
            break;
          } else if (char === "=") {
            s.setState(7 /* beforeAttributeValue */);
            break;
          } else {
            attribute[0] += char.toLowerCase();
          }
        }
        break;
      }
      case 6 /* afterAttributeName */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else if (char === "/") {
            s.setState(12 /* selfClosingStartTag */);
            break;
          } else if (char === "=") {
            s.setState(7 /* beforeAttributeValue */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(5 /* attributeName */);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case 7 /* beforeAttributeValue */: {
        for (const char2 of s) {
          if (isCharacterSpace(char2)) {
            continue;
          }
          s.reconsume();
          break;
        }
        const char = s.consume();
        if (char === '"') {
          s.setState(8 /* attributeValueDoubleQuoted */);
        } else if (char === "'") {
          s.setState(9 /* attributeValueSingleQuoted */);
        } else if (char === ">") {
          yield tagToken;
          s.setState(0 /* data */);
        } else {
          s.reconsume();
          s.setState(10 /* attributeValueUnquoted */);
        }
        break;
      }
      case 8 /* attributeValueDoubleQuoted */: {
        for (const char of s) {
          if (char === '"') {
            s.setState(11 /* afterAttributeValueQuoted */);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case 9 /* attributeValueSingleQuoted */: {
        for (const char of s) {
          if (char === "'") {
            s.setState(11 /* afterAttributeValueQuoted */);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case 10 /* attributeValueUnquoted */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(4 /* beforeAttributeName */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case 11 /* afterAttributeValueQuoted */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(4 /* beforeAttributeName */);
            break;
          } else if (char === "/") {
            s.setState(12 /* selfClosingStartTag */);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(0 /* data */);
            break;
          } else {
            s.reconsume();
            s.setState(4 /* beforeAttributeName */);
            break;
          }
        }
        break;
      }
      case 12 /* selfClosingStartTag */: {
        const char = s.consume();
        if (char === ">") {
          tagToken.selfClosing = true;
          s.setState(0 /* data */);
        } else {
          s.reconsume();
          s.setState(17 /* beforeDoctypeName */);
        }
        break;
      }
      case 13 /* bogusComment */: {
        for (const char of s) {
          if (char === ">") {
            s.setState(0 /* data */);
            break;
          }
        }
        break;
      }
      case 14 /* markupDeclarationOpen */: {
        const doctype = "doctype";
        if (s.peek(doctype.length).toLowerCase() === doctype) {
          s.skip(doctype.length);
          s.setState(16 /* doctype */);
        } else if (s.peek(2) === "--") {
          s.skip(2);
          s.setState(15 /* comment */);
        }
        break;
      }
      case 15 /* comment */: {
        for (const char of s) {
          if (char === "-" && s.peek(2) === "->") {
            s.skip(2);
            s.setState(0 /* data */);
            break;
          }
        }
        break;
      }
      case 16 /* doctype */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(17 /* beforeDoctypeName */);
            break;
          } else {
            s.reconsume();
            s.setState(17 /* beforeDoctypeName */);
            break;
          }
        }
        break;
      }
      case 17 /* beforeDoctypeName */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else {
            s.reconsume();
            doctypeToken = generateDoctypeToken();
            s.setState(18 /* doctypeName */);
            break;
          }
        }
        break;
      }
      case 18 /* doctypeName */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(19 /* afterDoctypeName */);
            break;
          } else if (char === ">") {
            yield doctypeToken;
            s.setState(0 /* data */);
            break;
          } else {
            doctypeToken.doctype += char.toLowerCase();
          }
        }
        break;
      }
      case 19 /* afterDoctypeName */: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else if (char === ">") {
            s.setState(0 /* data */);
            yield doctypeToken;
            break;
          }
        }
        break;
      }
      default: {
        const _v = state;
      }
    }
  }
}
var isCharacterSpace = (string) => {
  return string === " " || string == "\n" || string === "\t";
};
var isCharacterAlpha = (string) => {
  const charCode = string.charCodeAt(0);
  const a = "a".charCodeAt(0);
  const z = "z".charCodeAt(0);
  const A = "A".charCodeAt(0);
  const Z = "Z".charCodeAt(0);
  return charCode >= a && charCode <= z || charCode >= A && charCode <= Z;
};
class TokenizerContext {
  input;
  index;
  state = 0 /* data */;
  returnState = [];
  constructor(input, index) {
    this.input = input;
    this.index = index;
  }
  getCurrentInput() {
    return this.input[this.index];
  }
  peek(length) {
    return this.input.slice(this.index, this.index + length);
  }
  skip(length) {
    this.index += length;
  }
  consume() {
    const char = this.input[this.index];
    this.index += 1;
    return char;
  }
  eof() {
    return this.index >= this.input.length;
  }
  reconsume() {
    this.index -= 1;
  }
  setState(state, returnState) {
    if (returnState != null) {
      this.returnState.push(returnState);
    }
    this.state = state;
  }
  popReturnState() {
    this.state = this.returnState.pop();
  }
  *[Symbol.iterator]() {
    while (!this.eof()) {
      yield this.consume();
    }
  }
}
var generateCharacterToken = (character) => {
  return {
    type: 0 /* character */,
    character
  };
};
var generateEmptyTagToken = (closing) => {
  return {
    type: 1 /* tag */,
    name: "",
    closing,
    attributes: [],
    selfClosing: false
  };
};
var generateDoctypeToken = () => {
  return {
    type: 2 /* doctype */,
    doctype: ""
  };
};
window.tokenizer = tokenizer;

class TextNode {
  text;
  constructor(text) {
    this.text = text;
  }
  debug() {
    return this.text;
  }
}

class Node {
  tag;
  attributes;
  parent;
  childNodes = [];
  constructor(tag, attributes = {}, parent) {
    this.tag = tag;
    this.attributes = attributes;
    this.parent = parent;
  }
  debug() {
    const { parent, childNodes, ...rest } = this;
    return {
      ...rest,
      childNodes: childNodes.map((child) => child.debug())
    };
  }
}
var parse = (input) => {
  const root = new Node("", {}, undefined);
  let node = root;
  const tokens = [...tokenizer(input)];
  for (let i = 0;i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 2 /* doctype */: {
        break;
      }
      case 1 /* tag */: {
        if (token.closing) {
          if (token.name === node.tag) {
            console.assert(node.parent, "closed 1 too many nodes lol");
            node = node.parent;
          } else {
            console.error("attempted to close ", token.name, " with a ", node.tag);
          }
        } else {
          const voidTags = [
            "area",
            "base",
            "br",
            "col",
            "embed",
            "hr",
            "img",
            "input",
            "link",
            "meta",
            "param",
            "source",
            "track",
            "wbr"
          ];
          const newNode = new Node(token.name, Object.fromEntries(token.attributes), node);
          node.childNodes.push(newNode);
          if (voidTags.includes(token.name)) {
          } else {
            node = newNode;
          }
        }
        break;
      }
      case 0 /* character */: {
        const textnode = new TextNode("");
        while (i < tokens.length && tokens[i].type === 0 /* character */) {
          textnode.text += tokens[i].character;
          i += 1;
        }
        node.childNodes.push(textnode);
        i -= 1;
      }
    }
  }
  return root.childNodes.find((node2) => node2 instanceof Node && node2.tag === "html");
};
window.parse = parse;

// src/index.ts
function main() {
  document.getElementById("inputhtml").textContent = defaultHtml;
  console.log(parse(defaultHtml).debug());
}
var defaultHtml = `<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" type="text/css" href="styles.css">
</head>
<body>
    <!-- test  -->
    <? test >
    <h1 id="main-heading">Welcome to My Website</h1>
    <p class="paragraph">This is a paragraph.</p>
    <style>
      body {
          background-color: #f0f0f0;
      }

      #main-heading {
          color: #333;
          text-align: center;
      }

      .paragraph {
          font-size: 20px;
          font-family: Arial, sans-serif;
          margin: 0 auto;
          width: 50%;
      }
    </style>
</body>
</html>


`;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

//# debugId=79D5D9C4C2ECB2D064756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2luZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImNvbnN0IGlzQ2hhcmFjdGVyU3BhY2UgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgcmV0dXJuIHN0cmluZyA9PT0gXCIgXCIgfHwgc3RyaW5nID09IFwiXFxuXCIgfHwgc3RyaW5nID09PSBcIlxcdFwiO1xufTtcblxuY29uc3QgaXNDaGFyYWN0ZXJBbHBoYSA9IChzdHJpbmc6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaGFyQ29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBhID0gXCJhXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgeiA9IFwielwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IEEgPSBcIkFcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBaID0gXCJaXCIuY2hhckNvZGVBdCgwKTtcblxuICByZXR1cm4gKGNoYXJDb2RlID49IGEgJiYgY2hhckNvZGUgPD0geikgfHwgKGNoYXJDb2RlID49IEEgJiYgY2hhckNvZGUgPD0gWik7XG59O1xuXG5lbnVtIFRva2VuRW51bSB7XG4gIGNoYXJhY3RlcixcbiAgdGFnLFxuICBkb2N0eXBlLFxufVxuXG5lbnVtIFN0YXRlIHtcbiAgZGF0YSxcbiAgdGFnT3BlbixcbiAgZW5kVGFnT3BlbixcbiAgdGFnTmFtZSxcbiAgYmVmb3JlQXR0cmlidXRlTmFtZSxcbiAgYXR0cmlidXRlTmFtZSxcbiAgYWZ0ZXJBdHRyaWJ1dGVOYW1lLFxuICBiZWZvcmVBdHRyaWJ1dGVWYWx1ZSxcbiAgYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQsXG4gIGF0dHJpYnV0ZVZhbHVlU2luZ2xlUXVvdGVkLFxuICBhdHRyaWJ1dGVWYWx1ZVVucXVvdGVkLFxuICBhZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkLFxuICBzZWxmQ2xvc2luZ1N0YXJ0VGFnLFxuICBib2d1c0NvbW1lbnQsXG4gIG1hcmt1cERlY2xhcmF0aW9uT3BlbixcbiAgY29tbWVudCxcbiAgZG9jdHlwZSxcbiAgYmVmb3JlRG9jdHlwZU5hbWUsXG4gIGRvY3R5cGVOYW1lLFxuICBhZnRlckRvY3R5cGVOYW1lLFxufVxuXG5pbnRlcmZhY2UgQ2hhcmFjdGVyVG9rZW4ge1xuICB0eXBlOiBUb2tlbkVudW0uY2hhcmFjdGVyO1xuICBjaGFyYWN0ZXI6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIENvbW1lbnRUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS5jb21tZW50O1xuICBjb21tZW50OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBUYWdUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS50YWc7XG4gIG5hbWU6IHN0cmluZztcbiAgY2xvc2luZzogYm9vbGVhbjtcbiAgYXR0cmlidXRlczogW3N0cmluZywgc3RyaW5nXVtdO1xuICBzZWxmQ2xvc2luZzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIERvY3R5cGVUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS5kb2N0eXBlO1xuICBkb2N0eXBlOiBzdHJpbmc7XG59XG5cbmNsYXNzIFRva2VuaXplckNvbnRleHQge1xuICBzdGF0ZTogU3RhdGUgPSBTdGF0ZS5kYXRhO1xuXG4gIHJldHVyblN0YXRlOiBTdGF0ZVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIGlucHV0OiBzdHJpbmcsXG4gICAgcHVibGljIGluZGV4OiBudW1iZXIsXG4gICkge31cblxuICBnZXRDdXJyZW50SW5wdXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXRbdGhpcy5pbmRleF07XG4gIH1cblxuICBwZWVrKGxlbmd0aDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXQuc2xpY2UodGhpcy5pbmRleCwgdGhpcy5pbmRleCArIGxlbmd0aCk7XG4gIH1cblxuICBza2lwKGxlbmd0aDogbnVtYmVyKSB7XG4gICAgdGhpcy5pbmRleCArPSBsZW5ndGg7XG4gIH1cblxuICBjb25zdW1lKCkge1xuICAgIGNvbnN0IGNoYXIgPSB0aGlzLmlucHV0W3RoaXMuaW5kZXhdO1xuICAgIHRoaXMuaW5kZXggKz0gMTtcbiAgICByZXR1cm4gY2hhcjtcbiAgfVxuXG4gIGVvZigpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRleCA+PSB0aGlzLmlucHV0Lmxlbmd0aDtcbiAgfVxuXG4gIHJlY29uc3VtZSgpIHtcbiAgICB0aGlzLmluZGV4IC09IDE7XG4gIH1cblxuICBzZXRTdGF0ZShzdGF0ZTogU3RhdGUsIHJldHVyblN0YXRlPzogU3RhdGUpIHtcbiAgICBpZiAocmV0dXJuU3RhdGUgIT0gbnVsbCkge1xuICAgICAgdGhpcy5yZXR1cm5TdGF0ZS5wdXNoKHJldHVyblN0YXRlKTtcbiAgICB9XG4gICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICB9XG5cbiAgcG9wUmV0dXJuU3RhdGUoKSB7XG4gICAgdGhpcy5zdGF0ZSA9IHRoaXMucmV0dXJuU3RhdGUucG9wKCkhO1xuICB9XG5cbiAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgIHdoaWxlICghdGhpcy5lb2YoKSkge1xuICAgICAgeWllbGQgdGhpcy5jb25zdW1lKCk7XG4gICAgfVxuICB9XG59XG5cbi8vIGdlbmVyYXRpbmdcblxuY29uc3QgZ2VuZXJhdGVDaGFyYWN0ZXJUb2tlbiA9IChjaGFyYWN0ZXI6IHN0cmluZyk6IENoYXJhY3RlclRva2VuID0+IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBUb2tlbkVudW0uY2hhcmFjdGVyLFxuICAgIGNoYXJhY3RlcixcbiAgfTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlRW1wdHlUYWdUb2tlbiA9IChjbG9zaW5nOiBib29sZWFuKTogVGFnVG9rZW4gPT4ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFRva2VuRW51bS50YWcsXG4gICAgbmFtZTogXCJcIixcbiAgICBjbG9zaW5nLFxuICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgIHNlbGZDbG9zaW5nOiBmYWxzZSxcbiAgfTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlRG9jdHlwZVRva2VuID0gKCk6IERvY3R5cGVUb2tlbiA9PiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogVG9rZW5FbnVtLmRvY3R5cGUsXG4gICAgZG9jdHlwZTogXCJcIixcbiAgfTtcbn07XG5cbi8vIHRva2VuaXplcmluZ1xuXG5mdW5jdGlvbiogdG9rZW5pemVyKGlucHV0OiBzdHJpbmcpIHtcbiAgY29uc3QgcyA9IG5ldyBUb2tlbml6ZXJDb250ZXh0KGlucHV0LCAwKTtcblxuICBsZXQgdGFnVG9rZW46IFRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKGZhbHNlKTtcbiAgbGV0IGF0dHJpYnV0ZTogW3N0cmluZywgc3RyaW5nXSA9IFtcIlwiLCBcIlwiXTtcbiAgbGV0IGRvY3R5cGVUb2tlbjogRG9jdHlwZVRva2VuID0gZ2VuZXJhdGVEb2N0eXBlVG9rZW4oKTtcblxuICB3aGlsZSAoIXMuZW9mKCkpIHtcbiAgICBjb25zdCBzdGF0ZSA9IHMuc3RhdGU7XG4gICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5kYXRhOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiPFwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnRhZ09wZW4pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj9cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYm9ndXNDb21tZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB5aWVsZCBnZW5lcmF0ZUNoYXJhY3RlclRva2VuKGNoYXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUudGFnT3Blbjoge1xuICAgICAgICBjb25zdCBjaGFyID0gcy5jb25zdW1lKCk7XG4gICAgICAgIGlmIChjaGFyID09PSBcIiFcIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUubWFya3VwRGVjbGFyYXRpb25PcGVuKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZW5kVGFnT3Blbik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNDaGFyYWN0ZXJBbHBoYShjaGFyKSkge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgdGFnVG9rZW4gPSBnZW5lcmF0ZUVtcHR5VGFnVG9rZW4oZmFsc2UpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUudGFnTmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5lbmRUYWdPcGVuOiB7XG4gICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGVycm9yIGhhbmRsaW5nIHRiaC4uLlxuICAgICAgICBjb25zdCBjaGFyID0gcy5jb25zdW1lKCk7XG4gICAgICAgIGlmIChpc0NoYXJhY3RlckFscGhhKGNoYXIpKSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICB0YWdUb2tlbiA9IGdlbmVyYXRlRW1wdHlUYWdUb2tlbih0cnVlKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnRhZ05hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5ib2d1c0NvbW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS50YWdOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICB0YWdUb2tlbi5zZWxmQ2xvc2luZyA9IHRydWU7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhZ1Rva2VuLm5hbWUgKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJhY3RlclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiIHx8IGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj1cIikge1xuICAgICAgICAgICAgLy8gVE9ET1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGUgPSBbXCJcIiwgXCJcIl07XG4gICAgICAgICAgICB0YWdUb2tlbi5hdHRyaWJ1dGVzLnB1c2goYXR0cmlidXRlKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hdHRyaWJ1dGVOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikgfHwgY2hhciA9PT0gXCIvXCIgfHwgY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMF0gKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuc2VsZkNsb3NpbmdTdGFydFRhZyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGUgPSBbXCJcIiwgXCJcIl07XG4gICAgICAgICAgICB0YWdUb2tlbi5hdHRyaWJ1dGVzLnB1c2goYXR0cmlidXRlKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVWYWx1ZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJhY3RlclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGFyID0gcy5jb25zdW1lKCk7XG4gICAgICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCInXCIpIHtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZVZhbHVlU2luZ2xlUXVvdGVkKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlZDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZVsxXSArPSBjaGFyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gXCInXCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVWYWx1ZVF1b3RlZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlWzFdICs9IGNoYXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVVucXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlWzFdICs9IGNoYXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5zZWxmQ2xvc2luZ1N0YXJ0VGFnOiB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgdGFnVG9rZW4uc2VsZkNsb3NpbmcgPSB0cnVlO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYm9ndXNDb21tZW50OiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5tYXJrdXBEZWNsYXJhdGlvbk9wZW46IHtcbiAgICAgICAgY29uc3QgZG9jdHlwZSA9IFwiZG9jdHlwZVwiO1xuICAgICAgICBpZiAocy5wZWVrKGRvY3R5cGUubGVuZ3RoKS50b0xvd2VyQ2FzZSgpID09PSBkb2N0eXBlKSB7XG4gICAgICAgICAgcy5za2lwKGRvY3R5cGUubGVuZ3RoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRvY3R5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHMucGVlaygyKSA9PT0gXCItLVwiKSB7XG4gICAgICAgICAgcy5za2lwKDIpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuY29tbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmNvbW1lbnQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gXCItXCIgJiYgcy5wZWVrKDIpID09PSBcIi0+XCIgKSB7XG4gICAgICAgICAgICBzLnNraXAoMik7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5kb2N0eXBlOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBkb2N0eXBlVG9rZW4gPSBnZW5lcmF0ZURvY3R5cGVUb2tlbigpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kb2N0eXBlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmRvY3R5cGVOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJEb2N0eXBlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCBkb2N0eXBlVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3R5cGVUb2tlbi5kb2N0eXBlICs9IGNoYXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmFmdGVyRG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIHlpZWxkIGRvY3R5cGVUb2tlbjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgY29uc3QgX3Y6IG5ldmVyID0gc3RhdGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbndpbmRvdy50b2tlbml6ZXIgPSB0b2tlbml6ZXI7XG5cbmNsYXNzIFRleHROb2RlIHtcbiAgY29uc3RydWN0b3IocHVibGljIHRleHQ6IHN0cmluZykge31cblxuICBkZWJ1ZygpIHtcbiAgICByZXR1cm4gdGhpcy50ZXh0O1xuICB9XG59XG5cbmludGVyZmFjZSBJTm9kZSB7XG4gIHRhZzogc3RyaW5nO1xuICBhdHRyaWJ1dGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBjaGlsZE5vZGVzOiAoVGV4dE5vZGUgfCBJTm9kZSlbXVxufVxuXG5jbGFzcyBOb2RlIGltcGxlbWVudHMgSU5vZGUge1xuICBjaGlsZE5vZGVzOiAoTm9kZSB8IFRleHROb2RlKVtdID0gW107XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgdGFnOiBzdHJpbmcsXG4gICAgcHVibGljIGF0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSxcbiAgICBwdWJsaWMgcGFyZW50OiBOb2RlIHwgdW5kZWZpbmVkLFxuICApIHt9XG5cbiAgZGVidWcoKTogRGVidWdOb2RlIHtcbiAgICBjb25zdCB7IHBhcmVudCwgY2hpbGROb2RlcywgLi4ucmVzdCB9ID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgLi4ucmVzdCxcbiAgICAgIGNoaWxkTm9kZXM6IGNoaWxkTm9kZXMubWFwKGNoaWxkID0+IGNoaWxkLmRlYnVnKCkpLFxuICAgIH1cbiAgfVxufVxuXG50eXBlIFJlbW92ZU1ldGhvZHM8VD4gPSB7XG4gIFtQIGluIGtleW9mIFQgYXMgVFtQXSBleHRlbmRzIEZ1bmN0aW9uID8gbmV2ZXIgOiBQXTogVFtQXTtcbn07XG5cbnR5cGUgRGVidWdOb2RlID0gUmVtb3ZlTWV0aG9kczxPbWl0PE5vZGUsIFwicGFyZW50XCIgfCBcImNoaWxkTm9kZXNcIj4+ICYge1xuICBjaGlsZE5vZGVzOiAoc3RyaW5nIHwgRGVidWdOb2RlKVtdXG59O1xuXG5leHBvcnQgY29uc3QgcGFyc2UgPSAoaW5wdXQ6IHN0cmluZykgPT4ge1xuICBjb25zdCByb290ID0gbmV3IE5vZGUoXCJcIiwge30sIHVuZGVmaW5lZCk7XG4gIGxldCBub2RlID0gcm9vdDtcbiAgY29uc3QgdG9rZW5zID0gWy4uLnRva2VuaXplcihpbnB1dCldO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2ldO1xuICAgIHN3aXRjaCAodG9rZW4udHlwZSkge1xuICAgICAgY2FzZSBUb2tlbkVudW0uZG9jdHlwZToge1xuICAgICAgICAvLyBsb2wgZG9uJ3QgY2FyZSByZW5kZXJpbmcgYXQgaHRtbDUgbm8gbWF0dGVyIHdoYXRcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFRva2VuRW51bS50YWc6IHtcbiAgICAgICAgaWYgKHRva2VuLmNsb3NpbmcpIHtcbiAgICAgICAgICBpZiAodG9rZW4ubmFtZSA9PT0gbm9kZS50YWcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuYXNzZXJ0KG5vZGUucGFyZW50LCBcImNsb3NlZCAxIHRvbyBtYW55IG5vZGVzIGxvbFwiKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudCE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwiYXR0ZW1wdGVkIHRvIGNsb3NlIFwiLFxuICAgICAgICAgICAgICB0b2tlbi5uYW1lLFxuICAgICAgICAgICAgICBcIiB3aXRoIGEgXCIsXG4gICAgICAgICAgICAgIG5vZGUudGFnLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3Qgdm9pZFRhZ3MgPSBbXG4gICAgICAgICAgICBcImFyZWFcIixcbiAgICAgICAgICAgIFwiYmFzZVwiLFxuICAgICAgICAgICAgXCJiclwiLFxuICAgICAgICAgICAgXCJjb2xcIixcbiAgICAgICAgICAgIFwiZW1iZWRcIixcbiAgICAgICAgICAgIFwiaHJcIixcbiAgICAgICAgICAgIFwiaW1nXCIsXG4gICAgICAgICAgICBcImlucHV0XCIsXG4gICAgICAgICAgICBcImxpbmtcIixcbiAgICAgICAgICAgIFwibWV0YVwiLFxuICAgICAgICAgICAgXCJwYXJhbVwiLFxuICAgICAgICAgICAgXCJzb3VyY2VcIixcbiAgICAgICAgICAgIFwidHJhY2tcIixcbiAgICAgICAgICAgIFwid2JyXCIsXG4gICAgICAgICAgXTtcbiAgICAgICAgICBjb25zdCBuZXdOb2RlID0gbmV3IE5vZGUoXG4gICAgICAgICAgICB0b2tlbi5uYW1lLFxuICAgICAgICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKHRva2VuLmF0dHJpYnV0ZXMpLFxuICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICApO1xuICAgICAgICAgIG5vZGUuY2hpbGROb2Rlcy5wdXNoKG5ld05vZGUpO1xuICAgICAgICAgIGlmICh2b2lkVGFncy5pbmNsdWRlcyh0b2tlbi5uYW1lKSkge1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub2RlID0gbmV3Tm9kZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFRva2VuRW51bS5jaGFyYWN0ZXI6IHtcbiAgICAgICAgY29uc3QgdGV4dG5vZGUgPSBuZXcgVGV4dE5vZGUoXCJcIik7XG4gICAgICAgIHdoaWxlIChpIDwgdG9rZW5zLmxlbmd0aCAmJiB0b2tlbnNbaV0udHlwZSA9PT0gVG9rZW5FbnVtLmNoYXJhY3Rlcikge1xuICAgICAgICAgIHRleHRub2RlLnRleHQgKz0gKHRva2Vuc1tpXSBhcyBDaGFyYWN0ZXJUb2tlbikuY2hhcmFjdGVyO1xuICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgfVxuICAgICAgICBub2RlLmNoaWxkTm9kZXMucHVzaCh0ZXh0bm9kZSk7XG4gICAgICAgIGkgLT0gMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJvb3QuY2hpbGROb2Rlcy5maW5kKG5vZGUgPT4gbm9kZSBpbnN0YW5jZW9mIE5vZGUgJiYgbm9kZS50YWcgPT09ICdodG1sJyk7XG59O1xud2luZG93LnBhcnNlID0gcGFyc2U7XG4iLAogICAgImltcG9ydCB7IHBhcnNlIH0gZnJvbSBcIi4vaHRtbFwiXG5cbmNvbnN0IGRlZmF1bHRIdG1sID0gYDwhRE9DVFlQRSBodG1sPlxuPGh0bWw+XG48aGVhZD5cbiAgICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgaHJlZj1cInN0eWxlcy5jc3NcIj5cbjwvaGVhZD5cbjxib2R5PlxuICAgIDwhLS0gdGVzdCAgLS0+XG4gICAgPD8gdGVzdCA+XG4gICAgPGgxIGlkPVwibWFpbi1oZWFkaW5nXCI+V2VsY29tZSB0byBNeSBXZWJzaXRlPC9oMT5cbiAgICA8cCBjbGFzcz1cInBhcmFncmFwaFwiPlRoaXMgaXMgYSBwYXJhZ3JhcGguPC9wPlxuICAgIDxzdHlsZT5cbiAgICAgIGJvZHkge1xuICAgICAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmMGYwZjA7XG4gICAgICB9XG5cbiAgICAgICNtYWluLWhlYWRpbmcge1xuICAgICAgICAgIGNvbG9yOiAjMzMzO1xuICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgIH1cblxuICAgICAgLnBhcmFncmFwaCB7XG4gICAgICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgICAgIGZvbnQtZmFtaWx5OiBBcmlhbCwgc2Fucy1zZXJpZjtcbiAgICAgICAgICBtYXJnaW46IDAgYXV0bztcbiAgICAgICAgICB3aWR0aDogNTAlO1xuICAgICAgfVxuICAgIDwvc3R5bGU+XG48L2JvZHk+XG48L2h0bWw+XG5cblxuYDtcblxuZnVuY3Rpb24gbWFpbigpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0aHRtbCcpIS50ZXh0Q29udGVudCA9IGRlZmF1bHRIdG1sXG5cbiAgY29uc29sZS5sb2cocGFyc2UoZGVmYXVsdEh0bWwpLmRlYnVnKCkpO1xufVxuXG5pZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgbWFpbik7XG59IGVsc2Uge1xuICBtYWluKCk7XG59XG5cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFvSkEsVUFBVSxTQUFTLENBQUMsT0FBZTtBQUNqQyxRQUFNLElBQUksSUFBSSxpQkFBaUIsT0FBTyxDQUFDO0FBRXZDLE1BQUksV0FBcUIsc0JBQXNCLEtBQUs7QUFDcEQsTUFBSSxZQUE4QixDQUFDLElBQUksRUFBRTtBQUN6QyxNQUFJLGVBQTZCLHFCQUFxQjtBQUV0RCxVQUFRLEVBQUUsSUFBSSxHQUFHO0FBQ2YsVUFBTSxRQUFRLEVBQUU7QUFDaEIsWUFBUTtBQUFBLFdBQ0QsY0FBWTtBQUNmLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFNBQVMsS0FBSztBQUNoQixjQUFFLFNBQVMsZUFBYTtBQUN4QjtBQUFBLFVBQ0YsV0FBVyxTQUFTLEtBQUs7QUFDdkIsY0FBRSxVQUFVO0FBQ1osY0FBRSxTQUFTLHFCQUFrQjtBQUM3QjtBQUFBLFVBQ0YsT0FBTztBQUNMLGtCQUFNLHVCQUF1QixJQUFJO0FBQUE7QUFBQSxRQUVyQztBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssaUJBQWU7QUFDbEIsY0FBTSxPQUFPLEVBQUUsUUFBUTtBQUN2QixZQUFJLFNBQVMsS0FBSztBQUNoQixZQUFFLFNBQVMsOEJBQTJCO0FBQUEsUUFDeEMsV0FBVyxTQUFTLEtBQUs7QUFDdkIsWUFBRSxTQUFTLGtCQUFnQjtBQUFBLFFBQzdCLFdBQVcsaUJBQWlCLElBQUksR0FBRztBQUNqQyxZQUFFLFVBQVU7QUFDWixx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QVM7QUFDakIsY0FBSSxNQUFNLFNBQVMsS0FBSyxLQUFLO0FBQzNCLG9CQUFRLE9BQU8sS0FBSyxRQUFRLDZCQUE2QjtBQUN6RCxtQkFBTyxLQUFLO0FBQUEsVUFDZCxPQUFPO0FBQ0wsb0JBQVEsTUFDTix1QkFDQSxNQUFNLE1BQ04sWUFDQSxLQUFLLEdBQ1A7QUFBQTtBQUFBLFFBRUosT0FBTztBQUNMLGdCQUFNLFdBQVc7QUFBQSxZQUNmO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0Y7QUFDQSxnQkFBTSxVQUFVLElBQUksS0FDbEIsTUFBTSxNQUNOLE9BQU8sWUFBWSxNQUFNLFVBQVUsR0FDbkMsSUFDRjtBQUNBLGVBQUssV0FBVyxLQUFLLE9BQU87QUFDNUIsY0FBSSxTQUFTLFNBQVMsTUFBTSxJQUFJLEdBQUc7QUFBQSxVQUNuQyxPQUFPO0FBQ0wsbUJBQU87QUFBQTtBQUFBO0FBR1g7QUFBQSxNQUNGO0FBQUEsV0FDSyxtQkFBcUI7QUFDeEIsY0FBTSxXQUFXLElBQUksU0FBUyxFQUFFO0FBQ2hDLGVBQU8sSUFBSSxPQUFPLFVBQVUsT0FBTyxHQUFHLFNBQVMsbUJBQXFCO0FBQ2xFLG1CQUFTLFFBQVMsT0FBTyxHQUFzQjtBQUMvQyxlQUFLO0FBQUEsUUFDUDtBQUNBLGFBQUssV0FBVyxLQUFLLFFBQVE7QUFDN0IsYUFBSztBQUFBLE1BQ1A7QUFBQTtBQUFBLEVBRUo7QUFDQSxTQUFPLEtBQUssV0FBVyxLQUFLLFdBQVEsaUJBQWdCLFFBQVEsTUFBSyxRQUFRLE1BQU07QUFBQTtBQUVqRixPQUFPLFFBQVE7OztBQ3JoQmYsU0FBUyxJQUFJLEdBQUc7QUFDZCxXQUFTLGVBQWUsV0FBVyxFQUFHLGNBQWM7QUFFcEQsVUFBUSxJQUFJLE1BQU0sV0FBVyxFQUFFLE1BQU0sQ0FBQztBQUFBO0FBcEN4QyxJQUFNLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQXVDcEIsSUFBSSxTQUFTLGVBQWUsV0FBVztBQUNyQyxXQUFTLGlCQUFpQixvQkFBb0IsSUFBSTtBQUNwRCxPQUFPO0FBQ0wsT0FBSztBQUFBOyIsCiAgImRlYnVnSWQiOiAiNzlENUQ5QzRDMkVDQjJEMDY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
