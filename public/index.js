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
  const ratio = window.devicePixelRatio;
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
    const actualMarginTop = Math.max(marginTop ?? 0, previousMarginBottom) * ratio;
    y += actualMarginTop;
    const actualMarginLeft = (globalMargin + (marginLeft ?? 0)) * ratio;
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
  async function resizeAndRun() {
    if (html && canvas.parentElement) {
      const ratio = window.devicePixelRatio;
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = canvas.parentElement.clientWidth * ratio;
      canvas.height = canvas.parentElement.clientHeight * ratio;
      render(canvas, html);
    }
  }
  async function run() {
    text = await fetchPage(addressBar.value);
    html = parse(text);
    htmlDisplay.textContent = html.html();
    resizeAndRun();
  }
  const observer = new ResizeObserver(() => {
    resizeAndRun();
  });
  observer.observe(canvas.parentElement);
  addressBar.addEventListener("blur", run);
  run();
}
var PROXY_HOST = window.location.href.includes("localhost") ? "http://localhost:8090" : "https://browser.mbkv.io/proxy";
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

//# debugId=795FECBC02B00BF764756E2164756E21
