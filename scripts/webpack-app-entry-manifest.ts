type ClientModule = {
  resource?: string
  request?: string
  identifier?: () => string
  modules?: Iterable<ClientModule>
}

type Compilation = {
  entrypoints: Map<string, { getFiles(): string[]; chunks: Iterable<object> }>
  chunkGraph: { getChunkModulesIterable(chunk: object): Iterable<ClientModule> }
  hooks: {
    processAssets: {
      tap(options: { name: string; stage: number }, callback: () => void): void
    }
  }
  emitAsset(name: string, source: object): void
}

type Compiler = {
  hooks: {
    thisCompilation: {
      tap(name: string, callback: (compilation: Compilation) => void): void
    }
  }
}

type Webpack = {
  Compilation: { PROCESS_ASSETS_STAGE_REPORT: number }
  sources: { RawSource: new (source: string) => object }
}

// Client-reference manifests merge sibling pages into parent route groups.
// Record the compiler's initial entry files separately so a first-load budget
// does not charge a private route for the homepage's client components.
export function appEntryManifestPlugin(buildId: string, webpack: Webpack) {
  const name = "NabaperksAppEntryManifest"
  return {
    apply(compiler: Compiler) {
      compiler.hooks.thisCompilation.tap(name, (compilation) => {
        compilation.hooks.processAssets.tap(
          { name, stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
          () => {
            const entries = Object.fromEntries(
              [...compilation.entrypoints]
                .filter(([entry]) => entry.startsWith("app/"))
                .map(([entry, point]) => [
                  entry,
                  point.getFiles().filter((file) => file.endsWith(".js")),
                ])
            )
            const initialModules = Object.fromEntries(
              [...compilation.entrypoints]
                .filter(([entry]) => entry.startsWith("app/"))
                .map(([entry, point]) => {
                  const resources = new Set<string>()
                  for (const chunk of point.chunks) {
                    for (const clientModule of compilation.chunkGraph.getChunkModulesIterable(
                      chunk
                    )) {
                      collectComponentResources(clientModule, resources)
                    }
                  }
                  return [entry, [...resources].sort()]
                })
            )
            compilation.emitAsset(
              "app-entry-manifest.json",
              new webpack.sources.RawSource(
                JSON.stringify({
                  version: 3,
                  buildId,
                  entries,
                  initialModules,
                  ssrReferences: collectSsrReferences(compilation),
                })
              )
            )
          }
        )
      })
    },
  }
}

function collectComponentResources(
  clientModule: ClientModule,
  resources: Set<string>
) {
  const component = clientModule.resource?.match(
    /\/components\/(.+\.(?:tsx?|jsx?))$/
  )?.[1]
  if (component) resources.add(`components/${component}`)
  for (const child of clientModule.modules ?? [])
    collectComponentResources(child, resources)
}

function collectSsrReferences(compilation: Compilation) {
  return Object.fromEntries(
    [...compilation.entrypoints]
      .filter(([entry]) => entry.startsWith("app/"))
      .map(([entry, point]) => {
        const references = new Set<string>()
        function collect(clientModule: ClientModule) {
          const request =
            clientModule.request ?? clientModule.identifier?.() ?? ""
          const loader = request.match(
            /next-flight-client-entry-loader(?:\.js)?\?/
          )
          const start = loader?.index ?? -1
          if (start >= 0) {
            const query = request
              .slice(start + (loader?.[0].length ?? 0))
              .split("!")[0]
            for (const value of new URLSearchParams(query).getAll("modules")) {
              const reference: unknown = JSON.parse(value)
              if (
                typeof reference !== "object" ||
                reference === null ||
                !("request" in reference) ||
                typeof reference.request !== "string"
              )
                throw new Error("Unsupported Next SSR client entry reference")
              if (!reference.request.endsWith(".css"))
                references.add(reference.request)
            }
          }
          for (const child of clientModule.modules ?? []) collect(child)
        }
        for (const chunk of point.chunks)
          for (const clientModule of compilation.chunkGraph.getChunkModulesIterable(
            chunk
          ))
            collect(clientModule)
        return [entry, [...references].sort()]
      })
  )
}
