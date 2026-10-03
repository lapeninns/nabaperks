import { once } from "node:events"
import { createServer } from "node:net"

export async function ftpFixture(
  t,
  {
    mdtmFails = false,
    separateHost = false,
    forcePasv = false,
    unixListing = false,
  } = {}
) {
  const payload = "function FindProxyForURL() { return 'DIRECT'; }\n"
  const sockets = new Set()
  const dataServers = new Set()
  const commands = []
  let separateConnections = 0
  const server = createServer((control) => {
    sockets.add(control)
    control.on("error", () => {})
    control.on("close", () => sockets.delete(control))
    control.setEncoding("utf8")
    control.write("220 local dependency fixture\r\n")
    let input = ""
    let dataSocket
    let connected

    async function passive(ipv4) {
      const dataServer = createServer((socket) => {
        sockets.add(socket)
        socket.on("error", () => {})
        socket.on("close", () => sockets.delete(socket))
        if (separateHost) separateConnections++
        dataSocket = socket
        connected?.()
      })
      dataServers.add(dataServer)
      dataServer.listen(0, "127.0.0.1")
      await once(dataServer, "listening")
      const { port } = dataServer.address()
      control.write(
        ipv4
          ? `227 passive (${separateHost ? "192,0,2,1" : "127,0,0,1"},${port >> 8},${port & 255})\r\n`
          : `229 passive (|||${port}|)\r\n`
      )
    }

    async function transfer(body) {
      control.write("150 opening local data stream\r\n")
      if (!dataSocket)
        await new Promise((resolve) => {
          connected = resolve
        })
      const socket = dataSocket
      dataSocket = undefined
      connected = undefined
      socket.end(body, () => control.write("226 transfer complete\r\n"))
    }

    async function respond(line) {
      const verb = line.split(" ", 1)[0]
      commands.push(verb)
      switch (verb) {
        case "USER":
          control.write("331 password required\r\n")
          break
        case "PASS":
          control.write("230 fixture login\r\n")
          break
        case "FEAT":
          control.write(
            unixListing
              ? "211 no features\r\n"
              : "211-features\r\n MLST type;size;modify;\r\n211 end\r\n"
          )
          break
        case "MDTM":
          control.write(
            mdtmFails ? "500 MDTM unsupported\r\n" : "213 20261003090000\r\n"
          )
          break
        case "EPSV":
          if (separateHost || forcePasv)
            control.write("500 EPSV unsupported\r\n")
          else await passive(false)
          break
        case "PASV":
          await passive(true)
          break
        case "MLSD":
        case "LIST":
          await transfer(
            unixListing
              ? `-rw-r--r-- 1 owner group ${Buffer.byteLength(payload)} Jan 1 2020 proxy.pac\r\n`
              : `type=file;size=${Buffer.byteLength(payload)};modify=20261003090000; proxy.pac\r\n`
          )
          break
        case "RETR":
          await transfer(payload)
          break
        case "QUIT":
          control.end("221 goodbye\r\n")
          break
        default:
          control.write("200 accepted\r\n")
      }
    }

    let responses = Promise.resolve()
    control.on("data", (chunk) => {
      input += chunk
      let end
      while ((end = input.indexOf("\r\n")) !== -1) {
        const line = input.slice(0, end)
        input = input.slice(end + 2)
        responses = responses
          .then(() => respond(line))
          .catch((error) => control.destroy(error))
      }
    })
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await Promise.all(
      [server, ...dataServers].map(
        (listener) => new Promise((resolve) => listener.close(resolve))
      )
    )
  })
  return {
    url: `ftp://fixture:fixture@127.0.0.1:${server.address().port}/proxy.pac`,
    payload,
    commands,
    separateConnections: () => separateConnections,
  }
}
