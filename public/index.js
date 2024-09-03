// src/html/tokenizer.ts
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
          if (char === "-" && s.peek(3) === "-->") {
            s.skip(3);
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
var NULL = String.fromCharCode(0);
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
    const token = this.input[this.index];
    this.index += 1;
    return token;
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
}

class Node {
  tag;
  attributes;
  parent;
  children = [];
  constructor(tag, attributes = {}, parent) {
    this.tag = tag;
    this.attributes = attributes;
    this.parent = parent;
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
          node.children.push(newNode);
          if (voidTags.includes(token.name)) {
          } else {
            node = newNode;
          }
        }
        break;
      }
      case 0 /* character */: {
        const textnode = new TextNode("");
        while (tokens[i].type === 0 /* character */) {
          textnode.text += tokens[i].character;
          i += 1;
        }
        node.children.push(textnode);
        i -= 1;
      }
    }
  }
  return root;
};
window.parse = parse;

// src/index.ts
function main() {
  document.getElementById("inputhtml").textContent = defaultHtml;
}
var defaultHtml = `<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" type="text/css" href="styles.css">
</head>
<body>
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
</html>`;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

//# debugId=E62A766B8BDD235964756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwvdG9rZW5pemVyLnRzIiwgIi4uL3NyYy9pbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJjb25zdCBOVUxMID0gU3RyaW5nLmZyb21DaGFyQ29kZSgwKTtcblxuY29uc3QgaXNDaGFyYWN0ZXJTcGFjZSA9IChzdHJpbmc6IHN0cmluZykgPT4ge1xuICByZXR1cm4gc3RyaW5nID09PSBcIiBcIiB8fCBzdHJpbmcgPT0gXCJcXG5cIiB8fCBzdHJpbmcgPT09IFwiXFx0XCI7XG59O1xuXG5jb25zdCBpc0NoYXJhY3RlckFscGhhID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNoYXJDb2RlID0gc3RyaW5nLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IGEgPSBcImFcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCB6ID0gXCJ6XCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgQSA9IFwiQVwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IFogPSBcIlpcIi5jaGFyQ29kZUF0KDApO1xuXG4gIHJldHVybiAoY2hhckNvZGUgPj0gYSAmJiBjaGFyQ29kZSA8PSB6KSB8fCAoY2hhckNvZGUgPj0gQSAmJiBjaGFyQ29kZSA8PSBaKTtcbn07XG5cbmVudW0gVG9rZW5FbnVtIHtcbiAgY2hhcmFjdGVyLFxuICB0YWcsXG4gIGRvY3R5cGUsXG59XG5cbmVudW0gU3RhdGUge1xuICBkYXRhLFxuICB0YWdPcGVuLFxuICBlbmRUYWdPcGVuLFxuICB0YWdOYW1lLFxuICBiZWZvcmVBdHRyaWJ1dGVOYW1lLFxuICBhdHRyaWJ1dGVOYW1lLFxuICBhZnRlckF0dHJpYnV0ZU5hbWUsXG4gIGJlZm9yZUF0dHJpYnV0ZVZhbHVlLFxuICBhdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlZCxcbiAgYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQsXG4gIGF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQsXG4gIGFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQsXG4gIHNlbGZDbG9zaW5nU3RhcnRUYWcsXG4gIGJvZ3VzQ29tbWVudCxcbiAgbWFya3VwRGVjbGFyYXRpb25PcGVuLFxuICBjb21tZW50LFxuICBkb2N0eXBlLFxuICBiZWZvcmVEb2N0eXBlTmFtZSxcbiAgZG9jdHlwZU5hbWUsXG4gIGFmdGVyRG9jdHlwZU5hbWUsXG59XG5cbmludGVyZmFjZSBDaGFyYWN0ZXJUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS5jaGFyYWN0ZXI7XG4gIGNoYXJhY3Rlcjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgQ29tbWVudFRva2VuIHtcbiAgdHlwZTogVG9rZW5FbnVtLmNvbW1lbnQ7XG4gIGNvbW1lbnQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFRhZ1Rva2VuIHtcbiAgdHlwZTogVG9rZW5FbnVtLnRhZztcbiAgbmFtZTogc3RyaW5nO1xuICBjbG9zaW5nOiBib29sZWFuO1xuICBhdHRyaWJ1dGVzOiBbc3RyaW5nLCBzdHJpbmddW107XG4gIHNlbGZDbG9zaW5nOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgRG9jdHlwZVRva2VuIHtcbiAgdHlwZTogVG9rZW5FbnVtLmRvY3R5cGU7XG4gIGRvY3R5cGU6IHN0cmluZztcbn1cblxudHlwZSBUb2tlbiA9IENoYXJhY3RlclRva2VuIHwgQ29tbWVudFRva2VuIHwgVGFnVG9rZW47XG5cbmNsYXNzIFRva2VuaXplckNvbnRleHQge1xuICBzdGF0ZTogU3RhdGUgPSBTdGF0ZS5kYXRhO1xuXG4gIHJldHVyblN0YXRlOiBTdGF0ZVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIGlucHV0OiBzdHJpbmcsXG4gICAgcHVibGljIGluZGV4OiBudW1iZXIsXG4gICkge31cblxuICBnZXRDdXJyZW50SW5wdXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXRbdGhpcy5pbmRleF07XG4gIH1cblxuICBwZWVrKGxlbmd0aDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5wdXQuc2xpY2UodGhpcy5pbmRleCwgdGhpcy5pbmRleCArIGxlbmd0aCk7XG4gIH1cblxuICBza2lwKGxlbmd0aDogbnVtYmVyKSB7XG4gICAgdGhpcy5pbmRleCArPSBsZW5ndGg7XG4gIH1cblxuICBjb25zdW1lKCkge1xuICAgIGNvbnN0IHRva2VuID0gdGhpcy5pbnB1dFt0aGlzLmluZGV4XTtcbiAgICB0aGlzLmluZGV4ICs9IDE7XG4gICAgcmV0dXJuIHRva2VuO1xuICB9XG5cbiAgZW9mKCkge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMuaW5wdXQubGVuZ3RoO1xuICB9XG5cbiAgcmVjb25zdW1lKCkge1xuICAgIHRoaXMuaW5kZXggLT0gMTtcbiAgfVxuXG4gIHNldFN0YXRlKHN0YXRlOiBTdGF0ZSwgcmV0dXJuU3RhdGU/OiBTdGF0ZSkge1xuICAgIGlmIChyZXR1cm5TdGF0ZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnJldHVyblN0YXRlLnB1c2gocmV0dXJuU3RhdGUpO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gIH1cblxuICBwb3BSZXR1cm5TdGF0ZSgpIHtcbiAgICB0aGlzLnN0YXRlID0gdGhpcy5yZXR1cm5TdGF0ZS5wb3AoKSE7XG4gIH1cblxuICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgd2hpbGUgKCF0aGlzLmVvZigpKSB7XG4gICAgICB5aWVsZCB0aGlzLmNvbnN1bWUoKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gZ2VuZXJhdGluZ1xuXG5jb25zdCBnZW5lcmF0ZUNoYXJhY3RlclRva2VuID0gKGNoYXJhY3Rlcjogc3RyaW5nKTogQ2hhcmFjdGVyVG9rZW4gPT4ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFRva2VuRW51bS5jaGFyYWN0ZXIsXG4gICAgY2hhcmFjdGVyLFxuICB9O1xufTtcblxuY29uc3QgZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuID0gKGNsb3Npbmc6IGJvb2xlYW4pOiBUYWdUb2tlbiA9PiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogVG9rZW5FbnVtLnRhZyxcbiAgICBuYW1lOiBcIlwiLFxuICAgIGNsb3NpbmcsXG4gICAgYXR0cmlidXRlczogW10sXG4gICAgc2VsZkNsb3Npbmc6IGZhbHNlLFxuICB9O1xufTtcblxuY29uc3QgZ2VuZXJhdGVEb2N0eXBlVG9rZW4gPSAoKTogRG9jdHlwZVRva2VuID0+IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBUb2tlbkVudW0uZG9jdHlwZSxcbiAgICBkb2N0eXBlOiBcIlwiLFxuICB9O1xufTtcblxuLy8gdG9rZW5pemVyaW5nXG5cbmZ1bmN0aW9uKiB0b2tlbml6ZXIoaW5wdXQ6IHN0cmluZykge1xuICBjb25zdCBzID0gbmV3IFRva2VuaXplckNvbnRleHQoaW5wdXQsIDApO1xuXG4gIGxldCB0YWdUb2tlbjogVGFnVG9rZW4gPSBnZW5lcmF0ZUVtcHR5VGFnVG9rZW4oZmFsc2UpO1xuICBsZXQgYXR0cmlidXRlOiBbc3RyaW5nLCBzdHJpbmddID0gW1wiXCIsIFwiXCJdO1xuICBsZXQgZG9jdHlwZVRva2VuOiBEb2N0eXBlVG9rZW4gPSBnZW5lcmF0ZURvY3R5cGVUb2tlbigpO1xuXG4gIHdoaWxlICghcy5lb2YoKSkge1xuICAgIGNvbnN0IHN0YXRlID0gcy5zdGF0ZTtcbiAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICBjYXNlIFN0YXRlLmRhdGE6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gXCI8XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUudGFnT3Blbik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiP1wiKSB7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5ib2d1c0NvbW1lbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHlpZWxkIGdlbmVyYXRlQ2hhcmFjdGVyVG9rZW4oY2hhcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS50YWdPcGVuOiB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGNoYXIgPT09IFwiIVwiKSB7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5tYXJrdXBEZWNsYXJhdGlvbk9wZW4pO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5lbmRUYWdPcGVuKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0NoYXJhY3RlckFscGhhKGNoYXIpKSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICB0YWdUb2tlbiA9IGdlbmVyYXRlRW1wdHlUYWdUb2tlbihmYWxzZSk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS50YWdOYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmVuZFRhZ09wZW46IHtcbiAgICAgICAgLy8gd2UgZG9uJ3QgcmVhbGx5IGNhcmUgYWJvdXQgZXJyb3IgaGFuZGxpbmcgdGJoLi4uXG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGlzQ2hhcmFjdGVyQWxwaGEoY2hhcikpIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHRhZ1Rva2VuID0gZ2VuZXJhdGVFbXB0eVRhZ1Rva2VuKHRydWUpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUudGFnTmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJvZ3VzQ29tbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLnRhZ05hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIpIHtcbiAgICAgICAgICAgIHRhZ1Rva2VuLnNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuc2VsZkNsb3NpbmdTdGFydFRhZyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFnVG9rZW4ubmFtZSArPSBjaGFyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIgfHwgY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICAvLyBUT0RPXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZSA9IFtcIlwiLCBcIlwiXTtcbiAgICAgICAgICAgIHRhZ1Rva2VuLmF0dHJpYnV0ZXMucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSB8fCBjaGFyID09PSBcIi9cIiB8fCBjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI9XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZVswXSArPSBjaGFyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5zZWxmQ2xvc2luZ1N0YXJ0VGFnKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI9XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlVmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZSA9IFtcIlwiLCBcIlwiXTtcbiAgICAgICAgICAgIHRhZ1Rva2VuLmF0dHJpYnV0ZXMucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhcmFjdGVyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZVZhbHVlRG91YmxlUXVvdGVkKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIidcIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlVmFsdWVVbnF1b3RlZCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZVZhbHVlRG91YmxlUXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVWYWx1ZVF1b3RlZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlWzFdICs9IGNoYXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVNpbmdsZVF1b3RlZDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSBcIidcIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuc2VsZkNsb3NpbmdTdGFydFRhZyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWc6IHtcbiAgICAgICAgY29uc3QgY2hhciA9IHMuY29uc3VtZSgpO1xuICAgICAgICBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICB0YWdUb2tlbi5zZWxmQ2xvc2luZyA9IHRydWU7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5ib2d1c0NvbW1lbnQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLm1hcmt1cERlY2xhcmF0aW9uT3Blbjoge1xuICAgICAgICBjb25zdCBkb2N0eXBlID0gXCJkb2N0eXBlXCI7XG4gICAgICAgIGlmIChzLnBlZWsoZG9jdHlwZS5sZW5ndGgpLnRvTG93ZXJDYXNlKCkgPT09IGRvY3R5cGUpIHtcbiAgICAgICAgICBzLnNraXAoZG9jdHlwZS5sZW5ndGgpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZG9jdHlwZSk7XG4gICAgICAgIH0gZWxzZSBpZiAocy5wZWVrKDIpID09PSBcIi0tXCIpIHtcbiAgICAgICAgICBzLnNraXAoMik7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5jb21tZW50KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuY29tbWVudDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSBcIi1cIiAmJiBzLnBlZWsoMykgPT09IFwiLS0+XCIpIHtcbiAgICAgICAgICAgIHMuc2tpcCgzKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmRvY3R5cGU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVEb2N0eXBlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlRG9jdHlwZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5iZWZvcmVEb2N0eXBlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJhY3RlclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIGRvY3R5cGVUb2tlbiA9IGdlbmVyYXRlRG9jdHlwZVRva2VuKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuZG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyYWN0ZXJTcGFjZShjaGFyKSkge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckRvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIGRvY3R5cGVUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdHlwZVRva2VuLmRvY3R5cGUgKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYWZ0ZXJEb2N0eXBlTmFtZToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChpc0NoYXJhY3RlclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgeWllbGQgZG9jdHlwZVRva2VuO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICBjb25zdCBfdjogbmV2ZXIgPSBzdGF0ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxud2luZG93LnRva2VuaXplciA9IHRva2VuaXplcjtcblxuY2xhc3MgVGV4dE5vZGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdGV4dDogc3RyaW5nKSB7fVxufVxuXG5jbGFzcyBOb2RlIHtcbiAgY2hpbGRyZW46IChOb2RlIHwgVGV4dE5vZGUpW10gPSBbXTtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyB0YWc6IHN0cmluZyxcbiAgICBwdWJsaWMgYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9LFxuICAgIHB1YmxpYyBwYXJlbnQ6IE5vZGUgfCB1bmRlZmluZWQsXG4gICkge31cbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGlucHV0OiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgcm9vdCA9IG5ldyBOb2RlKFwiXCIsIHt9LCB1bmRlZmluZWQpO1xuICBsZXQgbm9kZSA9IHJvb3Q7XG4gIGNvbnN0IHRva2VucyA9IFsuLi50b2tlbml6ZXIoaW5wdXQpXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgIGNhc2UgVG9rZW5FbnVtLmRvY3R5cGU6IHtcbiAgICAgICAgLy8gbG9sIGRvbid0IGNhcmUgcmVuZGVyaW5nIGF0IGh0bWw1IG5vIG1hdHRlciB3aGF0XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBUb2tlbkVudW0udGFnOiB7XG4gICAgICAgIGlmICh0b2tlbi5jbG9zaW5nKSB7XG4gICAgICAgICAgaWYgKHRva2VuLm5hbWUgPT09IG5vZGUudGFnKSB7XG4gICAgICAgICAgICBjb25zb2xlLmFzc2VydChub2RlLnBhcmVudCwgXCJjbG9zZWQgMSB0b28gbWFueSBub2RlcyBsb2xcIik7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wYXJlbnQhO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcImF0dGVtcHRlZCB0byBjbG9zZSBcIixcbiAgICAgICAgICAgICAgdG9rZW4ubmFtZSxcbiAgICAgICAgICAgICAgXCIgd2l0aCBhIFwiLFxuICAgICAgICAgICAgICBub2RlLnRhZyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHZvaWRUYWdzID0gW1xuICAgICAgICAgICAgJ2FyZWEnLFxuICAgICAgICAgICAgJ2Jhc2UnLFxuICAgICAgICAgICAgJ2JyJyxcbiAgICAgICAgICAgICdjb2wnLFxuICAgICAgICAgICAgJ2VtYmVkJyxcbiAgICAgICAgICAgICdocicsXG4gICAgICAgICAgICAnaW1nJyxcbiAgICAgICAgICAgICdpbnB1dCcsXG4gICAgICAgICAgICAnbGluaycsXG4gICAgICAgICAgICAnbWV0YScsXG4gICAgICAgICAgICAncGFyYW0nLFxuICAgICAgICAgICAgJ3NvdXJjZScsXG4gICAgICAgICAgICAndHJhY2snLFxuICAgICAgICAgICAgJ3dicidcbiAgICAgICAgICBdXG4gICAgICAgICAgY29uc3QgbmV3Tm9kZSA9IG5ldyBOb2RlKFxuICAgICAgICAgICAgICB0b2tlbi5uYW1lLFxuICAgICAgICAgICAgICBPYmplY3QuZnJvbUVudHJpZXModG9rZW4uYXR0cmlidXRlcyksXG4gICAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBub2RlLmNoaWxkcmVuLnB1c2gobmV3Tm9kZSk7XG4gICAgICAgICAgaWYgKHZvaWRUYWdzLmluY2x1ZGVzKHRva2VuLm5hbWUpKSB7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUgPSBuZXdOb2RlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgVG9rZW5FbnVtLmNoYXJhY3Rlcjoge1xuICAgICAgICBjb25zdCB0ZXh0bm9kZSA9IG5ldyBUZXh0Tm9kZShcIlwiKTtcbiAgICAgICAgd2hpbGUgKHRva2Vuc1tpXS50eXBlID09PSBUb2tlbkVudW0uY2hhcmFjdGVyKSB7XG4gICAgICAgICAgdGV4dG5vZGUudGV4dCArPSAodG9rZW5zW2ldIGFzIENoYXJhY3RlclRva2VuKS5jaGFyYWN0ZXI7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUuY2hpbGRyZW4ucHVzaCh0ZXh0bm9kZSk7XG4gICAgICAgIGkgLT0gMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJvb3Q7XG59O1xud2luZG93LnBhcnNlID0gcGFyc2U7XG4iLAogICAgImltcG9ydCBcIi4vaHRtbC90b2tlbml6ZXJcIlxuXG5jb25zdCBkZWZhdWx0SHRtbCA9IGA8IURPQ1RZUEUgaHRtbD5cbjxodG1sPlxuPGhlYWQ+XG4gICAgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIHR5cGU9XCJ0ZXh0L2Nzc1wiIGhyZWY9XCJzdHlsZXMuY3NzXCI+XG48L2hlYWQ+XG48Ym9keT5cbiAgICA8aDEgaWQ9XCJtYWluLWhlYWRpbmdcIj5XZWxjb21lIHRvIE15IFdlYnNpdGU8L2gxPlxuICAgIDxwIGNsYXNzPVwicGFyYWdyYXBoXCI+VGhpcyBpcyBhIHBhcmFncmFwaC48L3A+XG4gICAgPHN0eWxlPlxuICAgICAgYm9keSB7XG4gICAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2YwZjBmMDtcbiAgICAgIH1cblxuICAgICAgI21haW4taGVhZGluZyB7XG4gICAgICAgICAgY29sb3I6ICMzMzM7XG4gICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgfVxuXG4gICAgICAucGFyYWdyYXBoIHtcbiAgICAgICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICAgICAgZm9udC1mYW1pbHk6IEFyaWFsLCBzYW5zLXNlcmlmO1xuICAgICAgICAgIG1hcmdpbjogMCBhdXRvO1xuICAgICAgICAgIHdpZHRoOiA1MCU7XG4gICAgICB9XG4gICAgPC9zdHlsZT5cbjwvYm9keT5cbjwvaHRtbD5gO1xuXG5mdW5jdGlvbiBtYWluKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXRodG1sJykhLnRleHRDb250ZW50ID0gZGVmYXVsdEh0bWxcbn1cblxuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIG1haW4pO1xufSBlbHNlIHtcbiAgbWFpbigpO1xufVxuXG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBd0pBLFVBQVUsU0FBUyxDQUFDLE9BQWU7QUFDakMsUUFBTSxJQUFJLElBQUksaUJBQWlCLE9BQU8sQ0FBQztBQUV2QyxNQUFJLFdBQXFCLHNCQUFzQixLQUFLO0FBQ3BELE1BQUksWUFBOEIsQ0FBQyxJQUFJLEVBQUU7QUFDekMsTUFBSSxlQUE2QixxQkFBcUI7QUFFdEQsVUFBUSxFQUFFLElBQUksR0FBRztBQUNmLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFlBQVE7QUFBQSxXQUNELGNBQVk7QUFDZixtQkFBVyxRQUFRLEdBQUc7QUFDcEIsY0FBSSxTQUFTLEtBQUs7QUFDaEIsY0FBRSxTQUFTLGVBQWE7QUFDeEI7QUFBQSxVQUNGLFdBQVcsU0FBUyxLQUFLO0FBQ3ZCLGNBQUUsVUFBVTtBQUNaLGNBQUUsU0FBUyxxQkFBa0I7QUFDN0I7QUFBQSxVQUNGLE9BQU87QUFDTCxrQkFBTSx1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UUFBUSxPQUFPO0FBQ3JCLFlBQVEsTUFBTTtBQUFBLFdBQ1AsaUJBQW1CO0FBRXRCO0FBQUEsTUFDRjtBQUFBLFdBQ0ssYUFBZTtBQUNsQixZQUFJLE1BQU0sU0FBUztBQUNqQixjQUFJLE1BQU0sU0FBUyxLQUFLLEtBQUs7QUFDM0Isb0JBQVEsT0FBTyxLQUFLLFFBQVEsNkJBQTZCO0FBQ3pELG1CQUFPLEtBQUs7QUFBQSxVQUNkLE9BQU87QUFDTCxvQkFBUSxNQUNOLHVCQUNBLE1BQU0sTUFDTixZQUNBLEtBQUssR0FDUDtBQUFBO0FBQUEsUUFFSixPQUFPO0FBQ0wsZ0JBQU0sV0FBVztBQUFBLFlBQ2Y7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsVUFDRjtBQUNBLGdCQUFNLFVBQVUsSUFBSSxLQUNoQixNQUFNLE1BQ04sT0FBTyxZQUFZLE1BQU0sVUFBVSxHQUNuQyxJQUNGO0FBQ0EsZUFBSyxTQUFTLEtBQUssT0FBTztBQUM1QixjQUFJLFNBQVMsU0FBUyxNQUFNLElBQUksR0FBRztBQUFBLFVBQ25DLE9BQU87QUFDTCxtQkFBTztBQUFBO0FBQUE7QUFHWDtBQUFBLE1BQ0Y7QUFBQSxXQUNLLG1CQUFxQjtBQUN4QixjQUFNLFdBQVcsSUFBSSxTQUFTLEVBQUU7QUFDaEMsZUFBTyxPQUFPLEdBQUcsU0FBUyxtQkFBcUI7QUFDN0MsbUJBQVMsUUFBUyxPQUFPLEdBQXNCO0FBQy9DLGVBQUs7QUFBQSxRQUNQO0FBQ0EsYUFBSyxTQUFTLEtBQUssUUFBUTtBQUMzQixhQUFLO0FBQUEsTUFDUDtBQUFBO0FBQUEsRUFFSjtBQUNBLFNBQU87QUFBQTtBQUVULE9BQU8sUUFBUTs7O0FDcGdCZixTQUFTLElBQUksR0FBRztBQUNkLFdBQVMsZUFBZSxXQUFXLEVBQUcsY0FBYztBQUFBO0FBN0J0RCxJQUFNLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBZ0NwQixJQUFJLFNBQVMsZUFBZSxXQUFXO0FBQ3JDLFdBQVMsaUJBQWlCLG9CQUFvQixJQUFJO0FBQ3BELE9BQU87QUFDTCxPQUFLO0FBQUE7IiwKICAiZGVidWdJZCI6ICJFNjJBNzY2QjhCREQyMzU5NjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
