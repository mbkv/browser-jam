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

class TextNode {
  parent;
  text;
  constructor(parent, text) {
    this.parent = parent;
    this.text = text;
  }
  get textContext() {
    return this.text.replace(/\s+/g, " ");
  }
  hasParent(node) {
    return this.parent.hasParent(node);
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
  hasParent(node) {
    let current = this;
    while (current) {
      if (node === current) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
  *visit() {
    for (let i = 0;i < this.childNodes.length; i++) {
      const node = this.childNodes[i];
      yield node;
      if (node instanceof Node) {
        for (const subnode of node.visit()) {
          yield subnode;
        }
      }
    }
  }
  *getElementsByTagname(tagname) {
    for (const node of this.visit()) {
      if (node instanceof Node && node.tag === tagname) {
        yield node;
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
var generateImpliedEndTags = [...impliedEndTags, "dl"];
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
        const textnode = new TextNode(node, "");
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

// src/renderer.ts
function generateBlocks(body) {
  let block = {
    block: body,
    style: getStylesForTag(body.tag),
    elements: []
  };
  const blocks = [block];
  const stack = [{ node: body, ctx: {} }];
  while (stack.length) {
    const { node, ctx } = stack.pop();
    if (!node.hasParent(block.block)) {
      block = {
        block: node.parent,
        style: getStylesForTag(node.parent.tag),
        elements: []
      };
      blocks.push(block);
    }
    if (node instanceof Node) {
      const styles = getStylesForTag(node.tag);
      if (styles.display === "block") {
        block = { block: node, style: styles, elements: [] };
        blocks.push(block);
      } else if (styles.display === "none") {
        continue;
      }
      const newCtx = {
        ...ctx
      };
      if ("font-size" in styles) {
        newCtx.size = styles["font-size"];
      }
      if ("color" in styles) {
        newCtx.color = styles.color;
      }
      if ("text-decoration" in styles) {
        newCtx.underline = styles["text-decoration"].includes("underline");
      }
      if ("font-weight" in styles) {
        newCtx.weight = styles["font-weight"];
      }
      for (let i = node.childNodes.length - 1;i >= 0; i--) {
        stack.push({ node: node.childNodes[i], ctx: newCtx });
      }
    } else {
      block.elements.push({
        parent: node.parent,
        text: node.textContext,
        ...ctx
      });
    }
  }
  for (let i = 0;i < blocks.length; i++) {
    const block2 = blocks[i];
    let shouldRemoveLeading = true;
    for (let i2 = 0;i2 < block2.elements.length; i2++) {
      const element = block2.elements[i2];
      if (shouldRemoveLeading) {
        element.text = element.text.replace(/^\s+/, "");
      }
      if (element.text.length === 0) {
      } else if (isCharSpace(element.text[element.text.length - 1])) {
        shouldRemoveLeading = true;
      } else {
        shouldRemoveLeading = false;
      }
    }
    for (let i2 = block2.elements.length - 1;i2 >= 0; i2--) {
      const element = block2.elements[i2];
      element.text = element.text.replace(/\s+$/, "");
      if (element.text.length) {
        break;
      }
    }
  }
  for (let i = 0;i < blocks.length; i++) {
    const block2 = blocks[i];
    block2.elements = block2.elements.filter((element) => element.text);
    if (block2.elements.length === 0) {
      blocks.splice(i, 1);
      i--;
    }
  }
  return blocks;
}
var FONT = "Times New Roman";
var defaultStyles = {
  "*": {
    display: "block"
  },
  title: {
    display: "none"
  },
  h1: {
    display: "block",
    "font-size": 32,
    "margin-top": 22,
    "margin-bottom": 22,
    "font-weight": "bold"
  },
  h2: {
    display: "block",
    "font-size": 24,
    "margin-top": 20,
    "margin-bottom": 20,
    "font-weight": "bold"
  },
  a: {
    display: "inline",
    color: "blue",
    "text-decoration": "underline"
  },
  p: {
    display: "block",
    "margin-top": 16,
    "margin-bottom": 16
  },
  dl: {
    display: "block",
    "margin-top": 16,
    "margin-bottom": 16
  },
  dt: { display: "block" },
  dd: {
    display: "block",
    "margin-left": 40
  }
};
var getStylesForTag = (tag) => {
  return defaultStyles[tag] ?? defaultStyles["*"];
};
var drawText = (ctx, elements, width, blockLeft, blockTop) => {
  const ratio = window.devicePixelRatio;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let left = blockLeft;
  let top = blockTop;
  let maxHeight = 0;
  for (let i = 0;i < elements.length; i++) {
    const element = elements[i];
    const size = (element.size ?? 16) * ratio;
    ctx.font = `${element.weight ?? "normal"} ${size}px ${FONT}`;
    ctx.fillStyle = element.color ?? "black";
    ctx.strokeStyle = element.color ?? "black";
    maxHeight = Math.max(maxHeight, size);
    let textLeftToWrite = element.text;
    while (textLeftToWrite) {
      const index = textLeftToWrite.indexOf(" ");
      let text = "";
      if (index < 0) {
        text = textLeftToWrite;
        textLeftToWrite = "";
      } else {
        text = textLeftToWrite.slice(0, index + 1);
        textLeftToWrite = textLeftToWrite.slice(index + 1);
      }
      const measured = ctx.measureText(text);
      if (measured.width + left > width) {
        top += size;
        left = blockLeft;
      }
      ctx.fillText(text, left, top + size * 0.75);
      if (element.underline) {
        ctx.beginPath();
        ctx.moveTo(left, top + size * 0.9);
        ctx.lineTo(left + measured.width, top + size * 0.9);
        ctx.lineWidth = ratio;
        ctx.stroke();
      }
      left += measured.width;
    }
  }
  return top + maxHeight;
};
var render = (canvas, body) => {
  const ctx = canvas.getContext("2d");
  const blocks = generateBlocks(body);
  const width = canvas.width;
  const globalMargin = 8;
  let previousMarginBottom = 8;
  let y = 0;
  for (let i = 0;i < blocks.length; i++) {
    const block = blocks[i];
    const {
      "margin-top": marginTop,
      "margin-bottom": marginBottom,
      "margin-left": marginLeft
    } = block.style;
    const actualMarginTop = Math.max(marginTop ?? 0, previousMarginBottom);
    y += actualMarginTop;
    const actualMarginLeft = globalMargin + (marginLeft ?? 0);
    y = drawText(ctx, block.elements, width, actualMarginLeft, y);
    previousMarginBottom = marginBottom ?? 0;
  }
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
  async function resize() {
    if (canvas.parentElement) {
      const ratio = window.devicePixelRatio;
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = canvas.parentElement.clientWidth * ratio;
      canvas.height = canvas.parentElement.clientHeight * ratio;
    }
  }
  async function run() {
    text = await fetchPage(addressBar.value);
    html = parse(text);
    htmlDisplay.textContent = html.html();
    resize();
    render(canvas, html);
  }
  addressBar.addEventListener("blur", run);
  run();
}
var PROXY_HOST = window.location.href.includes("localhost") ? "http://localhost:8090" : "https://browser.mbkv.io/proxy";
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

//# debugId=516D110B022517CF64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3Rva2VuaXplci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9yZW5kZXJlci50cyIsICIuLi9zcmMvaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IGNvbnN0IGlzQ2hhclNwYWNlID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBzdHJpbmcgPT09IFwiIFwiIHx8IHN0cmluZyA9PSBcIlxcblwiIHx8IHN0cmluZyA9PT0gXCJcXHRcIiB8fCBzdHJpbmcgPT09IFwiXFxmXCI7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyRGlnaXQgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2hhckNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgemVybyA9IFwiMFwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IG5pbmUgPSBcIjlcIi5jaGFyQ29kZUF0KDApO1xuXG4gIHJldHVybiBjaGFyQ29kZSA+PSB6ZXJvICYmIGNoYXJDb2RlIDw9IG5pbmU7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyQWxwaGEgPSAoc3RyaW5nOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2hhckNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgYSA9IFwiYVwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IHogPSBcInpcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBBID0gXCJBXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgWiA9IFwiWlwiLmNoYXJDb2RlQXQoMCk7XG5cbiAgcmV0dXJuIChjaGFyQ29kZSA+PSBhICYmIGNoYXJDb2RlIDw9IHopIHx8IChjaGFyQ29kZSA+PSBBICYmIGNoYXJDb2RlIDw9IFopO1xufTtcblxuZXhwb3J0IGNvbnN0IGlzQ2hhckhleCA9IChzdHJpbmc6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaGFyQ29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBhID0gXCJhXCIuY2hhckNvZGVBdCgwKTtcbiAgY29uc3QgZiA9IFwiZlwiLmNoYXJDb2RlQXQoMCk7XG4gIGNvbnN0IEEgPSBcIkFcIi5jaGFyQ29kZUF0KDApO1xuICBjb25zdCBGID0gXCJGXCIuY2hhckNvZGVBdCgwKTtcblxuICByZXR1cm4gKFxuICAgIGlzQ2hhckRpZ2l0KHN0cmluZykgfHxcbiAgICAoY2hhckNvZGUgPj0gYSAmJiBjaGFyQ29kZSA8PSBmKSB8fFxuICAgIChjaGFyQ29kZSA+PSBBICYmIGNoYXJDb2RlIDw9IEYpXG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgaXNDaGFyQmFzZTY0ID0gKHN0cmluZzogc3RyaW5nKSA9PiB7XG4gIHJldHVybiAoXG4gICAgaXNDaGFyQWxwaGEoc3RyaW5nKSB8fFxuICAgIGlzQ2hhckRpZ2l0KHN0cmluZykgfHxcbiAgICBzdHJpbmdbMF0gPT09IFwiX1wiIHx8XG4gICAgc3RyaW5nWzBdID09PSBcIi1cIlxuICApO1xufTtcblxuZXhwb3J0IGNsYXNzIFRva2VuaXplckNvbnRleHQ8U3RhdGU+IHtcbiAgcmV0dXJuU3RhdGU6IFN0YXRlW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgaW5wdXQ6IHN0cmluZyxcbiAgICBwdWJsaWMgaW5kZXg6IG51bWJlcixcbiAgICBwdWJsaWMgc3RhdGU6IFN0YXRlLFxuICApIHt9XG5cbiAgZ2V0UmVzdCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbnB1dC5zbGljZSh0aGlzLmluZGV4KTtcbiAgfVxuXG4gIHBlZWsobGVuZ3RoOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pbnB1dC5zbGljZSh0aGlzLmluZGV4LCB0aGlzLmluZGV4ICsgbGVuZ3RoKTtcbiAgfVxuXG4gIHN0YXJ0c1dpdGgoc3RyaW5nOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5wZWVrKHN0cmluZy5sZW5ndGgpID09PSBzdHJpbmc7XG4gIH1cblxuICBza2lwKGxlbmd0aCA9IDEpIHtcbiAgICB0aGlzLmluZGV4ICs9IGxlbmd0aDtcbiAgfVxuXG4gIGNvbnN1bWUoKSB7XG4gICAgY29uc3QgY2hhciA9IHRoaXMuaW5wdXRbdGhpcy5pbmRleF07XG4gICAgdGhpcy5pbmRleCArPSAxO1xuICAgIHJldHVybiBjaGFyO1xuICB9XG5cbiAgZW9mKCkge1xuICAgIHJldHVybiB0aGlzLmluZGV4ID49IHRoaXMuaW5wdXQubGVuZ3RoO1xuICB9XG5cbiAgcmVjb25zdW1lKCkge1xuICAgIHRoaXMuaW5kZXggLT0gMTtcbiAgfVxuXG4gIHNldFN0YXRlKHN0YXRlOiBTdGF0ZSwgcmV0dXJuU3RhdGU/OiBTdGF0ZSkge1xuICAgIGlmIChyZXR1cm5TdGF0ZSAhPSBudWxsKSB7XG4gICAgICB0aGlzLnJldHVyblN0YXRlLnB1c2gocmV0dXJuU3RhdGUpO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gIH1cblxuICBwb3BSZXR1cm5TdGF0ZSgpIHtcbiAgICB0aGlzLnN0YXRlID0gdGhpcy5yZXR1cm5TdGF0ZS5wb3AoKSE7XG4gIH1cblxuICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgd2hpbGUgKCF0aGlzLmVvZigpKSB7XG4gICAgICB5aWVsZCB0aGlzLmNvbnN1bWUoKTtcbiAgICB9XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5ldyBUb2tlbml6ZXJDb250ZXh0KHRoaXMuaW5wdXQsIHRoaXMuaW5kZXgsIHRoaXMuc3RhdGUpO1xuICAgIGNsb25lLnJldHVyblN0YXRlID0gdGhpcy5yZXR1cm5TdGF0ZTtcbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICBzZXQoY3R4OiBUb2tlbml6ZXJDb250ZXh0PFN0YXRlPikge1xuICAgIHRoaXMucmV0dXJuU3RhdGUgPSBjdHgucmV0dXJuU3RhdGU7XG4gICAgdGhpcy5pbnB1dCA9IGN0eC5pbnB1dDtcbiAgICB0aGlzLmluZGV4ID0gY3R4LmluZGV4O1xuICAgIHRoaXMuc3RhdGUgPSBjdHguc3RhdGU7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgaXNDaGFyQWxwaGEsIGlzQ2hhclNwYWNlLCBUb2tlbml6ZXJDb250ZXh0IH0gZnJvbSBcIi4vdG9rZW5pemVyXCI7XG5cbmVudW0gVG9rZW5FbnVtIHtcbiAgY2hhcmFjdGVyLFxuICB0YWcsXG4gIGRvY3R5cGUsXG59XG5cbmVudW0gU3RhdGUge1xuICBkYXRhLFxuICB0YWdPcGVuLFxuICBlbmRUYWdPcGVuLFxuICB0YWdOYW1lLFxuICBiZWZvcmVBdHRyaWJ1dGVOYW1lLFxuICBhdHRyaWJ1dGVOYW1lLFxuICBhZnRlckF0dHJpYnV0ZU5hbWUsXG4gIGJlZm9yZUF0dHJpYnV0ZVZhbHVlLFxuICBhdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlZCxcbiAgYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQsXG4gIGF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQsXG4gIGFmdGVyQXR0cmlidXRlVmFsdWVRdW90ZWQsXG4gIHNlbGZDbG9zaW5nU3RhcnRUYWcsXG4gIGJvZ3VzQ29tbWVudCxcbiAgbWFya3VwRGVjbGFyYXRpb25PcGVuLFxuICBjb21tZW50LFxuICBkb2N0eXBlLFxuICBiZWZvcmVEb2N0eXBlTmFtZSxcbiAgZG9jdHlwZU5hbWUsXG4gIGFmdGVyRG9jdHlwZU5hbWUsXG59XG5cbmludGVyZmFjZSBDaGFyYWN0ZXJUb2tlbiB7XG4gIHR5cGU6IFRva2VuRW51bS5jaGFyYWN0ZXI7XG4gIGNoYXJhY3Rlcjogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVGFnVG9rZW4ge1xuICB0eXBlOiBUb2tlbkVudW0udGFnO1xuICBuYW1lOiBzdHJpbmc7XG4gIGNsb3Npbmc6IGJvb2xlYW47XG4gIGF0dHJpYnV0ZXM6IFtzdHJpbmcsIHN0cmluZ11bXTtcbiAgc2VsZkNsb3Npbmc6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBEb2N0eXBlVG9rZW4ge1xuICB0eXBlOiBUb2tlbkVudW0uZG9jdHlwZTtcbiAgZG9jdHlwZTogc3RyaW5nO1xufVxuXG4vLyBnZW5lcmF0aW5nXG5cbmNvbnN0IGdlbmVyYXRlQ2hhcmFjdGVyVG9rZW4gPSAoY2hhcmFjdGVyOiBzdHJpbmcpOiBDaGFyYWN0ZXJUb2tlbiA9PiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogVG9rZW5FbnVtLmNoYXJhY3RlcixcbiAgICBjaGFyYWN0ZXIsXG4gIH07XG59O1xuXG5jb25zdCBnZW5lcmF0ZUVtcHR5VGFnVG9rZW4gPSAoY2xvc2luZzogYm9vbGVhbik6IFRhZ1Rva2VuID0+IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBUb2tlbkVudW0udGFnLFxuICAgIG5hbWU6IFwiXCIsXG4gICAgY2xvc2luZyxcbiAgICBhdHRyaWJ1dGVzOiBbXSxcbiAgICBzZWxmQ2xvc2luZzogZmFsc2UsXG4gIH07XG59O1xuXG5jb25zdCBnZW5lcmF0ZURvY3R5cGVUb2tlbiA9ICgpOiBEb2N0eXBlVG9rZW4gPT4ge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFRva2VuRW51bS5kb2N0eXBlLFxuICAgIGRvY3R5cGU6IFwiXCIsXG4gIH07XG59O1xuXG4vLyB0b2tlbml6ZXJpbmdcblxuZnVuY3Rpb24qIHRva2VuaXplcihpbnB1dDogc3RyaW5nKSB7XG4gIGNvbnN0IHMgPSBuZXcgVG9rZW5pemVyQ29udGV4dChpbnB1dCwgMCwgU3RhdGUuZGF0YSk7XG5cbiAgbGV0IHRhZ1Rva2VuOiBUYWdUb2tlbiA9IGdlbmVyYXRlRW1wdHlUYWdUb2tlbihmYWxzZSk7XG4gIGxldCBhdHRyaWJ1dGU6IFtzdHJpbmcsIHN0cmluZ10gPSBbXCJcIiwgXCJcIl07XG4gIGxldCBkb2N0eXBlVG9rZW46IERvY3R5cGVUb2tlbiA9IGdlbmVyYXRlRG9jdHlwZVRva2VuKCk7XG5cbiAgd2hpbGUgKCFzLmVvZigpKSB7XG4gICAgY29uc3Qgc3RhdGUgPSBzLnN0YXRlO1xuICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuZGF0YToge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSBcIjxcIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS50YWdPcGVuKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI/XCIpIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJvZ3VzQ29tbWVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeWllbGQgZ2VuZXJhdGVDaGFyYWN0ZXJUb2tlbihjaGFyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLnRhZ09wZW46IHtcbiAgICAgICAgY29uc3QgY2hhciA9IHMuY29uc3VtZSgpO1xuICAgICAgICBpZiAoY2hhciA9PT0gXCIhXCIpIHtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLm1hcmt1cERlY2xhcmF0aW9uT3Blbik7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIpIHtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmVuZFRhZ09wZW4pO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQ2hhckFscGhhKGNoYXIpKSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICB0YWdUb2tlbiA9IGdlbmVyYXRlRW1wdHlUYWdUb2tlbihmYWxzZSk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS50YWdOYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmVuZFRhZ09wZW46IHtcbiAgICAgICAgLy8gd2UgZG9uJ3QgcmVhbGx5IGNhcmUgYWJvdXQgZXJyb3IgaGFuZGxpbmcgdGJoLi4uXG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGlzQ2hhckFscGhhKGNoYXIpKSB7XG4gICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICB0YWdUb2tlbiA9IGdlbmVyYXRlRW1wdHlUYWdUb2tlbih0cnVlKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnRhZ05hbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5ib2d1c0NvbW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS50YWdOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIikge1xuICAgICAgICAgICAgdGFnVG9rZW4uc2VsZkNsb3NpbmcgPSB0cnVlO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5zZWxmQ2xvc2luZ1N0YXJ0VGFnKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YWdUb2tlbi5uYW1lICs9IGNoYXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCIvXCIgfHwgY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICAvLyBUT0RPXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZSA9IFtcIlwiLCBcIlwiXTtcbiAgICAgICAgICAgIHRhZ1Rva2VuLmF0dHJpYnV0ZXMucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikgfHwgY2hhciA9PT0gXCIvXCIgfHwgY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmFmdGVyQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMF0gKz0gY2hhci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLnNlbGZDbG9zaW5nU3RhcnRUYWcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIj1cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVWYWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlID0gW1wiXCIsIFwiXCJdO1xuICAgICAgICAgICAgdGFnVG9rZW4uYXR0cmlidXRlcy5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuYmVmb3JlQXR0cmlidXRlVmFsdWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoYXIgPSBzLmNvbnN1bWUoKTtcbiAgICAgICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmF0dHJpYnV0ZVZhbHVlRG91YmxlUXVvdGVkKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIidcIikge1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgeWllbGQgdGFnVG9rZW47XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYXR0cmlidXRlVmFsdWVVbnF1b3RlZCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZVZhbHVlRG91YmxlUXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVWYWx1ZVF1b3RlZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlWzFdICs9IGNoYXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVNpbmdsZVF1b3RlZDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSBcIidcIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVbMV0gKz0gY2hhcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQ6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCB0YWdUb2tlbjtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlWzFdICs9IGNoYXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFyID09PSBcIi9cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5zZWxmQ2xvc2luZ1N0YXJ0VGFnKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhZ1Rva2VuO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuc2VsZkNsb3NpbmdTdGFydFRhZzoge1xuICAgICAgICBjb25zdCBjaGFyID0gcy5jb25zdW1lKCk7XG4gICAgICAgIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgIHRhZ1Rva2VuLnNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVjb25zdW1lKCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVEb2N0eXBlTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmJvZ3VzQ29tbWVudDoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygcykge1xuICAgICAgICAgIGlmIChjaGFyID09PSBcIj5cIikge1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUubWFya3VwRGVjbGFyYXRpb25PcGVuOiB7XG4gICAgICAgIGNvbnN0IGRvY3R5cGUgPSBcImRvY3R5cGVcIjtcbiAgICAgICAgaWYgKHMucGVlayhkb2N0eXBlLmxlbmd0aCkudG9Mb3dlckNhc2UoKSA9PT0gZG9jdHlwZSkge1xuICAgICAgICAgIHMuc2tpcChkb2N0eXBlLmxlbmd0aCk7XG4gICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5kb2N0eXBlKTtcbiAgICAgICAgfSBlbHNlIGlmIChzLnBlZWsoMikgPT09IFwiLS1cIikge1xuICAgICAgICAgIHMuc2tpcCgyKTtcbiAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmNvbW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5jb21tZW50OiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGNoYXIgPT09IFwiLVwiICYmIHMucGVlaygyKSA9PT0gXCItPlwiKSB7XG4gICAgICAgICAgICBzLnNraXAoMik7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBTdGF0ZS5kb2N0eXBlOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzLnJlY29uc3VtZSgpO1xuICAgICAgICAgICAgcy5zZXRTdGF0ZShTdGF0ZS5iZWZvcmVEb2N0eXBlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmJlZm9yZURvY3R5cGVOYW1lOiB7XG4gICAgICAgIGZvciAoY29uc3QgY2hhciBvZiBzKSB7XG4gICAgICAgICAgaWYgKGlzQ2hhclNwYWNlKGNoYXIpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcy5yZWNvbnN1bWUoKTtcbiAgICAgICAgICAgIGRvY3R5cGVUb2tlbiA9IGdlbmVyYXRlRG9jdHlwZVRva2VuKCk7XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRvY3R5cGVOYW1lKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgU3RhdGUuZG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuYWZ0ZXJEb2N0eXBlTmFtZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYXIgPT09IFwiPlwiKSB7XG4gICAgICAgICAgICB5aWVsZCBkb2N0eXBlVG9rZW47XG4gICAgICAgICAgICBzLnNldFN0YXRlKFN0YXRlLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3R5cGVUb2tlbi5kb2N0eXBlICs9IGNoYXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFN0YXRlLmFmdGVyRG9jdHlwZU5hbWU6IHtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHMpIHtcbiAgICAgICAgICBpZiAoaXNDaGFyU3BhY2UoY2hhcikpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gXCI+XCIpIHtcbiAgICAgICAgICAgIHMuc2V0U3RhdGUoU3RhdGUuZGF0YSk7XG4gICAgICAgICAgICB5aWVsZCBkb2N0eXBlVG9rZW47XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBkZWZhdWx0OiB7XG4gICAgICAgIGNvbnN0IF92OiBuZXZlciA9IHN0YXRlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyBlbmQgb2YgY29tcGxpYW5jZSBzdGFydHMgYXJvdW5kIGhlcmUuIEkganVzdCBzdGFydCBzcGl0YmFsbGluZyBoZXJlIHdyaXRpbmdcbi8vIGluIGRpc2d1c3RpbmcgaGFja3NcblxuZXhwb3J0IGNsYXNzIFRleHROb2RlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHBhcmVudDogTm9kZSxcbiAgICBwdWJsaWMgdGV4dDogc3RyaW5nLFxuICApIHt9XG5cbiAgZ2V0IHRleHRDb250ZXh0KCkge1xuICAgIHJldHVybiB0aGlzLnRleHQucmVwbGFjZSgvXFxzKy9nLCBcIiBcIik7XG4gIH1cblxuICBoYXNQYXJlbnQobm9kZTogTm9kZSkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudC5oYXNQYXJlbnQobm9kZSk7XG4gIH1cblxuICBkZWJ1ZygpIHtcbiAgICByZXR1cm4gdGhpcy50ZXh0O1xuICB9XG5cbiAgaHRtbChpbmRlbnQgPSAwKSB7XG4gICAgcmV0dXJuIFwiIFwiLnJlcGVhdChpbmRlbnQpICsgdGhpcy50ZXh0Q29udGV4dDtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSU5vZGUge1xuICB0YWc6IHN0cmluZztcbiAgYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgY2hpbGROb2RlczogKFRleHROb2RlIHwgSU5vZGUpW107XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlIGltcGxlbWVudHMgSU5vZGUge1xuICBjaGlsZE5vZGVzOiAoTm9kZSB8IFRleHROb2RlKVtdID0gW107XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgdGFnOiBzdHJpbmcsXG4gICAgcHVibGljIGF0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSxcbiAgICBwdWJsaWMgcGFyZW50OiBOb2RlIHwgdW5kZWZpbmVkLFxuICApIHt9XG5cbiAgaGFzUGFyZW50KG5vZGU6IE5vZGUpIHtcbiAgICBsZXQgY3VycmVudDogTm9kZSB8IHVuZGVmaW5lZCA9IHRoaXM7XG4gICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgIGlmIChub2RlID09PSBjdXJyZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gICp2aXNpdCgpOiBHZW5lcmF0b3I8Tm9kZSB8IFRleHROb2RlPiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNoaWxkTm9kZXNbaV07XG4gICAgICB5aWVsZCBub2RlO1xuXG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgZm9yIChjb25zdCBzdWJub2RlIG9mIG5vZGUudmlzaXQoKSkge1xuICAgICAgICAgIHlpZWxkIHN1Ym5vZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAqZ2V0RWxlbWVudHNCeVRhZ25hbWUodGFnbmFtZTogc3RyaW5nKTogR2VuZXJhdG9yPE5vZGU+IHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgdGhpcy52aXNpdCgpKSB7XG4gICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIE5vZGUgJiYgbm9kZS50YWcgPT09IHRhZ25hbWUpIHtcbiAgICAgICAgeWllbGQgbm9kZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWJ1ZygpOiBEZWJ1Z05vZGUge1xuICAgIGNvbnN0IHsgcGFyZW50LCBjaGlsZE5vZGVzLCAuLi5yZXN0IH0gPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5yZXN0LFxuICAgICAgY2hpbGROb2RlczogY2hpbGROb2Rlcy5tYXAoKGNoaWxkKSA9PiBjaGlsZC5kZWJ1ZygpKSxcbiAgICB9O1xuICB9XG5cbiAgaHRtbChpbmRlbnQgPSAwKTogc3RyaW5nIHtcbiAgICBjb25zdCBuZXh0TGV2ZWxJbmRlbnQgPSB0aGlzLnRhZyA9PT0gXCJcIiA/IGluZGVudCA6IGluZGVudCArIDI7XG4gICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLmNoaWxkTm9kZXNcbiAgICAgIC5tYXAoKG5vZGUpID0+IG5vZGUuaHRtbChuZXh0TGV2ZWxJbmRlbnQpKVxuICAgICAgLmpvaW4oXCJcXG5cIik7XG4gICAgaWYgKHRoaXMudGFnID09PSBcIlwiKSB7XG4gICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfVxuICAgIGxldCBhdHRyaWJ1dGVzID0gXCJcIjtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmF0dHJpYnV0ZXMpKSB7XG4gICAgICBhdHRyaWJ1dGVzICs9IFwiIFwiO1xuICAgICAgYXR0cmlidXRlcyArPSBgJHtrZXl9PVwiJHt2YWx1ZX1cImA7XG4gICAgfVxuICAgIGNvbnN0IGluZGVudGF0aW9uID0gXCIgXCIucmVwZWF0KGluZGVudCk7XG4gICAgcmV0dXJuIGAke2luZGVudGF0aW9ufTwke3RoaXMudGFnfSR7YXR0cmlidXRlc30+XFxuJHtjaGlsZHJlbn1cXG4ke2luZGVudGF0aW9ufTwvJHt0aGlzLnRhZ30+YDtcbiAgfVxufVxuXG50eXBlIFJlbW92ZU1ldGhvZHM8VD4gPSB7XG4gIFtQIGluIGtleW9mIFQgYXMgVFtQXSBleHRlbmRzIEZ1bmN0aW9uID8gbmV2ZXIgOiBQXTogVFtQXTtcbn07XG5cbnR5cGUgRGVidWdOb2RlID0gUmVtb3ZlTWV0aG9kczxPbWl0PE5vZGUsIFwicGFyZW50XCIgfCBcImNoaWxkTm9kZXNcIj4+ICYge1xuICBjaGlsZE5vZGVzOiAoc3RyaW5nIHwgRGVidWdOb2RlKVtdO1xufTtcblxuY29uc3Qgdm9pZFRhZ3MgPSBbXG4gIFwiYXJlYVwiLFxuICBcImJhc2VcIixcbiAgXCJiclwiLFxuICBcImNvbFwiLFxuICBcImVtYmVkXCIsXG4gIFwiaHJcIixcbiAgXCJpbWdcIixcbiAgXCJpbnB1dFwiLFxuICBcImxpbmtcIixcbiAgXCJtZXRhXCIsXG4gIFwicGFyYW1cIixcbiAgXCJzb3VyY2VcIixcbiAgXCJ0cmFja1wiLFxuICBcIndiclwiLFxuXTtcbmNvbnN0IGltcGxpZWRFbmRUYWdzID0gW1xuICBcImRkXCIsXG4gIFwiZHRcIixcbiAgXCJsaVwiLFxuICBcIm9wdGdyb3VwXCIsXG4gIFwib3B0aW9uXCIsXG4gIFwicFwiLFxuICBcInJiXCIsXG4gIFwicnBcIixcbiAgXCJydFwiLFxuICBcInJ0Y1wiLFxuXTtcblxuY29uc3QgZ2VuZXJhdGVJbXBsaWVkRW5kVGFncyA9IFsuLi5pbXBsaWVkRW5kVGFncywgXCJkbFwiXTtcblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGlucHV0OiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgcm9vdCA9IG5ldyBOb2RlKFwiXCIsIHt9LCB1bmRlZmluZWQpO1xuICBsZXQgbm9kZSA9IHJvb3Q7XG4gIGNvbnN0IHRva2VucyA9IFsuLi50b2tlbml6ZXIoaW5wdXQpXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICBzd2l0Y2ggKHRva2VuLnR5cGUpIHtcbiAgICAgIGNhc2UgVG9rZW5FbnVtLmRvY3R5cGU6IHtcbiAgICAgICAgLy8gbG9sIGRvbid0IGNhcmUgcmVuZGVyaW5nIGF0IGh0bWw1IG5vIG1hdHRlciB3aGF0XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBUb2tlbkVudW0udGFnOiB7XG4gICAgICAgIGlmICh0b2tlbi5jbG9zaW5nKSB7XG4gICAgICAgICAgLy8gbG9vayB1cCBhbmQgc2VlIGlmIHRoZXJlJ3MgYSBub2RlIHdlIGNhbiBjbG9zZVxuICAgICAgICAgIGxldCBjdXJyZW50ID0gbm9kZTtcbiAgICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgaWYgKHRva2VuLm5hbWUgPT09IGN1cnJlbnQudGFnKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuYXNzZXJ0KGN1cnJlbnQucGFyZW50LCBcImNsb3NlZCAxIHRvbyBtYW55IG5vZGVzIGxvbFwiKTtcbiAgICAgICAgICAgICAgbm9kZSA9IGN1cnJlbnQucGFyZW50ITtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQhO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoZ2VuZXJhdGVJbXBsaWVkRW5kVGFncy5pbmNsdWRlcyh0b2tlbi5uYW1lKSkge1xuICAgICAgICAgICAgLy8gZ290dGEgY2hlY2sgYW5kIHNlZSBpZiB3ZSBuZWVkIHRvIGNsb3NlIGFueXRoaW5nIGluIHRoZSB0cmVlXG4gICAgICAgICAgICBsZXQgY3VycmVudCA9IG5vZGU7XG4gICAgICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgICBpZiAoaW1wbGllZEVuZFRhZ3MuaW5jbHVkZXMoY3VycmVudC50YWcpKSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IGN1cnJlbnQucGFyZW50ITtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBuZXdOb2RlID0gbmV3IE5vZGUoXG4gICAgICAgICAgICB0b2tlbi5uYW1lLFxuICAgICAgICAgICAgT2JqZWN0LmZyb21FbnRyaWVzKHRva2VuLmF0dHJpYnV0ZXMpLFxuICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICApO1xuICAgICAgICAgIG5vZGUuY2hpbGROb2Rlcy5wdXNoKG5ld05vZGUpO1xuICAgICAgICAgIGlmICh2b2lkVGFncy5pbmNsdWRlcyh0b2tlbi5uYW1lKSkge1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub2RlID0gbmV3Tm9kZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFRva2VuRW51bS5jaGFyYWN0ZXI6IHtcbiAgICAgICAgY29uc3QgdGV4dG5vZGUgPSBuZXcgVGV4dE5vZGUobm9kZSwgXCJcIik7XG4gICAgICAgIHdoaWxlIChpIDwgdG9rZW5zLmxlbmd0aCAmJiB0b2tlbnNbaV0udHlwZSA9PT0gVG9rZW5FbnVtLmNoYXJhY3Rlcikge1xuICAgICAgICAgIHRleHRub2RlLnRleHQgKz0gKHRva2Vuc1tpXSBhcyBDaGFyYWN0ZXJUb2tlbikuY2hhcmFjdGVyO1xuICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgfVxuICAgICAgICBub2RlLmNoaWxkTm9kZXMucHVzaCh0ZXh0bm9kZSk7XG4gICAgICAgIGkgLT0gMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJvb3Q7XG59O1xuIiwKICAgICJpbXBvcnQgeyBOb2RlLCBUZXh0Tm9kZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgaXNDaGFyU3BhY2UgfSBmcm9tIFwiLi90b2tlbml6ZXJcIjtcblxuaW50ZXJmYWNlIFN0eWxlIHtcbiAgZGlzcGxheT86IFwibm9uZVwiIHwgXCJpbmxpbmVcIiB8IFwiYmxvY2tcIjtcbiAgY29sb3I/OiBzdHJpbmc7XG4gIFwiZm9udC1zaXplXCI/OiBudW1iZXI7XG4gIFwibWFyZ2luLWxlZnRcIj86IG51bWJlcjtcbiAgXCJtYXJnaW4tdG9wXCI/OiBudW1iZXI7XG4gIFwibWFyZ2luLWJvdHRvbVwiPzogbnVtYmVyO1xuICBcImZvbnQtd2VpZ2h0XCI/OiBzdHJpbmc7XG4gIFwidGV4dC1kZWNvcmF0aW9uXCI/OiBzdHJpbmc7XG59XG5cbmNvbnN0IEZPTlQgPSBcIlRpbWVzIE5ldyBSb21hblwiO1xuXG5jb25zdCBkZWZhdWx0U3R5bGVzID0ge1xuICBcIipcIjoge1xuICAgIGRpc3BsYXk6IFwiYmxvY2tcIixcbiAgfSxcbiAgdGl0bGU6IHtcbiAgICBkaXNwbGF5OiBcIm5vbmVcIixcbiAgfSxcbiAgaDE6IHtcbiAgICBkaXNwbGF5OiBcImJsb2NrXCIsXG4gICAgXCJmb250LXNpemVcIjogMzIsXG4gICAgXCJtYXJnaW4tdG9wXCI6IDIyLFxuICAgIFwibWFyZ2luLWJvdHRvbVwiOiAyMixcbiAgICBcImZvbnQtd2VpZ2h0XCI6IFwiYm9sZFwiLFxuICB9LFxuICBoMjoge1xuICAgIGRpc3BsYXk6IFwiYmxvY2tcIixcbiAgICBcImZvbnQtc2l6ZVwiOiAyNCxcbiAgICBcIm1hcmdpbi10b3BcIjogMjAsXG4gICAgXCJtYXJnaW4tYm90dG9tXCI6IDIwLFxuICAgIFwiZm9udC13ZWlnaHRcIjogXCJib2xkXCIsXG4gIH0sXG4gIGE6IHtcbiAgICBkaXNwbGF5OiBcImlubGluZVwiLFxuICAgIGNvbG9yOiBcImJsdWVcIixcbiAgICBcInRleHQtZGVjb3JhdGlvblwiOiBcInVuZGVybGluZVwiLFxuICB9LFxuICBwOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwibWFyZ2luLXRvcFwiOiAxNixcbiAgICBcIm1hcmdpbi1ib3R0b21cIjogMTYsXG4gIH0sXG4gIGRsOiB7XG4gICAgZGlzcGxheTogXCJibG9ja1wiLFxuICAgIFwibWFyZ2luLXRvcFwiOiAxNixcbiAgICBcIm1hcmdpbi1ib3R0b21cIjogMTYsXG4gIH0sXG4gIGR0OiB7IGRpc3BsYXk6IFwiYmxvY2tcIiB9LFxuICBkZDoge1xuICAgIGRpc3BsYXk6IFwiYmxvY2tcIixcbiAgICBcIm1hcmdpbi1sZWZ0XCI6IDQwLFxuICB9LFxufSBzYXRpc2ZpZXMgUmVjb3JkPHN0cmluZywgU3R5bGU+O1xuXG5pbnRlcmZhY2UgVGV4dE5vZGVSZW5kZXJJbmZvIHtcbiAgLy8gbGVmdDogbnVtYmVyO1xuICAvLyB0b3A6IG51bWJlcjtcbiAgLy8gcmlnaHQ6IG51bWJlcjtcbiAgLy8gYm90dG9tOiBudW1iZXI7XG4gIHRleHQ6IHN0cmluZztcbiAgc2l6ZT86IG51bWJlcjtcbiAgY29sb3I/OiBzdHJpbmc7XG4gIHdlaWdodD86IHN0cmluZztcbiAgdW5kZXJsaW5lPzogYm9vbGVhbjtcbiAgcGFyZW50OiBOb2RlO1xufVxuXG5pbnRlcmZhY2UgVGV4dE5vZGVSZW5kZXJDdHgge1xuICBzaXplPzogbnVtYmVyO1xuICBjb2xvcj86IHN0cmluZztcbiAgd2VpZ2h0Pzogc3RyaW5nO1xuICB1bmRlcmxpbmU/OiBib29sZWFuO1xufVxuXG4vLyBpbnRlcmZhY2UgTGF5b3V0Q29udGV4dCB7XG4vLyAgIGxlZnQ6IG51bWJlcjtcbi8vICAgdG9wOiBudW1iZXI7XG4vLyAgIG1hcmdpbkxlZnQ6IG51bWJlcjtcbi8vICAgbWFyZ2luVG9wOiBudW1iZXI7XG4vLyAgIGNvbG9yPzogc3RyaW5nO1xuLy8gICB3ZWlnaHQ/OiBzdHJpbmc7XG4vLyAgIHVuZGVybGluZT86IGJvb2xlYW47XG4vLyAgIHByZXZpb3VzQ2hhcmFjdGVyV2FzU3BhY2U/OiBib29sZWFuO1xuLy8gfVxuLy9cbi8vIHR5cGUgTm9kZVN0YWNrID0gKHtub2RlIDogTm9kZSB8IFRleHROb2RlLCBjdHggOiBMYXlvdXRDb250ZXh0fSlbXTtcblxuLy8gaW50ZXJmYWNlIEJsb2NrIHtcbi8vICAgbGVmdDogbnVtYmVyO1xuLy8gICB0b3A6IG51bWJlcjtcbi8vICAgd2lkdGg6IG51bWJlcjtcbi8vICAgaGVpZ2h0OiBudW1iZXI7XG4vLyAgIG1hcmdpbkxlZnQ6IG51bWJlcjtcbi8vICAgbWFyZ2luVG9wOiBudW1iZXI7XG4vLyB9XG5cbmludGVyZmFjZSBCbG9jazIge1xuICBibG9jazogTm9kZTtcbiAgc3R5bGU6IFN0eWxlO1xuICBlbGVtZW50czogVGV4dE5vZGVSZW5kZXJJbmZvW107XG59XG5cbmNvbnN0IGdldFN0eWxlc0ZvclRhZyA9ICh0YWc6IHN0cmluZykgPT4ge1xuICByZXR1cm4gZGVmYXVsdFN0eWxlc1t0YWcgYXMga2V5b2YgdHlwZW9mIGRlZmF1bHRTdHlsZXNdID8/IGRlZmF1bHRTdHlsZXNbXCIqXCJdO1xufTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVCbG9ja3MoYm9keTogTm9kZSkge1xuICBsZXQgYmxvY2s6IEJsb2NrMiA9IHtcbiAgICBibG9jazogYm9keSxcbiAgICBzdHlsZTogZ2V0U3R5bGVzRm9yVGFnKGJvZHkudGFnKSxcbiAgICBlbGVtZW50czogW10sXG4gIH07XG4gIGNvbnN0IGJsb2NrczogQmxvY2syW10gPSBbYmxvY2tdO1xuICBpbnRlcmZhY2UgU3RhY2sge1xuICAgIG5vZGU6IE5vZGUgfCBUZXh0Tm9kZTtcbiAgICBjdHg6IFRleHROb2RlUmVuZGVyQ3R4O1xuICB9XG4gIGNvbnN0IHN0YWNrOiBTdGFja1tdID0gW3sgbm9kZTogYm9keSwgY3R4OiB7fSB9XTtcblxuICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgY29uc3QgeyBub2RlLCBjdHggfSA9IHN0YWNrLnBvcCgpITtcblxuICAgIGlmICghbm9kZS5oYXNQYXJlbnQoYmxvY2suYmxvY2spKSB7XG4gICAgICBibG9jayA9IHtcbiAgICAgICAgYmxvY2s6IG5vZGUucGFyZW50ISxcbiAgICAgICAgc3R5bGU6IGdldFN0eWxlc0ZvclRhZyhub2RlLnBhcmVudCEudGFnKSxcbiAgICAgICAgZWxlbWVudHM6IFtdLFxuICAgICAgfTtcbiAgICAgIGJsb2Nrcy5wdXNoKGJsb2NrKTtcbiAgICB9XG5cbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgIGNvbnN0IHN0eWxlcyA9IGdldFN0eWxlc0ZvclRhZyhub2RlLnRhZyk7XG5cbiAgICAgIGlmIChzdHlsZXMuZGlzcGxheSA9PT0gXCJibG9ja1wiKSB7XG4gICAgICAgIGJsb2NrID0geyBibG9jazogbm9kZSwgc3R5bGU6IHN0eWxlcywgZWxlbWVudHM6IFtdIH07XG4gICAgICAgIGJsb2Nrcy5wdXNoKGJsb2NrKTtcbiAgICAgIH0gZWxzZSBpZiAoc3R5bGVzLmRpc3BsYXkgPT09IFwibm9uZVwiKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBuZXdDdHggPSB7XG4gICAgICAgIC4uLmN0eCxcbiAgICAgIH07XG4gICAgICBpZiAoXCJmb250LXNpemVcIiBpbiBzdHlsZXMpIHtcbiAgICAgICAgbmV3Q3R4LnNpemUgPSBzdHlsZXNbXCJmb250LXNpemVcIl07XG4gICAgICB9XG4gICAgICBpZiAoXCJjb2xvclwiIGluIHN0eWxlcykge1xuICAgICAgICBuZXdDdHguY29sb3IgPSBzdHlsZXMuY29sb3I7XG4gICAgICB9XG4gICAgICBpZiAoXCJ0ZXh0LWRlY29yYXRpb25cIiBpbiBzdHlsZXMpIHtcbiAgICAgICAgbmV3Q3R4LnVuZGVybGluZSA9IHN0eWxlc1tcInRleHQtZGVjb3JhdGlvblwiXS5pbmNsdWRlcyhcInVuZGVybGluZVwiKTtcbiAgICAgIH1cbiAgICAgIGlmIChcImZvbnQtd2VpZ2h0XCIgaW4gc3R5bGVzKSB7XG4gICAgICAgIG5ld0N0eC53ZWlnaHQgPSBzdHlsZXNbXCJmb250LXdlaWdodFwiXTtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IG5vZGUuY2hpbGROb2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBzdGFjay5wdXNoKHsgbm9kZTogbm9kZS5jaGlsZE5vZGVzW2ldLCBjdHg6IG5ld0N0eCB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYmxvY2suZWxlbWVudHMucHVzaCh7XG4gICAgICAgIHBhcmVudDogbm9kZS5wYXJlbnQsXG4gICAgICAgIHRleHQ6IG5vZGUudGV4dENvbnRleHQsXG4gICAgICAgIC4uLmN0eCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIHdlJ2xsIG5vcm1hbGl6ZSBoZXJlIGFzIHdlbGwuIGdvdHRhIGdldCByaWQgb2YgYW55IGVtcHR5IG9yXG4gIC8vIGxlYWRpbmcvdHJhaWxpbmcgd2hpdGVzcGFjZVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYmxvY2sgPSBibG9ja3NbaV07XG4gICAgbGV0IHNob3VsZFJlbW92ZUxlYWRpbmcgPSB0cnVlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmxvY2suZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBibG9jay5lbGVtZW50c1tpXTtcbiAgICAgIGlmIChzaG91bGRSZW1vdmVMZWFkaW5nKSB7XG4gICAgICAgIGVsZW1lbnQudGV4dCA9IGVsZW1lbnQudGV4dC5yZXBsYWNlKC9eXFxzKy8sIFwiXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGVsZW1lbnQudGV4dC5sZW5ndGggPT09IDApIHtcbiAgICAgIH0gZWxzZSBpZiAoaXNDaGFyU3BhY2UoZWxlbWVudC50ZXh0W2VsZW1lbnQudGV4dC5sZW5ndGggLSAxXSkpIHtcbiAgICAgICAgc2hvdWxkUmVtb3ZlTGVhZGluZyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzaG91bGRSZW1vdmVMZWFkaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IGJsb2NrLmVsZW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gYmxvY2suZWxlbWVudHNbaV07XG4gICAgICBlbGVtZW50LnRleHQgPSBlbGVtZW50LnRleHQucmVwbGFjZSgvXFxzKyQvLCBcIlwiKTtcbiAgICAgIGlmIChlbGVtZW50LnRleHQubGVuZ3RoKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIG5vdyByZW1vdmUgYWxsIGVtcHR5IGJsb2Nrc1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGJsb2NrID0gYmxvY2tzW2ldO1xuICAgIGJsb2NrLmVsZW1lbnRzID0gYmxvY2suZWxlbWVudHMuZmlsdGVyKChlbGVtZW50KSA9PiBlbGVtZW50LnRleHQpO1xuICAgIGlmIChibG9jay5lbGVtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGJsb2Nrcy5zcGxpY2UoaSwgMSk7XG4gICAgICBpLS07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJsb2Nrcztcbn1cblxuY29uc3QgZHJhd1RleHQgPSAoXG4gIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuICBlbGVtZW50czogVGV4dE5vZGVSZW5kZXJJbmZvW10sXG4gIHdpZHRoOiBudW1iZXIsXG4gIGJsb2NrTGVmdDogbnVtYmVyLFxuICBibG9ja1RvcDogbnVtYmVyLFxuKSA9PiB7XG4gIGNvbnN0IHJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gIGN0eC50ZXh0QmFzZWxpbmUgPSBcImFscGhhYmV0aWNcIjtcbiAgY3R4LnRleHRBbGlnbiA9IFwibGVmdFwiO1xuICBsZXQgbGVmdCA9IGJsb2NrTGVmdDtcbiAgbGV0IHRvcCA9IGJsb2NrVG9wO1xuICBsZXQgbWF4SGVpZ2h0ID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBlbGVtZW50c1tpXTtcbiAgICBjb25zdCBzaXplID0gKGVsZW1lbnQuc2l6ZSA/PyAxNikgKiByYXRpbztcbiAgICBjdHguZm9udCA9IGAke2VsZW1lbnQud2VpZ2h0ID8/IFwibm9ybWFsXCJ9ICR7c2l6ZX1weCAke0ZPTlR9YDtcbiAgICBjdHguZmlsbFN0eWxlID0gZWxlbWVudC5jb2xvciA/PyBcImJsYWNrXCI7XG4gICAgY3R4LnN0cm9rZVN0eWxlID0gZWxlbWVudC5jb2xvciA/PyBcImJsYWNrXCI7XG4gICAgbWF4SGVpZ2h0ID0gTWF0aC5tYXgobWF4SGVpZ2h0LCBzaXplKTtcblxuICAgIGxldCB0ZXh0TGVmdFRvV3JpdGUgPSBlbGVtZW50LnRleHQ7XG4gICAgd2hpbGUgKHRleHRMZWZ0VG9Xcml0ZSkge1xuICAgICAgLy8ganVzdCB3cml0ZSBvbmUgd29yZCBhdCBhIHRpbWVcbiAgICAgIGNvbnN0IGluZGV4ID0gdGV4dExlZnRUb1dyaXRlLmluZGV4T2YoXCIgXCIpO1xuICAgICAgbGV0IHRleHQgPSBcIlwiO1xuICAgICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgICB0ZXh0ID0gdGV4dExlZnRUb1dyaXRlO1xuICAgICAgICB0ZXh0TGVmdFRvV3JpdGUgPSBcIlwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGV4dCA9IHRleHRMZWZ0VG9Xcml0ZS5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgICB0ZXh0TGVmdFRvV3JpdGUgPSB0ZXh0TGVmdFRvV3JpdGUuc2xpY2UoaW5kZXggKyAxKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG1lYXN1cmVkID0gY3R4Lm1lYXN1cmVUZXh0KHRleHQpO1xuICAgICAgaWYgKG1lYXN1cmVkLndpZHRoICsgbGVmdCA+IHdpZHRoKSB7XG4gICAgICAgIHRvcCArPSBzaXplO1xuICAgICAgICBsZWZ0ID0gYmxvY2tMZWZ0O1xuICAgICAgfVxuICAgICAgY3R4LmZpbGxUZXh0KHRleHQsIGxlZnQsIHRvcCArIHNpemUgKiAwLjc1KTtcbiAgICAgIGlmIChlbGVtZW50LnVuZGVybGluZSkge1xuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGN0eC5tb3ZlVG8obGVmdCwgdG9wICsgc2l6ZSAqIDAuOSk7XG4gICAgICAgIGN0eC5saW5lVG8obGVmdCArIG1lYXN1cmVkLndpZHRoLCB0b3AgKyBzaXplICogMC45KTtcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IHJhdGlvO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG4gICAgICB9XG4gICAgICBsZWZ0ICs9IG1lYXN1cmVkLndpZHRoO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdG9wICsgbWF4SGVpZ2h0O1xufTtcblxuZXhwb3J0IGNvbnN0IHJlbmRlciA9IChjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50LCBib2R5OiBOb2RlKSA9PiB7XG4gIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICBjb25zdCBibG9ja3MgPSBnZW5lcmF0ZUJsb2Nrcyhib2R5KTtcbiAgY29uc3Qgd2lkdGggPSBjYW52YXMud2lkdGg7XG4gIGNvbnN0IGdsb2JhbE1hcmdpbiA9IDg7XG4gIGxldCBwcmV2aW91c01hcmdpbkJvdHRvbSA9IDg7XG4gIGxldCB5ID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBibG9jayA9IGJsb2Nrc1tpXTtcbiAgICBjb25zdCB7XG4gICAgICBcIm1hcmdpbi10b3BcIjogbWFyZ2luVG9wLFxuICAgICAgXCJtYXJnaW4tYm90dG9tXCI6IG1hcmdpbkJvdHRvbSxcbiAgICAgIFwibWFyZ2luLWxlZnRcIjogbWFyZ2luTGVmdCxcbiAgICB9ID0gYmxvY2suc3R5bGU7XG4gICAgY29uc3QgYWN0dWFsTWFyZ2luVG9wID0gTWF0aC5tYXgobWFyZ2luVG9wID8/IDAsIHByZXZpb3VzTWFyZ2luQm90dG9tKTtcbiAgICB5ICs9IGFjdHVhbE1hcmdpblRvcDtcbiAgICBjb25zdCBhY3R1YWxNYXJnaW5MZWZ0ID0gZ2xvYmFsTWFyZ2luICsgKG1hcmdpbkxlZnQgPz8gMCk7XG5cbiAgICB5ID0gZHJhd1RleHQoY3R4LCBibG9jay5lbGVtZW50cywgd2lkdGgsIGFjdHVhbE1hcmdpbkxlZnQsIHkpO1xuICAgIHByZXZpb3VzTWFyZ2luQm90dG9tID0gbWFyZ2luQm90dG9tID8/IDA7XG4gIH1cbn07XG4iLAogICAgImltcG9ydCB7IE5vZGUsIHBhcnNlIH0gZnJvbSBcIi4vcGFyc2VyXCI7XG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tIFwiLi9yZW5kZXJlclwiO1xuXG5jb25zdCBQUk9YWV9IT1NUID0gd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXMoXCJsb2NhbGhvc3RcIilcbiAgPyBcImh0dHA6Ly9sb2NhbGhvc3Q6ODA5MFwiXG4gIDogXCJodHRwczovL2Jyb3dzZXIubWJrdi5pby9wcm94eVwiO1xuXG5hc3luYyBmdW5jdGlvbiBmZXRjaFBhZ2UodXJsOiBzdHJpbmcpIHtcbiAgLy8gZ290dGEgcHJveHkgZHVlIHRvIGNvcnMgZXJyb3JzXG4gIGNvbnN0IHByb3hpZWQgPSBgJHtQUk9YWV9IT1NUfS8ke3VybH1gO1xuICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2gocHJveGllZCk7XG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwLnRleHQoKTtcblxuICByZXR1cm4gdGV4dDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIHtcbiAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYW52YXNcIikgYXMgSFRNTENhbnZhc0VsZW1lbnQ7XG4gIGNvbnN0IGh0bWxEaXNwbGF5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXG4gICAgXCJpbnB1dGh0bWxcIixcbiAgKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50O1xuICBjb25zdCBhZGRyZXNzQmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXG4gICAgXCJhZGRyZXNzLWJhclwiLFxuICApISBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICBsZXQgdGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBsZXQgaHRtbDogTm9kZSB8IHVuZGVmaW5lZDtcblxuICBhc3luYyBmdW5jdGlvbiByZXNpemUoKSB7XG4gICAgaWYgKGNhbnZhcy5wYXJlbnRFbGVtZW50KSB7XG4gICAgICBjb25zdCByYXRpbyA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuICAgICAgY29uc3Qgd2lkdGggPSBjYW52YXMucGFyZW50RWxlbWVudC5jbGllbnRXaWR0aDtcbiAgICAgIGNvbnN0IGhlaWdodCA9IGNhbnZhcy5wYXJlbnRFbGVtZW50LmNsaWVudEhlaWdodDtcbiAgICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcbiAgICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuICAgICAgY2FudmFzLndpZHRoID0gY2FudmFzLnBhcmVudEVsZW1lbnQuY2xpZW50V2lkdGggKiByYXRpbztcbiAgICAgIGNhbnZhcy5oZWlnaHQgPSBjYW52YXMucGFyZW50RWxlbWVudC5jbGllbnRIZWlnaHQgKiByYXRpbztcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBydW4oKSB7XG4gICAgdGV4dCA9IGF3YWl0IGZldGNoUGFnZShhZGRyZXNzQmFyLnZhbHVlKTtcbiAgICBodG1sID0gcGFyc2UodGV4dCk7XG4gICAgaHRtbERpc3BsYXkudGV4dENvbnRlbnQgPSBodG1sLmh0bWwoKTtcblxuICAgIHJlc2l6ZSgpO1xuICAgIHJlbmRlcihjYW52YXMsIGh0bWwpO1xuICB9XG5cbiAgYWRkcmVzc0Jhci5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCBydW4pO1xuICBydW4oKTtcbn1cblxuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250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
