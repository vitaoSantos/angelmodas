// Brilhos de fundo (dourado e rosé) e textura granulada fixos em toda a página.
// Gradiente radial em vez de filter: blur, que pesa muito no celular.
export function Background() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60vmax_60vmax_at_0%_0%,rgb(216_185_138/0.09),transparent_70%),radial-gradient(55vmax_55vmax_at_100%_70%,rgb(227_166_159/0.07),transparent_70%)]"
      />
      <div aria-hidden className="grain hidden md:block" />
    </>
  )
}
