const isCharacterSpace = (string: string) => {
  return string === " " || string == "\n" || string === "\t";
};

const isCharacterAlpha = (string: string) => {
  const charCode = string.charCodeAt(0);
  const a = "a".charCodeAt(0);
  const z = "z".charCodeAt(0);
  const A = "A".charCodeAt(0);
  const Z = "Z".charCodeAt(0);

  return (charCode >= a && charCode <= z) || (charCode >= A && charCode <= Z);
};

enum TokenEnum {
  character,
  tag,
  doctype,
}

enum State {
  data,
  tagOpen,
  endTagOpen,
  tagName,
  beforeAttributeName,
  attributeName,
  afterAttributeName,
  beforeAttributeValue,
  attributeValueDoubleQuoted,
  attributeValueSingleQuoted,
  attributeValueUnquoted,
  afterAttributeValueQuoted,
  selfClosingStartTag,
  bogusComment,
  markupDeclarationOpen,
  comment,
  doctype,
  beforeDoctypeName,
  doctypeName,
  afterDoctypeName,
}

interface CharacterToken {
  type: TokenEnum.character;
  character: string;
}

interface CommentToken {
  type: TokenEnum.comment;
  comment: string;
}

interface TagToken {
  type: TokenEnum.tag;
  name: string;
  closing: boolean;
  attributes: [string, string][];
  selfClosing: boolean;
}

interface DoctypeToken {
  type: TokenEnum.doctype;
  doctype: string;
}

type Token = CharacterToken | CommentToken | TagToken;

class TokenizerContext {
  state: State = State.data;

  returnState: State[] = [];

  constructor(
    public input: string,
    public index: number,
  ) {}

  getCurrentInput() {
    return this.input[this.index];
  }

  peek(length: number) {
    return this.input.slice(this.index, this.index + length);
  }

  skip(length: number) {
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

  setState(state: State, returnState?: State) {
    if (returnState != null) {
      this.returnState.push(returnState);
    }
    this.state = state;
  }

  popReturnState() {
    this.state = this.returnState.pop()!;
  }

  *[Symbol.iterator]() {
    while (!this.eof()) {
      yield this.consume();
    }
  }
}

// generating

const generateCharacterToken = (character: string): CharacterToken => {
  return {
    type: TokenEnum.character,
    character,
  };
};

const generateEmptyTagToken = (closing: boolean): TagToken => {
  return {
    type: TokenEnum.tag,
    name: "",
    closing,
    attributes: [],
    selfClosing: false,
  };
};

const generateDoctypeToken = (): DoctypeToken => {
  return {
    type: TokenEnum.doctype,
    doctype: "",
  };
};

// tokenizering

function* tokenizer(input: string) {
  const s = new TokenizerContext(input, 0);

  let tagToken: TagToken = generateEmptyTagToken(false);
  let attribute: [string, string] = ["", ""];
  let doctypeToken: DoctypeToken = generateDoctypeToken();

  while (!s.eof()) {
    const state = s.state;
    switch (state) {
      case State.data: {
        for (const char of s) {
          if (char === "<") {
            s.setState(State.tagOpen);
            break;
          } else if (char === "?") {
            s.reconsume();
            s.setState(State.bogusComment);
            break;
          } else {
            yield generateCharacterToken(char);
          }
        }
        break;
      }
      case State.tagOpen: {
        const char = s.consume();
        if (char === "!") {
          s.setState(State.markupDeclarationOpen);
        } else if (char === "/") {
          s.setState(State.endTagOpen);
        } else if (isCharacterAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(false);
          s.setState(State.tagName);
        } else {
          s.reconsume();
          s.setState(State.data);
        }
        break;
      }
      case State.endTagOpen: {
        // we don't really care about error handling tbh...
        const char = s.consume();
        if (isCharacterAlpha(char)) {
          s.reconsume();
          tagToken = generateEmptyTagToken(true);
          s.setState(State.tagName);
        } else {
          s.reconsume();
          s.setState(State.bogusComment);
        }
        break;
      }
      case State.tagName: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(State.beforeAttributeName);
            break;
          } else if (char === "/") {
            tagToken.selfClosing = true;
            s.setState(State.selfClosingStartTag);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            tagToken.name += char.toLowerCase();
          }
        }
        break;
      }
      case State.beforeAttributeName: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else if (char === "/" || char === ">") {
            s.reconsume();
            s.setState(State.afterAttributeName);
            break;
          } else if (char === "=") {
            // TODO
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(State.attributeName);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case State.attributeName: {
        for (const char of s) {
          if (isCharacterSpace(char) || char === "/" || char === ">") {
            s.reconsume();
            s.setState(State.afterAttributeName);
            break;
          } else if (char === "=") {
            s.setState(State.beforeAttributeValue);
            break;
          } else {
            attribute[0] += char.toLowerCase();
          }
        }
        break;
      }
      case State.afterAttributeName: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else if (char === "/") {
            s.setState(State.selfClosingStartTag);
            break;
          } else if (char === "=") {
            s.setState(State.beforeAttributeValue);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            attribute = ["", ""];
            tagToken.attributes.push(attribute);
            s.setState(State.attributeName);
            s.reconsume();
            break;
          }
        }
        break;
      }
      case State.beforeAttributeValue: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          }
          s.reconsume();
          break;
        }
        const char = s.consume();
        if (char === '"') {
          s.setState(State.attributeValueDoubleQuoted);
        } else if (char === "'") {
          s.setState(State.attributeValueSingleQuoted);
        } else if (char === ">") {
          yield tagToken;
          s.setState(State.data);
        } else {
          s.reconsume();
          s.setState(State.attributeValueUnquoted);
        }
        break;
      }
      case State.attributeValueDoubleQuoted: {
        for (const char of s) {
          if (char === '"') {
            s.setState(State.afterAttributeValueQuoted);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case State.attributeValueSingleQuoted: {
        for (const char of s) {
          if (char === "'") {
            s.setState(State.afterAttributeValueQuoted);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case State.attributeValueUnquoted: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(State.beforeAttributeName);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            attribute[1] += char;
          }
        }
        break;
      }
      case State.afterAttributeValueQuoted: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(State.beforeAttributeName);
            break;
          } else if (char === "/") {
            s.setState(State.selfClosingStartTag);
            break;
          } else if (char === ">") {
            yield tagToken;
            s.setState(State.data);
            break;
          } else {
            s.reconsume();
            s.setState(State.beforeAttributeName);
            break;
          }
        }
        break;
      }
      case State.selfClosingStartTag: {
        const char = s.consume();
        if (char === ">") {
          tagToken.selfClosing = true;
          s.setState(State.data);
        } else {
          s.reconsume();
          s.setState(State.beforeDoctypeName);
        }
        break;
      }
      case State.bogusComment: {
        for (const char of s) {
          if (char === ">") {
            s.setState(State.data);
            break;
          }
        }
        break;
      }
      case State.markupDeclarationOpen: {
        const doctype = "doctype";
        if (s.peek(doctype.length).toLowerCase() === doctype) {
          s.skip(doctype.length);
          s.setState(State.doctype);
        } else if (s.peek(2) === "--") {
          s.skip(2);
          s.setState(State.comment);
        }
        break;
      }
      case State.comment: {
        for (const char of s) {
          if (char === "-" && s.peek(3) === "-->") {
            s.skip(3);
            s.setState(State.data);
            break;
          }
        }
        break;
      }
      case State.doctype: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(State.beforeDoctypeName);
            break;
          } else {
            s.reconsume();
            s.setState(State.beforeDoctypeName);
            break;
          }
        }
        break;
      }
      case State.beforeDoctypeName: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else {
            s.reconsume();
            doctypeToken = generateDoctypeToken();
            s.setState(State.doctypeName);
            break;
          }
        }
        break;
      }
      case State.doctypeName: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            s.setState(State.afterDoctypeName);
            break;
          } else if (char === ">") {
            yield doctypeToken;
            s.setState(State.data);
            break;
          } else {
            doctypeToken.doctype += char.toLowerCase();
          }
        }
        break;
      }
      case State.afterDoctypeName: {
        for (const char of s) {
          if (isCharacterSpace(char)) {
            continue;
          } else if (char === ">") {
            s.setState(State.data);
            yield doctypeToken;
            break;
          }
        }
        break;
      }
      default: {
        const _v: never = state;
      }
    }
  }
}

window.tokenizer = tokenizer;

class TextNode {
  constructor(public text: string) {}
}

class Node {
  children: (Node | TextNode)[] = [];
  public constructor(
    public tag: string,
    public attributes: Record<string, string> = {},
    public parent: Node | undefined,
  ) {}
}

export const parse = (input: string) => {
  const root = new Node("", {}, undefined);
  let node = root;
  const tokens = [...tokenizer(input)];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case TokenEnum.doctype: {
        // lol don't care rendering at html5 no matter what
        break;
      }
      case TokenEnum.tag: {
        if (token.closing) {
          if (token.name === node.tag) {
            console.assert(node.parent, "closed 1 too many nodes lol");
            node = node.parent!;
          } else {
            console.error(
              "attempted to close ",
              token.name,
              " with a ",
              node.tag,
            );
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
            "wbr",
          ];
          const newNode = new Node(
            token.name,
            Object.fromEntries(token.attributes),
            node,
          );
          node.children.push(newNode);
          if (voidTags.includes(token.name)) {
          } else {
            node = newNode;
          }
        }
        break;
      }
      case TokenEnum.character: {
        const textnode = new TextNode("");
        while (tokens[i].type === TokenEnum.character) {
          textnode.text += (tokens[i] as CharacterToken).character;
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
