import { build } from "./build"

const server = Bun.serve({
  hostname: "127.0.0.1",
  async fetch(req) {
    let pathname = new URL(req.url).pathname
    if (pathname.endsWith("/")) {
      pathname += "index.html"
      await build()
    }
    return new Response(Bun.file(`dist${pathname}`))
  }
})
console.log(`http://${server.hostname}:${server.port}/`)
