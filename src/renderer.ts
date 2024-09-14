import {Node} from "./parser";

interface Style {
  display?: string;
  color?: string;
  "font-size"?: number;
  "margin-left"?: number;
  "margin-top"?: number;
  "margin-bottom"?: number;
  "font-weight"?: string;
  "text-decoration"?: string;
}

const FONT = "Times New Roman";

const defaultStyles = {
  h1 : {
    "display" : "block",
    "font-size" : 32,
    "margin-top" : 22,
    "margin-bottom" : 22,
    "font-weight" : "bold",
  },
  a : {
    display : "inline",
    color : "blue",
    "text-decoration" : "underline",
  },
  p : {
    display : "block",
    "margin-top" : 16,
    "margin-bottom" : 16,
  },
  dl : {
    display : "block",
    "margin-top" : 16,
    "margin-bottom" : 16,
  },
  dt : {display : "block"},
  dd : {
    display : "block",
    "margin-left" : 40,
  }
} satisfies Record<string, Style>;

interface TextNode {
  left: number;
  top: number;
  right: number;
  bottom: number;
  text: string;
  color: string;
  bold: string;
  underline: boolean;
  parent: Node;
}

interface LayoutContext {
  left: number;
  top: number;
  marginLeft: number;
  marginTop: number;
  color?: string;
  bold?: string;
  underline?: boolean;
}

type NodeStack = ({node : Node, ctx : LayoutContext})[];

function generateLayoutNodes(width: number, body: Node): TextNode[] {
  const nodes: TextNode[] = [];
  let stack: NodeStack = [ {
    node : body,
    ctx : {
      left : 0,
      top : 0,
      marginLeft : 8,
      marginTop : 8,
    }
  } ];

  while (stack.length) {
    const { node, ctx: parentCtx } = stack.pop()!;

    const ctx = {
      ...parentCtx,
    }
    const styles = defaultStyles[node.tag as keyof typeof defaultStyles];

    if ('margin-left' in styles) {
      ctx.marginLeft = Math.max(styles["margin-left"], ctx.marginLeft);
    }
    if ('margin-top' in styles) {
      ctx.marginTop = Math.max(styles["margin-top"], ctx.marginTop);
    }


    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const childNode = node.childNodes[i];
      if (childNode instanceof Node) {
        stack.push(childNode);
      } else {
        const textNode = { left : ctx[ctx.length - 1].left + }
      }
    }
  }

  return nodes;
}

export const render = (canvas: HTMLCanvasElement, body: Node) => {
  const ctx = canvas.getContext('2d');
  let marginLeft: number[] = [ 8 ];
  let marginTop = 8;
}
