// @ts-ignore
import corsProxy from "cors-anywhere"

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 8090

corsProxy.createServer({
  originWhitelist: ['http://localhost:3000', 'https://mbkv.io', 'https://browser.mbkv.io'],
}).listen(port, host, () => {
  console.log(`Running CORS Anywhere on ${host}:${port}`)
})
