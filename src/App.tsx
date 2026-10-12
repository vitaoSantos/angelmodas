import { MotionConfig } from 'motion/react'
import { Background } from './components/layout/Background'
import { Cursor } from './components/layout/Cursor'
import { Footer } from './components/layout/Footer'
import { Loader } from './components/layout/Loader'
import { Navbar } from './components/layout/Navbar'
import { SmoothScroll } from './components/layout/SmoothScroll'
import { Catalog } from './components/sections/Catalog'
import { Community } from './components/sections/Community'
import { Contact } from './components/sections/Contact'
import { Fitting } from './components/sections/Fitting'
import { Hero } from './components/sections/Hero'
import { HowToBuy } from './components/sections/HowToBuy'
import { Lookbook } from './components/sections/Lookbook'
import { Marquee } from './components/sections/Marquee'
import { IntroProvider } from './context/IntroContext'
import { LookProvider } from './context/LookContext'
import { SiteDataProvider } from './context/SiteDataContext'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <IntroProvider>
        <SiteDataProvider>
          <LookProvider>
            <SmoothScroll>
              <Background />
              <Loader />
              <Cursor />
              <Navbar />
              <main id="conteudo">
                <Hero />
                <Marquee />
                <Catalog />
                <Fitting />
                <Lookbook />
                <HowToBuy />
                <Community />
                <Contact />
              </main>
              <Footer />
            </SmoothScroll>
          </LookProvider>
        </SiteDataProvider>
      </IntroProvider>
    </MotionConfig>
  )
}
