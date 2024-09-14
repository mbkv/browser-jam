import { Node, parse } from "./parser";
import { render } from "./renderer";

const PROXY_HOST = "http://localhost:8090"

async function fetchPage(url: string) {
  // gotta proxy due to cors errors
  const proxied = `${PROXY_HOST}/${url}`;
  const resp = await fetch(proxied);
  const text = await resp.text();

  return text;
}

function renderPage(html: string) {
  const canvas = document.getElementById('canvas')! as HTMLCanvasElement;
  const node = parse(html)
}

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const htmlDisplay = document.getElementById('inputhtml') as HTMLTextAreaElement;
  const addressBar = document.getElementById('address-bar')! as HTMLInputElement;
  let text: string | undefined;
  let html: Node | undefined;

  async function run() {
    text = await fetchPage(addressBar.value);
    html = parse(text)
    htmlDisplay.textContent = html.html();

    const [body] = html.getElementsByTagname("body")
    render(canvas, body);
  }

  addressBar.addEventListener('change', run)
  run();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

