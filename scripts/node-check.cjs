// En JavaScript pur : une version de Node trop ancienne ne sait pas lire les scripts .ts.
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
if (major < 24 || (major === 24 && minor < 15)) {
  console.error(`✘ Node ${process.versions.node} : il faut Node 24.15 ou plus (https://nodejs.org).`)
  process.exit(1)
}
