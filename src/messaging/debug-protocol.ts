import { DebugProtocol as DP } from 'vscode-debugprotocol'
import { Readable, Writable } from 'stream'
import { ID } from '../support/utils'
import {} from 'vscode-debug'

export default (readable: Readable, writable: Writable) => {
  const pendingRequests = new Map()
  const id = ID()

  let onErrorFn = (_: any) => {}
  let onEventFn = (_: DP.Event) => {}
  let onRequestFn = (_: DP.Request) => {}

  const onMessage = (msg: DP.ProtocolMessage) => {
    console.log('RECV <<<', msg)
    if (msg.type === 'event') return onEventFn(msg as DP.Event)
    if (msg.type === 'request') return onRequestFn(msg as DP.Request)
    if (msg.type === 'request') {
      const m = (msg as DP.Response)
      if (!pendingRequests.has(m.request_seq)) return

      const { done, fail } = pendingRequests.get(m.request_seq)
      m.success ? done(m) : fail(m)
      pendingRequests.delete(m.request_seq)
    }
  }

  const sendNotification = (response: DP.Response) => {
    if (response.seq > 0) return onErrorFn(new Error(`don't send more than one response for: ${response.command}`))
    const seq = id.next()
    connection.send({ seq, type: 'response', command: response.command })
  }

  const sendRequest = (command: string, args: any) => {
    const seq = id.next()
    connection.send({ command, seq, type: 'request', arguments: args })
    console.log('REQ >>>', { command, arguments: args, seq, type: 'request' })
    return new Promise((done, fail) => pendingRequests.set(seq, { done, fail }))
  }

  const onNotification = (cb: (event: DP.Event) => void) => onEventFn = cb
  const onRequest = (cb: (request: DP.Request) => void) => onRequestFn = cb
  const onError = (cb: (error: any) => void) => onErrorFn = cb

  const connection = streamProcessor(readable, writable, onMessage, onErrorFn)

  return { sendRequest, sendNotification, onNotification, onRequest, onError }
}

const TWO_CRLF = '\r\n\r\n'
const HEADER_LINE_SEP = /\r?\n/
const HEADER_FIELD_SEP = /: */
const TWO_CRLF_LENGTH = TWO_CRLF.length

// stolen from: vscode/blob/master/src/vs/workbench/parts/debug/node/debugAdapter.ts
const streamProcessor = (readable: Readable, writable: Writable, onMessage: Function, onError: Function) => {
  let rawData = Buffer.allocUnsafe(0)
  let contentLength = -1

  readable.on('data', (data: Buffer) => {
    console.log('RAW RECV:', data+'')
    // rawData = Buffer.concat([rawData, data])

    // TODO: this is bad it goes in an infinite loop if the recv data
    // is malformed (like LOG output or other non-protocol data)
    // while (true) {
    //   console.log('whileing')
    //   if (contentLength >= 0) {
    //     if (rawData.length >= contentLength) {
    //       const message = rawData.toString('utf8', 0, contentLength)
    //       rawData = rawData.slice(contentLength)
    //       contentLength = -1

    //       if (message.length > 0) {
    //         try {
    //           const data: DP.ProtocolMessage = JSON.parse(message)
    //           onMessage(data)
    //         } catch (e) {
    //           const err = new Error(`${(e.message || e)}\n${message}`)
    //           onError(err)
    //         }
    //       }

    //       continue
    //     }

    //     else {
    //       const idx = rawData.indexOf(TWO_CRLF)
    //       if (idx !== -1) {
    //         const header = rawData.toString('utf8', 0, idx)
    //         const lines = header.split(HEADER_LINE_SEP)

    //         for (const h of lines) {
    //           const kvPair = h.split(HEADER_FIELD_SEP)
    //           if (kvPair[0] === 'Content-Length') contentLength = Number(kvPair[1])
    //         }

    //         rawData = rawData.slice(idx + TWO_CRLF_LENGTH)

    //         continue
    //       }
    //     }

    //     break
    //   }
    // }
  })

  const send = <T extends DP.ProtocolMessage>(message: T) => {
    if (!writable) return
    const json = JSON.stringify(message)
    console.log('RAW SEND:', json)
    const length = Buffer.byteLength(json, 'utf8')
    writable.write(`Content-Length: ${length}${TWO_CRLF}${json}`, 'utf8')
  }

  return { send }
}
