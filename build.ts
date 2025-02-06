export async function build() {
  await Bun.$`rm -rf dist`
  console.log(await Bun.$`bunx tsc && cp -f index.html dist/index.html && cp -f favicon.ico dist/favicon.ico`.text())
}

if (import.meta.main) {
  await build()
}
