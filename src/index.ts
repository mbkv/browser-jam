import "./html/tokenizer"

const defaultHtml = `<!DOCTYPE html>
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

function main() {
  document.getElementById('inputhtml')!.textContent = defaultHtml
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

