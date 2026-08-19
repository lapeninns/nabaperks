export function createDisposableDbClient(rawUrl, connectionFactory) {
  return connectionFactory(rawUrl)
}
