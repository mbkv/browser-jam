// src/tokenizer.ts
var isCharSpace = (string) => {
  return string === " " || string == "\n" || string === "\t" || string === "\f";
};
var isCharAlpha = (string) => {
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
  state;
  returnState = [];
  constructor(input, index, state) {
    this.input = input;
    this.index = index;
    this.state = state;
  }
  getRest() {
    return this.input.slice(this.index);
  }
  peek(length) {
    return this.input.slice(this.index, this.index + length);
  }
  startsWith(string) {
    return this.peek(string.length) === string;
  }
  skip(length = 1) {
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
  clone() {
    const clone = new TokenizerContext(this.input, this.index, this.state);
    clone.returnState = this.returnState;
    return clone;
  }
  set(ctx) {
    this.returnState = ctx.returnState;
    this.input = ctx.input;
    this.index = ctx.index;
    this.state = ctx.state;
  }
}

// src/parser.ts
function* tokenizer2(input) {
  const s = new TokenizerContext(input, 0, 0 /* data */);
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
        } else if (isCharAlpha(char)) {
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
        if (isCharAlpha(char)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char) || char === "/" || char === ">") {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char2)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char)) {
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
          if (isCharSpace(char)) {
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
window.tokenizer = tokenizer2;

class TextNode {
  text;
  constructor(text) {
    this.text = text;
  }
  get textContext() {
    return this.text.replace(/\s+/g, " ");
  }
  debug() {
    return this.text;
  }
  html(indent = 0) {
    return " ".repeat(indent) + this.textContext;
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
  *getElementsByTagname(tagname) {
    for (let i = 0;i < this.childNodes.length; i++) {
      const node = this.childNodes[i];
      if (node instanceof Node) {
        if (node.tag === tagname) {
          yield node;
        }
        for (const subnode of node.getElementsByTagname(tagname)) {
          yield subnode;
        }
      }
    }
  }
  debug() {
    const { parent, childNodes, ...rest } = this;
    return {
      ...rest,
      childNodes: childNodes.map((child) => child.debug())
    };
  }
  html(indent = 0) {
    const nextLevelIndent = this.tag === "" ? indent : indent + 2;
    const children = this.childNodes.map((node) => node.html(nextLevelIndent)).join("\n");
    if (this.tag === "") {
      return children;
    }
    let attributes = "";
    for (const [key, value] of Object.entries(this.attributes)) {
      attributes += " ";
      attributes += `${key}="${value}"`;
    }
    const indentation = " ".repeat(indent);
    return `${indentation}<${this.tag}${attributes}>\n${children}\n${indentation}</${this.tag}>`;
  }
}
var voidTags = [
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
var impliedEndTags = [
  "dd",
  "dt",
  "li",
  "optgroup",
  "option",
  "p",
  "rb",
  "rp",
  "rt",
  "rtc"
];
var generateImpliedEndTags = [
  ...impliedEndTags,
  "dl"
];
var parse = (input) => {
  const root = new Node("", {}, undefined);
  let node = root;
  const tokens = [...tokenizer2(input)];
  for (let i = 0;i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 2 /* doctype */: {
        break;
      }
      case 1 /* tag */: {
        if (token.closing) {
          let current = node;
          while (current) {
            if (token.name === current.tag) {
              console.assert(current.parent, "closed 1 too many nodes lol");
              node = current.parent;
              break;
            }
            current = current.parent;
          }
          if (current == null) {
            console.error(`can't close ${token.name}`);
          }
        } else {
          if (generateImpliedEndTags.includes(token.name)) {
            let current = node;
            while (current) {
              if (impliedEndTags.includes(current.tag)) {
                node = current.parent;
                break;
              }
              current = current.parent;
            }
          }
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
  return root;
};
window.parse = parse;

// src/renderer.ts
var render = (canvas, body) => {
  const ctx = canvas.getContext("2d");
  let marginLeft = [8];
  let marginTop = 8;
};

// src/index.ts
async function fetchPage(url) {
  const proxied = `${PROXY_HOST}/${url}`;
  const resp = await fetch(proxied);
  const text = await resp.text();
  return text;
}
async function main() {
  const canvas = document.getElementById("canvas");
  const htmlDisplay = document.getElementById("inputhtml");
  const addressBar = document.getElementById("address-bar");
  let text;
  let html;
  async function run() {
    text = await fetchPage(addressBar.value);
    html = parse(text);
    htmlDisplay.textContent = html.html();
    const [body] = html.getElementsByTagname("body");
    render(canvas, body);
  }
  addressBar.addEventListener("change", run);
  run();
}
var PROXY_HOST = "http://localhost:8090";
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

//# debugId=9C490C58627FB98364756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3Rva2VuaXplci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9yZW5kZXJlci50cyIsICIuLi9zcmMvaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IGNvbnN0IGlzQ2hhclNwYWNlID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBzdHJpbmcgPT09IFwiIFwiIHx8IHN0cmluZyA9PSBcIlxcblwiIHx8IHN0cmluZyA9PT0gXCJcXHRcIiB8fCBzdHJpbmcgPT09IFwiXFxmXCI7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyRGlnaXQgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2hhckNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgemVybyA9IFwiMFwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IG5pbmUgPSBcIjlcIi5jaGFyQ29kZUF0KDApO1xuXG4gICAgcmV0dXJuIChjaGFyQ29kZSA+PSB6ZXJvICYmIGNoYXJDb2RlIDw9IG5pbmUpXG59XG5cbmV4cG9ydCBjb25zdCBpc0NoYXJBbHBoYSA9IChzdHJpbmc6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaGFyQ29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBhID0gXCJhXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgeiA9IFwielwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IEEgPSBcIkFcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBaID0gXCJaXCIuY2hhckNvZGVBdCgwKTtcblxuICByZXR1cm4gKGNoYXJDb2RlID49IGEgJiYgY2hhckNvZGUgPD0geikgfHwgKGNoYXJDb2RlID49IEEgJiYgY2hhckNvZGUgPD0gWik7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFySGV4ID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNoYXJDb2RlID0gc3RyaW5nLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IGEgPSBcImFcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBmID0gXCJmXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgQSA9IFwiQVwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IEYgPSBcIkZcIi5jaGFyQ29kZUF0KDApO1xuXG4gIHJldHVybiAoXG4gICAgaXNDaGFyRGlnaXQoc3RyaW5nKSB8fFxuICAgIChjaGFyQ29kZSA+PSBhICYmIGNoYXJDb2RlIDw9IGYpIHx8XG4gICAgKGNoYXJDb2RlID49IEEgJiYgY2hhckNvZGUgPD0gRilcbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBpc0NoYXJCYXNlNjQgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgcmV0dXJuIChcbiAgICBpc0NoYXJBbHBoYShzdHJpbmcpIHx8IGlzQ2hhckRpZ2l0KHN0cmluZykgfHwgc3RyaW5nWzBdID09PSAnXycgfHwgc3RyaW5nWzBdID09PSAnLSdcbiAgKVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5pemVyQ29udGV4dDxTdGF0ZT4ge1xuICByZXR1cm5TdGF0ZTogU3RhdGVbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBpbnB1dDogc3RyaW5nLFxuICAgIHB1YmxpYyBpbmRleDogbnVtYmVyLFxuICAgIHB1YmxpYyBzdGF0ZTogU3RhdGUsXG4gICkge31cblxuICBnZXRSZXN0KCkge1xuICAgIHJldHVybiB0aGlzLmlucHV0LnNsaWNlKHRoaXMuaW5kZXgpO1xuICB9XG5cbiAgcGVlayhsZW5ndGg6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmlucHV0LnNsaWNlKHRoaXMuaW5kZXgsIHRoaXMuaW5kZXggKyBsZW5ndGgpO1xuICB9XG5cbiAgc3RhcnRzV2l0aChzdHJpbmc6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLnBlZWsoc3RyaW5nLmxlbmd0aCkgPT09IHN0cmluZztcbiAgfVxuXG4gIHNraXAobGVuZ3RoID0gMSkge1xuICAgIHRoaXMuaW5kZXggKz0gbGVuZ3RoO1xuICB9XG5cbiAgY29uc3VtZSgpIHtcbiAgICBjb25zdCBjaGFyID0gdGhpcy5pbnB1dFt0aGlzLmluZGV4XTtcbiAgICB0aGlzLmluZGV4ICs9IDE7XG4gICAgcmV0dXJuIGNoYXI7XG4gIH1cblxuICBlb2YoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZXggPj0gdGhpcy5pbnB1dC5sZW5ndGg7XG4gIH1cblxuICByZWNvbnN1bWUoKSB7XG4gICAgdGhpcy5pbmRleCAtPSAxO1xuICB9XG5cbiAgc2V0U3RhdGUoc3RhdGU6IFN0YXRlLCByZXR1cm5TdGF0ZT86IFN0YXRlKSB7XG4gICAgaWYgKHJldHVyblN0YXRlICE9IG51bGwpIHtcbiAgICAgIHRoaXMucmV0dXJuU3RhdGUucHVzaChyZXR1cm5TdGF0ZSk7XG4gICAgfVxuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcbiAgfVxuXG4gIHBvcFJldHVyblN0YXRlKCkge1xuICAgIHRoaXMuc3RhdGUgPSB0aGlzLnJldHVyblN0YXRlLnBvcCgpITtcbiAgfVxuXG4gICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICB3aGlsZSAoIXRoaXMuZW9mKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuY29uc3VtZSgpO1xuICAgIH1cbiAgfVxuXG4gIGNsb25lKCkge1xuICAgIGNvbnN0IGNsb25lID0gbmV3IFRva2VuaXplckNvbnRleHQodGhpcy5pbnB1dCwgdGhpcy5pbmRleCwgdGhpcy5zdGF0ZSk7XG4gICAgY2xvbmUucmV0dXJuU3RhdGUgPSB0aGlzLnJldHVyblN0YXRlO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIHNldChjdHg6IFRva2VuaXplckNvbnRleHQ8U3RhdGU+KSB7XG4gICAgdGhpcy5yZXR1cm5TdGF0ZSA9IGN0eC5yZXR1cm5TdGF0ZTtcbiAgICB0aGlzLmlucHV0ID0gY3R4LmlucHV0O1xuICAgIHRoaXMuaW5kZXggPSBjdHguaW5kZXg7XG4gICAgdGhpcy5zdGF0ZSA9IGN0eC5zdGF0ZTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBpc0NoYXJBbHBoYSwgaXNDaGFyU3BhY2UsIFRva2VuaXplckNvbnRleHQgfSBmcm9tIFwiLi90b2tlbml6ZXJcIjtcblxuZW51bSBUb2tlbkVudW0ge1xuICBjaGFyYWN0ZXIsXG4gIHRhZyxcbiAgZG9jdHlwZSxcbn1cblxuZW51bSBTdGF0ZSB7XG4gIGRhdGEsXG4gIHRhZ09wZW4sXG4gIGVuZFRhZ09wZW4sXG4gIHRhZ05hbWUsXG4gIGJlZm9yZUF0dHJpYnV0ZU5hbWUsXG4gIGF0dHJpYnV0ZU5hbWUsXG4gIGFmdGVyQXR0cmlidXRlTmFtZSxcbiAgYmVmb3JlQXR0cmlidXRlVmFsdWUsXG4gIGF0dHJpYnV0ZVZhbHVlRG91YmxlUXVvdGVkLFxuICBhdHRyaWJ1dGVWYWx1ZVNpbmdsZVF1b3RlZCxcbiAgYXR0cmlidXRlVmFsdWVVbnF1b3RlZCxcbiAgYWZ0ZXJBdHRyaWJ1dGVWYWx1ZVF1b3RlZCxcbiAgc2VsZkNsb3NpbmdTdGFydFRhZyxcbiAgYm9ndXNDb21tZW50LFxuICBtYXJrdXBEZWNsYXJhdGlvbk9wZW4sXG4gIGNvbW1lbnQsXG4gIGRvY3R5cGUsXG4gIGJlZm9yZURvY3R5cGVOYW1lLFxuICBkb2N0eXBlTmFtZSxcbiAgYWZ0ZXJEb2N0eXBlTmFtZSxcbn1cblxuaW50ZXJmYWNlIENoYXJhY3RlclRva2VuIHtcbiAgdHlwZTogVG9rZW5FbnVtLmNoYXJhY3RlcjtcbiAgY2hhcmFjdGVyOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBUYWdUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS50YWc7XG4gIG5hbWU6IHN0cmluZztcbiAgY2xvc2luZzogYm9vbGVhbjtcbiAgYXR0cmlidXRlczogW3N0cmluZywgc3RyaW5nXVtdO1xuICBzZWxmQ2xvc2luZzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIERvY3R5cGVUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS5kb2N0eXBlO1xuICBkb2N0eXBlOiBzdHJpbmc7XG59XG5cbi8vIGdlbmVyYXRpbmdcblxuY29uc3QgZ2VuZXJhdGVDaGFyYWN0ZXJUb2tlbiA9IChjaGFyYWN0ZXI6IHN0cmluZyk6IENoYXJhY3RlclRva2VuID0+IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBUb2tlbkVudW0uY2hhcmFjdGVyLFxuICAgIGNoYXJhY3RlcixcbiAgfTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlRW1wdHlUYWdUb2tlbiA9IChjbG9zaW5nOiBib29sZWFuKTogVGFnVG9rZW4gPT4ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFRva2VuRW51bS50YWcsXG4gICAgbmFtZTogXCJcIixcbiAgICBjbG9zaW5nLFxuICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgIHNlbGZDbG9zaW5nOiBmYWxzZSxcbiAgfTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlRG9jdHlwZVRva2VuID0gKCk6IERvY3R5cGVUb2tlbiA9PiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogVG9rZW5FbnVtLmRvY3R5cGUsXG4gICAgZG9jdHlwZTogXCJcIixcbiAgfTtcbn07XG5cbi8vIHRva2VuaXplcmluZ1xuXG5mdW5jdGlvbiogdG9rZW5pemVyKGlucHV0OiBzdHJpbmcpIHtcbiAgY29uc3QgcyA9IG5ldyBUb2tlbml6ZXJDb250ZXh0KGlucHV0LCAwLCBTdGF0ZS5kYXRhKTtcblxuICBsZXQgdGFnVG9rZW46IFRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKGZhbHNlKTtcbiAgbGV0IGF0dHJpYnV0ZTogW3N0cmluZywgc3RyaW5nXSA9IFtcIlwiLCBcIlwiXTtcbiAgbGV0IGRvY3R5cGVUb2tlbjogRG9jdHlwZVRva2VuID0gZ2VuZXJhdGVEb2N0eXBlVG9rZW4oKTtcblxuICB3aGlsZSAoIXMuZW9mKCkpIHtcbiAgICBjb25zdCBzdGF0ZSA9IHMuc3RhdGU7XG4gICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5kYXRhOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiPFwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnRhZ09wZW4pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj9cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYm9ndXNDb21tZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB5aWVsZCBnZW5lcmF0ZUNoYXJhY3RlclRva2VuKGNoYXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUudGFnT3Blbjoge1xuICAgICAgICBjb25zdCBjaGFyID0gcy5jb25zdW1lKCk7XG4gICAgICAgIGlmIChjaGFyID09PSBcIiFcIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUubWFya3VwRGVjbGFyYXRpb25PcGVuKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZW5kVGFnT3Blbik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNDaGFyQWxwaGEoY2hhcikpIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKGZhbHNlKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnRhZ05hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuZW5kVGFnT3Blbjoge1xuICAgICAgICAvLyB3ZSBkb24ndCByZWFsbHkgY2FyZSBhYm91dCBlcnJvciBoYW5kbGluZyB0YmguLi5cbiAgICAgICAgY29uc3QgY2hhciA9IHMuY29uc3VtZSgpO1xuICAgICAgICBpZiAoaXNDaGFyQWxwaGEoY2hhcikpIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKHRydWUpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUudGFnTmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJvZ3VzQ29tbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLnRhZ05hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICB0YWdUb2tlbi5zZWxmQ2xvc2luZyA9IHRydWU7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhZ1Rva2VuLm5hbWUgKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIiB8fCBjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI9XCIpIHtcbiAgICAgICAgICAgIC8vIFRPRE9cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlID0gW1wiXCIsIFwiXCJdO1xuICAgICAgICAgICAgdGFnVG9rZW4uYXR0cmlidXRlcy5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSB8fCBjaGFyID09PSBcIi9cIiB8fCBjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI9XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZVswXSArPSBjaGFyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuc2VsZkNsb3NpbmdTdGFydFRhZyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGUgPSBbXCJcIiwgXCJcIl07XG4gICAgICAgICAgICB0YWdUb2tlbi5hdHRyaWJ1dGVzLnB1c2goYXR0cmlidXRlKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVWYWx1ZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hhciA9IHMuY29uc3VtZSgpO1xuICAgICAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVNpbmdsZVF1b3RlZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVVucXVvdGVkKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZVZhbHVlU2luZ2xlUXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZVsxXSArPSBjaGFyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYXR0cmlidXRlVmFsdWVVbnF1b3RlZDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5zZWxmQ2xvc2luZ1N0YXJ0VGFnOiB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgdGFnVG9rZW4uc2VsZkNsb3NpbmcgPSB0cnVlO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYm9ndXNDb21tZW50OiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5tYXJrdXBEZWNsYXJhdGlvbk9wZW46IHtcbiAgICAgICAgY29uc3QgZG9jdHlwZSA9IFwiZG9jdHlwZVwiO1xuICAgICAgICBpZiAocy5wZWVrKGRvY3R5cGUubGVuZ3RoKS50b0xvd2VyQ2FzZSgpID09PSBkb2N0eXBlKSB7XG4gICAgICAgICAgcy5za2lwKGRvY3R5cGUubGVuZ3RoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRvY3R5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHMucGVlaygyKSA9PT0gXCItLVwiKSB7XG4gICAgICAgICAgcy5za2lwKDIpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuY29tbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmNvbW1lbnQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gXCItXCIgJiYgcy5wZWVrKDIpID09PSBcIi0+XCIpIHtcbiAgICAgICAgICAgIHMuc2tpcCgyKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmRvY3R5cGU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgZG9jdHlwZVRva2VuID0gZ2VuZXJhdGVEb2N0eXBlVG9rZW4oKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZG9jdHlwZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5kb2N0eXBlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckRvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIGRvY3R5cGVUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdHlwZVRva2VuLmRvY3R5cGUgKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYWZ0ZXJEb2N0eXBlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIHlpZWxkIGRvY3R5cGVUb2tlbjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgY29uc3QgX3Y6IG5ldmVyID0gc3RhdGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8vIGVuZCBvZiBjb21wbGlhbmNlIHN0YXJ0cyBhcm91bmQgaGVyZS4gSSBqdXN0IHN0YXJ0IHNwaXRiYWxsaW5nIGhlcmUgd3JpdGluZ1xuLy8gaW4gZGlzZ3VzdGluZyBoYWNrc1xuXG53aW5kb3cudG9rZW5pemVyID0gdG9rZW5pemVyO1xuXG5leHBvcnQgY2xhc3MgVGV4dE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nKSB7fVxuXG4gIGdldCB0ZXh0Q29udGV4dCgpIHtcbiAgICByZXR1cm4gdGhpcy50ZXh0LnJlcGxhY2UoL1xccysvZywgJyAnKTtcbiAgfVxuXG4gIGRlYnVnKCkge1xuICAgIHJldHVybiB0aGlzLnRleHQ7XG4gIH1cblxuICBodG1sKGluZGVudCA9IDApIHtcbiAgICByZXR1cm4gJyAnLnJlcGVhdChpbmRlbnQpICsgdGhpcy50ZXh0Q29udGV4dDtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSU5vZGUge1xuICB0YWc6IHN0cmluZztcbiAgYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgY2hpbGROb2RlczogKFRleHROb2RlIHwgSU5vZGUpW107XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlIGltcGxlbWVudHMgSU5vZGUge1xuICBjaGlsZE5vZGVzOiAoTm9kZSB8IFRleHROb2RlKVtdID0gW107XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgdGFnOiBzdHJpbmcsXG4gICAgcHVibGljIGF0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSxcbiAgICBwdWJsaWMgcGFyZW50OiBOb2RlIHwgdW5kZWZpbmVkLFxuICApIHt9XG5cbiAgKmdldEVsZW1lbnRzQnlUYWduYW1lKHRhZ25hbWU6IHN0cmluZyk6IEdlbmVyYXRvcjxOb2RlPiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNoaWxkTm9kZXNbaV07XG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUudGFnID09PSB0YWduYW1lKSB7XG4gICAgICAgICAgeWllbGQgbm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3Qgc3Vibm9kZSBvZiBub2RlLmdldEVsZW1lbnRzQnlUYWduYW1lKHRhZ25hbWUpKSB7XG4gICAgICAgICAgeWllbGQgc3Vibm9kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGRlYnVnKCk6IERlYnVnTm9kZSB7XG4gICAgY29uc3QgeyBwYXJlbnQsIGNoaWxkTm9kZXMsIC4uLnJlc3QgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnJlc3QsXG4gICAgICBjaGlsZE5vZGVzOiBjaGlsZE5vZGVzLm1hcCgoY2hpbGQpID0+IGNoaWxkLmRlYnVnKCkpLFxuICAgIH07XG4gIH1cblxuICBodG1sKGluZGVudCA9IDApOiBzdHJpbmcge1xuICAgIGNvbnN0IG5leHRMZXZlbEluZGVudCA9IHRoaXMudGFnID09PSAnJyA/IGluZGVudCA6IGluZGVudCArIDI7XG4gICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLmNoaWxkTm9kZXMubWFwKChub2RlKSA9PiBub2RlLmh0bWwobmV4dExldmVsSW5kZW50KSkuam9pbihcIlxcblwiKTtcbiAgICBpZiAodGhpcy50YWcgPT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgbGV0IGF0dHJpYnV0ZXMgPSBcIlwiO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuYXR0cmlidXRlcykpIHtcbiAgICAgIGF0dHJpYnV0ZXMgKz0gXCIgXCI7XG4gICAgICBhdHRyaWJ1dGVzICs9IGAke2tleX09XCIke3ZhbHVlfVwiYDtcbiAgICB9XG4gICAgY29uc3QgaW5kZW50YXRpb24gPSAnICcucmVwZWF0KGluZGVudCk7XG4gICAgcmV0dXJuIGAke2luZGVudGF0aW9ufTwke3RoaXMudGFnfSR7YXR0cmlidXRlc30+XFxuJHtjaGlsZHJlbn1cXG4ke2luZGVudGF0aW9ufTwvJHt0aGlzLnRhZ30+YCA7XG4gIH1cbn1cblxudHlwZSBSZW1vdmVNZXRob2RzPFQ+ID0ge1xuICBbUCBpbiBrZXlvZiBUIGFzIFRbUF0gZXh0ZW5kcyBGdW5jdGlvbiA/IG5ldmVyIDogUF06IFRbUF07XG59O1xuXG50eXBlIERlYnVnTm9kZSA9IFJlbW92ZU1ldGhvZHM8T21pdDxOb2RlLCBcInBhcmVudFwiIHwgXCJjaGlsZE5vZGVzXCI+PiAmIHtcbiAgY2hpbGROb2RlczogKHN0cmluZyB8IERlYnVnTm9kZSlbXTtcbn07XG5cbmNvbnN0IHZvaWRUYWdzID0gW1xuICBcImFyZWFcIixcbiAgXCJiYXNlXCIsXG4gIFwiYnJcIixcbiAgXCJjb2xcIixcbiAgXCJlbWJlZFwiLFxuICBcImhyXCIsXG4gIFwiaW1nXCIsXG4gIFwiaW5wdXRcIixcbiAgXCJsaW5rXCIsXG4gIFwibWV0YVwiLFxuICBcInBhcmFtXCIsXG4gIFwic291cmNlXCIsXG4gIFwidHJhY2tcIixcbiAgXCJ3YnJcIixcbl07XG5jb25zdCBpbXBsaWVkRW5kVGFncyA9IFtcbiAgXCJkZFwiLFxuICBcImR0XCIsXG4gIFwibGlcIixcbiAgXCJvcHRncm91cFwiLFxuICBcIm9wdGlvblwiLFxuICBcInBcIixcbiAgXCJyYlwiLFxuICBcInJwXCIsXG4gIFwicnRcIixcbiAgXCJydGNcIixcbl07XG5cbmNvbnN0IGdlbmVyYXRlSW1wbGllZEVuZFRhZ3MgPSBbXG4gIC4uLmltcGxpZWRFbmRUYWdzLFxuICBcImRsXCJcbl1cblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGlucHV0OiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgcm9vdCA9IG5ldyBOb2RlKFwiXCIsIHt9LCB1bmRlZmluZWQpO1xuICBsZXQgbm9kZSA9IHJvb3Q7XG4gIGNvbnN0IHRva2VucyA9IFsuLi50b2tlbml6ZXIoaW5wdXQpXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgIGNhc2UgVG9rZW5FbnVtLmRvY3R5cGU6IHtcbiAgICAgICAgLy8gbG9sIGRvbid0IGNhcmUgcmVuZGVyaW5nIGF0IGh0bWw1IG5vIG1hdHRlciB3aGF0XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBUb2tlbkVudW0udGFnOiB7XG4gICAgICAgIGlmICh0b2tlbi5jbG9zaW5nKSB7XG4gICAgICAgICAgLy8gbG9vayB1cCBhbmQgc2VlIGlmIHRoZXJlJ3MgYSBub2RlIHdlIGNhbiBjbG9zZVxuICAgICAgICAgIGxldCBjdXJyZW50ID0gbm9kZTtcbiAgICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgaWYgKHRva2VuLm5hbWUgPT09IGN1cnJlbnQudGFnKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuYXNzZXJ0KGN1cnJlbnQucGFyZW50LCBcImNsb3NlZCAxIHRvbyBtYW55IG5vZGVzIGxvbFwiKTtcbiAgICAgICAgICAgICAgbm9kZSA9IGN1cnJlbnQucGFyZW50ITtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQhO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoY3VycmVudCA9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBjYW4ndCBjbG9zZSAke3Rva2VuLm5hbWV9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChnZW5lcmF0ZUltcGxpZWRFbmRUYWdzLmluY2x1ZGVzKHRva2VuLm5hbWUpKSB7XG4gICAgICAgICAgICAvLyBnb3R0YSBjaGVjayBhbmQgc2VlIGlmIHdlIG5lZWQgdG8gY2xvc2UgYW55dGhpbmcgaW4gdGhlIHRyZWVcbiAgICAgICAgICAgIGxldCBjdXJyZW50ID0gbm9kZTtcbiAgICAgICAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgICAgICAgIGlmIChpbXBsaWVkRW5kVGFncy5pbmNsdWRlcyhjdXJyZW50LnRhZykpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gY3VycmVudC5wYXJlbnQhO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudCE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5ld05vZGUgPSBuZXcgTm9kZShcbiAgICAgICAgICAgIHRva2VuLm5hbWUsXG4gICAgICAgICAgICBPYmplY3QuZnJvbUVudHJpZXModG9rZW4uYXR0cmlidXRlcyksXG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbm9kZS5jaGlsZE5vZGVzLnB1c2gobmV3Tm9kZSk7XG4gICAgICAgICAgaWYgKHZvaWRUYWdzLmluY2x1ZGVzKHRva2VuLm5hbWUpKSB7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUgPSBuZXdOb2RlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgVG9rZW5FbnVtLmNoYXJhY3Rlcjoge1xuICAgICAgICBjb25zdCB0ZXh0bm9kZSA9IG5ldyBUZXh0Tm9kZShcIlwiKTtcbiAgICAgICAgd2hpbGUgKGkgPCB0b2tlbnMubGVuZ3RoICYmIHRva2Vuc1tpXS50eXBlID09PSBUb2tlbkVudW0uY2hhcmFjdGVyKSB7XG4gICAgICAgICAgdGV4dG5vZGUudGV4dCArPSAodG9rZW5zW2ldIGFzIENoYXJhY3RlclRva2VuKS5jaGFyYWN0ZXI7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUuY2hpbGROb2Rlcy5wdXNoKHRleHRub2RlKTtcbiAgICAgICAgaSAtPSAxO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcm9vdDtcbn07XG53aW5kb3cucGFyc2UgPSBwYXJzZTtcbiIsCiAgICAiaW1wb3J0IHsgTm9kZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuXG5pbnRlcmZhY2UgU3R5bGUge1xuICBkaXNwbGF5Pzogc3RyaW5nO1xuICBjb2xvcj86IHN0cmluZztcbiAgXCJmb250LXNpemVcIj86IG51bWJlcjtcbiAgXCJtYXJnaW4tbGVmdFwiPzogbnVtYmVyO1xuICBcIm1hcmdpbi10b3BcIj86IG51bWJlcjtcbiAgXCJtYXJnaW4tYm90dG9tXCI/OiBudW1iZXI7XG4gIFwiZm9udC13ZWlnaHRcIj86IHN0cmluZztcbiAgXCJ0ZXh0LWRlY29yYXRpb25cIj86IHN0cmluZztcbn1cblxuY29uc3QgRk9OVCA9IFwiVGltZXMgTmV3IFJvbWFuXCI7XG5cbmNvbnN0IGRlZmF1bHRTdHlsZXMgPSB7XG4gIGgxOiB7XG4gICAgXCJkaXNwbGF5XCI6IFwiYmxvY2tcIixcbiAgICBcImZvbnQtc2l6ZVwiOiAzMixcbiAgICBcIm1hcmdpbi10b3BcIjogMjIsXG4gICAgXCJtYXJnaW4tYm90dG9tXCI6IDIyLFxuICAgIFwiZm9udC13ZWlnaHRcIjogXCJib2xkXCIsXG4gIH0sXG4gIGE6IHtcbiAgICBkaXNwbGF5OiBcImlubGluZVwiLFxuICAgIGNvbG9yOiBcImJsdWVcIixcbiAgICBcInRleHQtZGVjb3JhdGlvblwiOiBcInVuZGVybGluZVwiLFxuICB9LFxuICBwOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwibWFyZ2luLXRvcFwiOiAxNixcbiAgICBcIm1hcmdpbi1ib3R0b21cIjogMTYsXG4gIH0sXG4gIGRsOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwibWFyZ2luLXRvcFwiOiAxNixcbiAgICBcIm1hcmdpbi1ib3R0b21cIjogMTYsXG4gIH0sXG4gIGR0OiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiXG4gIH0sXG4gIGRkOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwibWFyZ2luLWxlZnRcIjogNDAsXG4gIH1cbn0gc2F0aXNmaWVzIFJlY29yZDxzdHJpbmcsIFN0eWxlPjtcblxuaW50ZXJmYWNlIFRleHROb2RlIHtcbiAgbGVmdDogbnVtYmVyO1xuICB0b3A6IG51bWJlcjtcbiAgdGV4dDogc3RyaW5nO1xuICBjb2xvcjogc3RyaW5nO1xuICBib2xkOiBzdHJpbmc7XG4gIHVuZGVybGluZTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIExheW91dENvbnRleHQge1xuICBsZWZ0OiBudW1iZXI7XG4gIHRvcDogbnVtYmVyO1xuICBtYXJnaW5MZWZ0OiBudW1iZXI7XG4gIG1hcmdpblRvcDogbnVtYmVyO1xuICBjb2xvcj86IHN0cmluZztcbiAgYm9sZD86IHN0cmluZztcbiAgdW5kZXJsaW5lPzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVMYXlvdXROb2Rlcyh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgYm9keTogTm9kZSk6IFRleHROb2RlW10ge1xuICBjb25zdCBub2RlczogVGV4dE5vZGVbXSA9IFtdO1xuICBjb25zdCBjdHg6IExheW91dENvbnRleHRbXSA9IFt7XG4gICAgbGVmdDogMCxcbiAgICB0b3A6IDAsXG4gICAgbWFyZ2luTGVmdDogOCxcbiAgICBtYXJnaW5Ub3A6IDgsXG4gIH1dXG4gIGxldCBzdGFjazogKE5vZGUpW10gPSBbYm9keV1cblxuICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgY29uc3Qgbm9kZSA9IHN0YWNrLnBvcCgpITtcblxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgTm9kZSkge1xuXG4gICAgICBmb3IgKGxldCBpID0gbm9kZS5jaGlsZE5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5vZGUuY2hpbGROb2Rlc1tpXTtcbiAgICAgICAgaWYgKGNoaWxkTm9kZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgICBzdGFjay5wdXNoKGNoaWxkTm9kZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuXG4gICAgfVxuXG4gIH1cblxuXG4gIHJldHVybiBub2Rlcztcbn1cblxuZXhwb3J0IGNvbnN0IHJlbmRlciA9IChjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LCBib2R5OiBOb2RlKSA9PiB7XG4gIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICBsZXQgbWFyZ2luTGVmdDogbnVtYmVyW10gPSBbOF07XG4gIGxldCBtYXJnaW5Ub3AgPSA4O1xuXG4gIFxufVxuIiwKICAgICJpbXBvcnQgeyBOb2RlLCBwYXJzZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSBcIi4vcmVuZGVyZXJcIjtcblxuY29uc3QgUFJPWFlfSE9TVCA9IFwiaHR0cDovL2xvY2FsaG9zdDo4MDkwXCJcblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hQYWdlKHVybDogc3RyaW5nKSB7XG4gIC8vIGdvdHRhIHByb3h5IGR1ZSB0byBjb3JzIGVycm9yc1xuICBjb25zdCBwcm94aWVkID0gYCR7UFJPWFlfSE9TVH0vJHt1cmx9YDtcbiAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKHByb3hpZWQpO1xuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcC50ZXh0KCk7XG5cbiAgcmV0dXJuIHRleHQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclBhZ2UoaHRtbDogc3RyaW5nKSB7XG4gIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXMnKSEgYXMgSFRNTENhbnZhc0VsZW1lbnQ7XG4gIGNvbnN0IG5vZGUgPSBwYXJzZShodG1sKVxufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluKCkge1xuICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJykgYXMgSFRNTENhbnZhc0VsZW1lbnQ7XG4gIGNvbnN0IGh0bWxEaXNwbGF5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0aHRtbCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG4gIGNvbnN0IGFkZHJlc3NCYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWRkcmVzcy1iYXInKSEgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgbGV0IHRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgbGV0IGh0bWw6IE5vZGUgfCB1bmRlZmluZWQ7XG5cbiAgYXN5bmMgZnVuY3Rpb24gcnVuKCkge1xuICAgIHRleHQgPSBhd2FpdCBmZXRjaFBhZ2UoYWRkcmVzc0Jhci52YWx1ZSk7XG4gICAgaHRtbCA9IHBhcnNlKHRleHQpXG4gICAgaHRtbERpc3BsYXkudGV4dENvbnRlbnQgPSBodG1sLmh0bWwoKTtcblxuICAgIGNvbnN0IFtib2R5XSA9IGh0bWwuZ2V0RWxlbWVudHNCeVRhZ25hbWUoXCJib2R5XCIpXG4gICAgcmVuZGVyKGNhbnZhcywgYm9keSk7XG4gIH1cblxuICBhZGRyZXNzQmFyLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHJ1bilcbiAgcnVuKCk7XG59XG5cbmlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBtYWluKTtcbn0gZWxzZSB7XG4gIG1haW4oKTtcbn1cblxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQUFPLElBQU0sY0FBYyxDQUFDLFdBQW1CO0FBQzdDLFNBQU8sV0FBVyxPQUFPLFVBQVUsUUFBUSxXQUFXLFFBQVEsV0FBVztBQUFBO0FBV3BFLElBQU0sY0FBYyxDQUFDLFdBQW1CO0FBQzdDLFFBQU0sV0FBVyxPQUFPLFdBQVcsQ0FBQztBQUNwQyxRQUFNLElBQUksSUFBSSxXQUFXLENBQUM7QUFDMUIsUUFBTSxJQUFJLElBQUksV0FBVyxDQUFDO0FBQzFCLFFBQU0sSUFBSSxJQUFJLFdBQVcsQ0FBQztBQUMxQixRQUFNLElBQUksSUFBSSxXQUFXLENBQUM7QUFFMUIsU0FBUSxZQUFZLEtBQUssWUFBWSxLQUFPLFlBQVksS0FBSyxZQUFZO0FBQUE7QUF1QnBFLE1BQU0saUJBQXdCO0FBQUEsRUFJMUI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBTFQsY0FBdUIsQ0FBQztBQUFBLEVBRXhCLFdBQVcsQ0FDRixPQUNBLE9BQ0EsT0FDUDtBQUhPO0FBQ0E7QUFDQTtBQUFBO0FBQUEsRUFHVCxPQUFPLEdBQUc7QUFDUixXQUFPLEtBQUssTUFBTSxNQUFNLEtBQUssS0FBSztBQUFBO0FBQUEsRUFHcEMsSUFBSSxDQUFDLFFBQWdCO0FBQ25CLFdBQU8sS0FBSyxNQUFNLE1BQU0sS0FBSyxPQUFPLEtBQUssUUFBUSxNQUFNO0FBQUE7QUFBQSxFQUd6RCxVQUFVLENBQUMsUUFBZ0I7QUFDekIsV0FBTyxLQUFLLEtBQUssT0FBTyxNQUFNLE1BQU07QUFBQTtBQUFBLEVBR3RDLElBQUksQ0FBQyxTQUFTLEdBQUc7QUFDZixTQUFLLFNBQVM7QUFBQTtBQUFBLEVBR2hCLE9BQU8sR0FBRztBQUNSLFVBQU0sT0FBTyxLQUFLLE1BQU0sS0FBSztBQUM3QixTQUFLLFNBQVM7QUFDZCxXQUFPO0FBQUE7QUFBQSxFQUdULEdBQUcsR0FBRztBQUNKLFdBQU8sS0FBSyxTQUFTLEtBQUssTUFBTTtBQUFBO0FBQUEsRUFHbEMsU0FBUyxHQUFHO0FBQ1YsU0FBSyxTQUFTO0FBQUE7QUFBQSxFQUdoQixRQUFRLENBQUMsT0FBYyxhQUFxQjtBQUMxQyxRQUFJLGVBQWUsTUFBTTtBQUN2QixXQUFLLFlBQVksS0FBSyxXQUFXO0FBQUEsSUFDbkM7QUFDQSxTQUFLLFFBQVE7QUFBQTtBQUFBLEVBR2YsY0FBYyxHQUFHO0FBQ2YsU0FBSyxRQUFRLEtBQUssWUFBWSxJQUFJO0FBQUE7QUFBQSxJQUdsQyxPQUFPLFNBQVMsR0FBRztBQUNuQixZQUFRLEtBQUssSUFBSSxHQUFHO0FBQ2xCLFlBQU0sS0FBSyxRQUFRO0FBQUEsSUFDckI7QUFBQTtBQUFBLEVBR0YsS0FBSyxHQUFHO0FBQ04sVUFBTSxRQUFRLElBQUksaUJBQWlCLEtBQUssT0FBTyxLQUFLLE9BQU8sS0FBSyxLQUFLO0FBQ3JFLFVBQU0sY0FBYyxLQUFLO0FBQ3pCLFdBQU87QUFBQTtBQUFBLEVBR1QsR0FBRyxDQUFDLEtBQThCO0FBQ2hDLFNBQUssY0FBYyxJQUFJO0FBQ3ZCLFNBQUssUUFBUSxJQUFJO0FBQ2pCLFNBQUssUUFBUSxJQUFJO0FBQ2pCLFNBQUssUUFBUSxJQUFJO0FBQUE7QUFFckI7OztBQ2pDQSxVQUFVLFVBQVMsQ0FBQyxPQUFlO0FBQ2pDLFFBQU0sSUFBSSxJQUFJLGlCQUFpQixPQUFPLEdBQUcsWUFBVTtBQUVuRCxNQUFJLFdBQXFCLHNCQUFzQixLQUFLO0FBQ3BELE1BQUksWUFBOEIsQ0FBQyxJQUFJLEVBQUU7QUFDekMsTUFBSSxlQUE2QixxQkFBcUI7QUFFdEQsVUFBUSxFQUFFLElBQUksR0FBRztBQUNmLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFlBQVE7QUFBQSxXQUNELGNBQVk7QUFDZixtQkFBVyxRQUFRLEdBQUc7QUFDcEIsY0FBSSxTQUFTLEtBQUs7QUFDaEIsY0FBRSxTQUFTLGVBQWE7QUFDeEI7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLGNBQUUsVUFBVTtBQUNaLGNBQUUsU0FBUyxxQkFBa0I7QUFDN0I7QUFBQSxVQUNGLE9BQU87QUFDTCxrQkFBTSx1QkFBdUIsSUFBSTtBQUFBO0FBQUEsUUFFckM7QUFDQTtBQUFBLE1BQ0Y7QUFBQSxXQUNLLGlCQUFlO0FBQ2xCLGNBQU0sT0FBTyxFQUFFLFFBQVE7QUFDdkIsWUFBSSxTQUFTLEtBQUs7QUFDaEIsWUFBRSxTQUFTLDhCQUEyQjtBQUFBLFFBQ3hDLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLFlBQUUsU0FBUyxrQkFBZ0I7QUFBQSxRQUM3QixXQUFXLFlBQVksSUFBSSxHQUFHO0FBQzVCLFlBQUUsVUFBVTtBQUNaLHFCQUFXLHNCQUFzQixLQUFLO0FBQ3RDLFlBQUUsU0FBUyxlQUFhO0FBQUEsUUFDMUIsT0FBTztBQUNMLFlBQUUsVUFBVTtBQUNaLFlBQUUsU0FBUyxZQUFVO0FBQUE7QUFFdkI7QUFBQSxNQUNGO0FBQUEsV0FDSyxvQkFBa0I7QUFFckIsY0FBTSxPQUFPLEVBQUUsUUFBUTtBQUN2QixZQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCLFlBQUUsVUFBVTtBQUNaLHFCQUFXLHNCQUFzQixJQUFJO0FBQ3JDLFlBQUUsU0FBUyxlQUFhO0FBQUEsUUFDMUIsT0FBTztBQUNMLFlBQUUsVUFBVTtBQUNaLFlBQUUsU0FBUyxxQkFBa0I7QUFBQTtBQUUvQjtBQUFBLE1BQ0Y7QUFBQSxXQUNLLGlCQUFlO0FBQ2xCLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCLGNBQUUsU0FBUywyQkFBeUI7QUFDcEM7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLHFCQUFTLGNBQWM7QUFDdkIsY0FBRSxTQUFTLDRCQUF5QjtBQUNwQztBQUFBLFVBQ0YsV0FBVyxTQUFTLEtBQUs7QUFDdkIsa0JBQU07QUFDTixjQUFFLFNBQVMsWUFBVTtBQUNyQjtBQUFBLFVBQ0YsT0FBTztBQUNMLHFCQUFTLFFBQVEsS0FBSyxZQUFZO0FBQUE7QUFBQSxRQUV0QztBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssNkJBQTJCO0FBQzlCLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCO0FBQUEsVUFDRixXQUFXLFNBQVMsT0FBTyxTQUFTLEtBQUs7QUFDdkMsY0FBRSxVQUFVO0FBQ1osY0FBRSxTQUFTLDBCQUF3QjtBQUNuQztBQUFBLFVBQ0YsV0FBVyxTQUFTLEtBQUs7QUFBQSxVQUV6QixPQUFPO0FBQ0wsd0JBQVksQ0FBQyxJQUFJLEVBQUU7QUFDbkIscUJBQVMsV0FBVyxLQUFLLFNBQVM7QUFDbEMsY0FBRSxTQUFTLHFCQUFtQjtBQUM5QixjQUFFLFVBQVU7QUFDWjtBQUFBO0FBQUEsUUFFSjtBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssdUJBQXFCO0FBQ3hCLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxLQUFLLFNBQVMsT0FBTyxTQUFTLEtBQUs7QUFDckQsY0FBRSxVQUFVO0FBQ1osY0FBRSxTQUFTLDBCQUF3QjtBQUNuQztBQUFBLFVBQ0YsV0FBVyxTQUFTLEtBQUs7QUFDdkIsY0FBRSxTQUFTLDRCQUEwQjtBQUNyQztBQUFBLFVBQ0YsT0FBTztBQUNMLHNCQUFVLE1BQU0sS0FBSyxZQUFZO0FBQUE7QUFBQSxRQUVyQztBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssNEJBQTBCO0FBQzdCLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCO0FBQUEsVUFDRixXQUFXLFNBQVMsS0FBSztBQUN2QixjQUFFLFNBQVMsNEJBQXlCO0FBQ3BDO0FBQUEsVUFDRixXQUFXLFNBQVMsS0FBSztBQUN2QixjQUFFLFNBQVMsNEJBQTBCO0FBQ3JDO0FBQUEsVUFDRixXQUFXLFNBQVMsS0FBSztBQUN2QixrQkFBTTtBQUNOLGNBQUUsU0FBUyxZQUFVO0FBQ3JCO0FBQUEsVUFDRixPQUFPO0FBQ0wsd0JBQVksQ0FBQyxJQUFJLEVBQUU7QUFDbkIscUJBQVMsV0FBVyxLQUFLLFNBQVM7QUFDbEMsY0FBRSxTQUFTLHFCQUFtQjtBQUM5QixjQUFFLFVBQVU7QUFDWjtBQUFBO0FBQUEsUUFFSjtBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssOEJBQTRCO0FBQy9CLG1CQUFXLFNBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksS0FBSSxHQUFHO0FBQ3JCO0FBQUEsVUFDRjtBQUNBLFlBQUUsVUFBVTtBQUNaO0FBQUEsUUFDRjtBQUNBLGNBQU0sT0FBTyxFQUFFLFFBQVE7QUFDdkIsWUFBSSxTQUFTLEtBQUs7QUFDaEIsWUFBRSxTQUFTLGtDQUFnQztBQUFBLFFBQzdDLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLFlBQUUsU0FBUyxrQ0FBZ0M7QUFBQSxRQUM3QyxXQUFXLFNBQVMsS0FBSztBQUN2QixnQkFBTTtBQUNOLFlBQUUsU0FBUyxZQUFVO0FBQUEsUUFDdkIsT0FBTztBQUNMLFlBQUUsVUFBVTtBQUNaLFlBQUUsU0FBUywrQkFBNEI7QUFBQTtBQUV6QztBQUFBLE1BQ0Y7QUFBQSxXQUNLLG9DQUFrQztBQUNyQyxtQkFBVyxRQUFRLEdBQUc7QUFDcEIsY0FBSSxTQUFTLEtBQUs7QUFDaEIsY0FBRSxTQUFTLGtDQUErQjtBQUMxQztBQUFBLFVBQ0YsT0FBTztBQUNMLHNCQUFVLE1BQU07QUFBQTtBQUFBLFFBRXBCO0FBQ0E7QUFBQSxNQUNGO0FBQUEsV0FDSyxvQ0FBa0M7QUFDckMsbUJBQVcsUUFBUSxHQUFHO0FBQ3BCLGNBQUksU0FBUyxLQUFLO0FBQ2hCLGNBQUUsU0FBUyxrQ0FBK0I7QUFDMUM7QUFBQSxVQUNGLE9BQU87QUFDTCxzQkFBVSxNQUFNO0FBQUE7QUFBQSxRQUVwQjtBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssaUNBQThCO0FBQ2pDLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCLGNBQUUsU0FBUywyQkFBeUI7QUFDcEM7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLGtCQUFNO0FBQ04sY0FBRSxTQUFTLFlBQVU7QUFDckI7QUFBQSxVQUNGLE9BQU87QUFDTCxzQkFBVSxNQUFNO0FBQUE7QUFBQSxRQUVwQjtBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssb0NBQWlDO0FBQ3BDLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCLGNBQUUsU0FBUywyQkFBeUI7QUFDcEM7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLGNBQUUsU0FBUyw0QkFBeUI7QUFDcEM7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLGtCQUFNO0FBQ04sY0FBRSxTQUFTLFlBQVU7QUFDckI7QUFBQSxVQUNGLE9BQU87QUFDTCxjQUFFLFVBQVU7QUFDWixjQUFFLFNBQVMsMkJBQXlCO0FBQ3BDO0FBQUE7QUFBQSxRQUVKO0FBQ0E7QUFBQSxNQUNGO0FBQUEsV0FDSyw4QkFBMkI7QUFDOUIsY0FBTSxPQUFPLEVBQUUsUUFBUTtBQUN2QixZQUFJLFNBQVMsS0FBSztBQUNoQixtQkFBUyxjQUFjO0FBQ3ZCLFlBQUUsU0FBUyxZQUFVO0FBQUEsUUFDdkIsT0FBTztBQUNMLFlBQUUsVUFBVTtBQUNaLFlBQUUsU0FBUywwQkFBdUI7QUFBQTtBQUVwQztBQUFBLE1BQ0Y7QUFBQSxXQUNLLHVCQUFvQjtBQUN2QixtQkFBVyxRQUFRLEdBQUc7QUFDcEIsY0FBSSxTQUFTLEtBQUs7QUFDaEIsY0FBRSxTQUFTLFlBQVU7QUFDckI7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssZ0NBQTZCO0FBQ2hDLGNBQU0sVUFBVTtBQUNoQixZQUFJLEVBQUUsS0FBSyxRQUFRLE1BQU0sRUFBRSxZQUFZLE1BQU0sU0FBUztBQUNwRCxZQUFFLEtBQUssUUFBUSxNQUFNO0FBQ3JCLFlBQUUsU0FBUyxnQkFBYTtBQUFBLFFBQzFCLFdBQVcsRUFBRSxLQUFLLENBQUMsTUFBTSxNQUFNO0FBQzdCLFlBQUUsS0FBSyxDQUFDO0FBQ1IsWUFBRSxTQUFTLGdCQUFhO0FBQUEsUUFDMUI7QUFDQTtBQUFBLE1BQ0Y7QUFBQSxXQUNLLGtCQUFlO0FBQ2xCLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFNBQVMsT0FBTyxFQUFFLEtBQUssQ0FBQyxNQUFNLE1BQU07QUFDdEMsY0FBRSxLQUFLLENBQUM7QUFDUixjQUFFLFNBQVMsWUFBVTtBQUNyQjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQ0E7QUFBQSxNQUNGO0FBQUEsV0FDSyxrQkFBZTtBQUNsQixtQkFBVyxRQUFRLEdBQUc7QUFDcEIsY0FBSSxZQUFZLElBQUksR0FBRztBQUNyQixjQUFFLFNBQVMsMEJBQXVCO0FBQ2xDO0FBQUEsVUFDRixPQUFPO0FBQ0wsY0FBRSxVQUFVO0FBQ1osY0FBRSxTQUFTLDBCQUF1QjtBQUNsQztBQUFBO0FBQUEsUUFFSjtBQUNBO0FBQUEsTUFDRjtBQUFBLFdBQ0ssNEJBQXlCO0FBQzVCLG1CQUFXLFFBQVEsR0FBRztBQUNwQixjQUFJLFlBQVksSUFBSSxHQUFHO0FBQ3JCO0FBQUEsVUFDRixPQUFPO0FBQ0wsY0FBRSxVQUFVO0FBQ1osMkJBQWUscUJBQXFCO0FBQ3BDLGNBQUUsU0FBUyxvQkFBaUI7QUFDNUI7QUFBQTtBQUFBLFFBRUo7QUFDQTtBQUFBLE1BQ0Y7QUFBQSxXQUNLLHNCQUFtQjtBQUN0QixtQkFBVyxRQUFRLEdBQUc7QUFDcEIsY0FBSSxZQUFZLElBQUksR0FBRztBQUNyQixjQUFFLFNBQVMseUJBQXNCO0FBQ2pDO0FBQUEsVUFDRixXQUFXLFNBQVMsS0FBSztBQUN2QixrQkFBTTtBQUNOLGNBQUUsU0FBUyxZQUFVO0FBQ3JCO0FBQUEsVUFDRixPQUFPO0FBQ0wseUJBQWEsV0FBVyxLQUFLLFlBQVk7QUFBQTtBQUFBLFFBRTdDO0FBQ0E7QUFBQSxNQUNGO0FBQUEsV0FDSywyQkFBd0I7QUFDM0IsbUJBQVcsUUFBUSxHQUFHO0FBQ3BCLGNBQUksWUFBWSxJQUFJLEdBQUc7QUFDckI7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLGNBQUUsU0FBUyxZQUFVO0FBQ3JCLGtCQUFNO0FBQ047QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUNBO0FBQUEsTUFDRjtBQUFBLGVBQ1M7QUFDUCxjQUFNLEtBQVk7QUFBQSxNQUNwQjtBQUFBO0FBQUEsRUFFSjtBQUFBO0FBL1VGLElBQU0seUJBQXlCLENBQUMsY0FBc0M7QUFDcEUsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ047QUFBQSxFQUNGO0FBQUE7QUFHRixJQUFNLHdCQUF3QixDQUFDLFlBQStCO0FBQzVELFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOO0FBQUEsSUFDQSxZQUFZLENBQUM7QUFBQSxJQUNiLGFBQWE7QUFBQSxFQUNmO0FBQUE7QUFHRixJQUFNLHVCQUF1QixNQUFvQjtBQUMvQyxTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixTQUFTO0FBQUEsRUFDWDtBQUFBO0FBZ1VGLE9BQU8sWUFBWTtBQUVaO0FBQUEsTUFBTSxTQUFTO0FBQUEsRUFDRDtBQUFBLEVBQW5CLFdBQVcsQ0FBUSxNQUFjO0FBQWQ7QUFBQTtBQUFBLE1BRWYsV0FBVyxHQUFHO0FBQ2hCLFdBQU8sS0FBSyxLQUFLLFFBQVEsUUFBUSxHQUFHO0FBQUE7QUFBQSxFQUd0QyxLQUFLLEdBQUc7QUFDTixXQUFPLEtBQUs7QUFBQTtBQUFBLEVBR2QsSUFBSSxDQUFDLFNBQVMsR0FBRztBQUNmLFdBQU8sSUFBSSxPQUFPLE1BQU0sSUFBSSxLQUFLO0FBQUE7QUFFckM7QUFRTztBQUFBLE1BQU0sS0FBc0I7QUFBQSxFQUd4QjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFKVCxhQUFrQyxDQUFDO0FBQUEsRUFDNUIsV0FBVyxDQUNULEtBQ0EsYUFBcUMsQ0FBQyxHQUN0QyxRQUNQO0FBSE87QUFDQTtBQUNBO0FBQUE7QUFBQSxHQUdSLG9CQUFvQixDQUFDLFNBQWtDO0FBQ3RELGFBQVMsSUFBSSxFQUFHLElBQUksS0FBSyxXQUFXLFFBQVEsS0FBSztBQUMvQyxZQUFNLE9BQU8sS0FBSyxXQUFXO0FBQzdCLFVBQUksZ0JBQWdCLE1BQU07QUFDeEIsWUFBSSxLQUFLLFFBQVEsU0FBUztBQUN4QixnQkFBTTtBQUFBLFFBQ1I7QUFFQSxtQkFBVyxXQUFXLEtBQUsscUJBQXFCLE9BQU8sR0FBRztBQUN4RCxnQkFBTTtBQUFBLFFBQ1I7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBO0FBQUEsRUFHRixLQUFLLEdBQWM7QUFDakIsWUFBUSxRQUFRLGVBQWUsU0FBUztBQUN4QyxXQUFPO0FBQUEsU0FDRjtBQUFBLE1BQ0gsWUFBWSxXQUFXLElBQUksQ0FBQyxVQUFVLE1BQU0sTUFBTSxDQUFDO0FBQUEsSUFDckQ7QUFBQTtBQUFBLEVBR0YsSUFBSSxDQUFDLFNBQVMsR0FBVztBQUN2QixVQUFNLGtCQUFrQixLQUFLLFFBQVEsS0FBSyxTQUFTLFNBQVM7QUFDNUQsVUFBTSxXQUFXLEtBQUssV0FBVyxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssZUFBZSxDQUFDLEVBQUUsS0FBSyxJQUFJO0FBQ3BGLFFBQUksS0FBSyxRQUFRLElBQUk7QUFDbkIsYUFBTztBQUFBLElBQ1Q7QUFDQSxRQUFJLGFBQWE7QUFDakIsZ0JBQVksS0FBSyxVQUFVLE9BQU8sUUFBUSxLQUFLLFVBQVUsR0FBRztBQUMxRCxvQkFBYztBQUNkLG9CQUFjLEdBQUcsUUFBUTtBQUFBLElBQzNCO0FBQ0EsVUFBTSxjQUFjLElBQUksT0FBTyxNQUFNO0FBQ3JDLFdBQU8sR0FBRyxlQUFlLEtBQUssTUFBTSxnQkFBZ0IsYUFBYSxnQkFBZ0IsS0FBSztBQUFBO0FBRTFGO0FBVUEsSUFBTSxXQUFXO0FBQUEsRUFDZjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjtBQUNBLElBQU0saUJBQWlCO0FBQUEsRUFDckI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjtBQUVBLElBQU0seUJBQXlCO0FBQUEsRUFDN0IsR0FBRztBQUFBLEVBQ0g7QUFDRjtBQUVPLElBQU0sUUFBUSxDQUFDLFVBQWtCO0FBQ3RDLFFBQU0sT0FBTyxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsU0FBUztBQUN2QyxNQUFJLE9BQU87QUFDWCxRQUFNLFNBQVMsQ0FBQyxHQUFHLFdBQVUsS0FBSyxDQUFDO0FBQ25DLFdBQVMsSUFBSSxFQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDdEMsVUFBTSxRQUFRLE9BQU87QUFDckIsWUFBUSxNQUFNO0FBQUEsV0FDUCxpQkFBbUI7QUFFdEI7QUFBQSxNQUNGO0FBQUEsV0FDSyxhQUFlO0FBQ2xCLFlBQUksTUFBTSxTQUFTO0FBRWpCLGNBQUksVUFBVTtBQUNkLGlCQUFPLFNBQVM7QUFDZCxnQkFBSSxNQUFNLFNBQVMsUUFBUSxLQUFLO0FBQzlCLHNCQUFRLE9BQU8sUUFBUSxRQUFRLDZCQUE2QjtBQUM1RCxxQkFBTyxRQUFRO0FBQ2Y7QUFBQSxZQUNGO0FBQ0Esc0JBQVUsUUFBUTtBQUFBLFVBQ3BCO0FBQ0EsY0FBSSxXQUFXLE1BQU07QUFDbkIsb0JBQVEsTUFBTSxlQUFlLE1BQU0sTUFBTTtBQUFBLFVBQzNDO0FBQUEsUUFDRixPQUFPO0FBQ0wsY0FBSSx1QkFBdUIsU0FBUyxNQUFNLElBQUksR0FBRztBQUUvQyxnQkFBSSxVQUFVO0FBQ2QsbUJBQU8sU0FBUztBQUNkLGtCQUFJLGVBQWUsU0FBUyxRQUFRLEdBQUcsR0FBRztBQUN4Qyx1QkFBTyxRQUFRO0FBQ2Y7QUFBQSxjQUNGO0FBQ0Esd0JBQVUsUUFBUTtBQUFBLFlBQ3BCO0FBQUEsVUFDRjtBQUNBLGdCQUFNLFVBQVUsSUFBSSxLQUNsQixNQUFNLE1BQ04sT0FBTyxZQUFZLE1BQU0sVUFBVSxHQUNuQyxJQUNGO0FBQ0EsZUFBSyxXQUFXLEtBQUssT0FBTztBQUM1QixjQUFJLFNBQVMsU0FBUyxNQUFNLElBQUksR0FBRztBQUFBLFVBQ25DLE9BQU87QUFDTCxtQkFBTztBQUFBO0FBQUE7QUFHWDtBQUFBLE1BQ0Y7QUFBQSxXQUNLLG1CQUFxQjtBQUN4QixjQUFNLFdBQVcsSUFBSSxTQUFTLEVBQUU7QUFDaEMsZUFBTyxJQUFJLE9BQU8sVUFBVSxPQUFPLEdBQUcsU0FBUyxtQkFBcUI7QUFDbEUsbUJBQVMsUUFBUyxPQUFPLEdBQXNCO0FBQy9DLGVBQUs7QUFBQSxRQUNQO0FBQ0EsYUFBSyxXQUFXLEtBQUssUUFBUTtBQUM3QixhQUFLO0FBQUEsTUFDUDtBQUFBO0FBQUEsRUFFSjtBQUNBLFNBQU87QUFBQTtBQUVULE9BQU8sUUFBUTs7O0FDeGRSLElBQU0sU0FBUyxDQUFDLFFBQTJCLFNBQWU7QUFDL0QsUUFBTSxNQUFNLE9BQU8sV0FBVyxJQUFJO0FBQ2xDLE1BQUksYUFBdUIsQ0FBQyxDQUFDO0FBQzdCLE1BQUksWUFBWTtBQUFBOzs7QUMvRmxCLGVBQWUsU0FBUyxDQUFDLEtBQWE7QUFFcEMsUUFBTSxVQUFVLEdBQUcsY0FBYztBQUNqQyxRQUFNLE9BQU8sTUFBTSxNQUFNLE9BQU87QUFDaEMsUUFBTSxPQUFPLE1BQU0sS0FBSyxLQUFLO0FBRTdCLFNBQU87QUFBQTtBQVFULGVBQWUsSUFBSSxHQUFHO0FBQ3BCLFFBQU0sU0FBUyxTQUFTLGVBQWUsUUFBUTtBQUMvQyxRQUFNLGNBQWMsU0FBUyxlQUFlLFdBQVc7QUFDdkQsUUFBTSxhQUFhLFNBQVMsZUFBZSxhQUFhO0FBQ3hELE1BQUk7QUFDSixNQUFJO0FBRUosaUJBQWUsR0FBRyxHQUFHO0FBQ25CLFdBQU8sTUFBTSxVQUFVLFdBQVcsS0FBSztBQUN2QyxXQUFPLE1BQU0sSUFBSTtBQUNqQixnQkFBWSxjQUFjLEtBQUssS0FBSztBQUVwQyxXQUFPLFFBQVEsS0FBSyxxQkFBcUIsTUFBTTtBQUMvQyxXQUFPLFFBQVEsSUFBSTtBQUFBO0FBR3JCLGFBQVcsaUJBQWlCLFVBQVUsR0FBRztBQUN6QyxNQUFJO0FBQUE7QUFqQ04sSUFBTSxhQUFhO0FBb0NuQixJQUFJLFNBQVMsZUFBZSxXQUFXO0FBQ3JDLFdBQVMsaUJBQWlCLG9CQUFvQixJQUFJO0FBQ3BELE9BQU87QUFDTCxPQUFLO0FBQUE7IiwKICAiZGVidWdJZCI6ICI5QzQ5MEM1ODYyN0ZCOTgzNjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
