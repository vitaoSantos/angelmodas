import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { TbBrandWhatsapp, TbHanger, TbHeart, TbShoppingBag } from 'react-icons/tb'
import { easeOut } from '../ui/motion'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

const steps = [
  {
    icon: TbHanger,
    title: 'Escolha as peças',
    text: 'Passe pela arara do catálogo ou monte o look inteiro no provador, trocando as peças e as cores até achar a combinação perfeita.',
    note: 'pode provar quantas vezes quiser',
  },
  {
    icon: TbBrandWhatsapp,
    title: 'Chame no WhatsApp',
    text: 'O look já vai escrito na mensagem, com cor e tamanho. A gente confere o estoque e tira todas as suas dúvidas.',
    note: 'atendimento de gente, com carinho',
  },
  {
    icon: TbShoppingBag,
    title: 'Combine do seu jeito',
    text: 'Pagamento, retirada ou entrega: a gente combina na conversa o jeito mais fácil para você.',
    note: 'sem complicação',
  },
  {
    icon: TbHeart,
    title: 'Vista e arrase',
    text: 'Sua peça chega com todo o cuidado. Depois é só arrasar e, se quiser, marcar a gente na foto para entrar no mural.',
    note: 'a gente adora ver você linda',
  },
]

export function HowToBuy() {
  const list = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: list, offset: ['start 75%', 'end 55%'] })
  // scaleY em vez de height: o fio corre sem recalcular o layout a cada quadro
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section id="como-comprar" className="relative py-24 sm:py-32">
      <div className="container-x grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal>
            <SectionLabel>Como comprar</SectionLabel>
            <h2 className="mt-6 font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
              Da vitrine para o <span className="text-gradient font-script text-[1.1em]">seu armário.</span>
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Quatro passos entre o look que você montou e ele no seu corpo. Simples, rápido e com a gente do seu lado.
            </p>
          </Reveal>
        </div>

        <ol ref={list} className="relative grid gap-6 pl-10 sm:pl-14">
          {/* fio dourado que corre conforme a página rola */}
          <span aria-hidden className="absolute bottom-6 left-[11px] top-6 w-[6px] rounded-full bg-cream/[0.06] sm:left-[19px]" />
          <motion.span
            aria-hidden
            style={{ scaleY: fill }}
            className="absolute bottom-6 left-[11px] top-6 w-[6px] origin-top rounded-full bg-gradient-to-b from-gold-soft via-gold to-rose shadow-[0_0_18px_rgb(216_185_138/0.45)] sm:left-[19px]"
          />
          {steps.map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, ease: easeOut }}
              className="border-gradient relative rounded-[1.75rem] bg-ink-2/80 p-6 sm:p-8"
            >
              <span
                aria-hidden
                className="bg-velvet absolute -left-10 top-7 grid size-7 place-items-center rounded-full text-[11px] font-bold text-gold-soft ring-4 ring-ink sm:-left-14 sm:size-11 sm:text-sm"
              >
                {i + 1}
              </span>
              <div className="flex items-start gap-5">
                <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-gold/10 text-3xl text-gold sm:grid">
                  <step.icon aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-2xl tracking-tight sm:text-3xl">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{step.text}</p>
                  <p className="mt-4 font-script text-2xl text-rose-soft">{step.note}</p>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
