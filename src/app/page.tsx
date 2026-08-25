import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Menu from "@/components/sections/Menu";
import Specials from "@/components/sections/Specials";
import Reviews from "@/components/sections/Reviews";
import Catering from "@/components/sections/Catering";
import FAQ from "@/components/sections/FAQ";
import Gallery from "@/components/sections/Gallery";
import Contact from "@/components/sections/Contact";
import { getSiteConfig } from "@/lib/data";

/**
 * Homepage
 *
 * ORDER: the menu comes second, directly under the hero.
 * The site's job is taking orders, and the menu used to sit in fourth place
 * behind two full-height sections of story and photographs — a customer who
 * arrived wanting dinner had to scroll past all of it. Specials follows the
 * menu, where "chef's picks" reads as an upsell to someone already browsing
 * food. Story, proof, catering and details come after, for the people who
 * scroll rather than the people who want to eat.
 *
 * Section backgrounds alternate so no two neighbours share one:
 *   hero photo -> cream -> dark -> white -> ink -> white -> cream -> white -> dark
 *
 * VISIBILITY: driven by `features.sections` in site-config.json, so a section
 * can be taken down from JSON without touching code. Hero, Menu and Contact are
 * NOT switchable — the menu is the product and the other two are how people find
 * and trust the place. Nothing here can gate ordering itself.
 */

export default function HomePage() {
  const { sections } = getSiteConfig().features;

  return (
    <>
      <Hero />
      <Menu />
      {sections.specials && <Specials />}
      {sections.about && <About />}
      {sections.gallery && <Gallery />}
      {sections.reviews && <Reviews />}
      {sections.catering && <Catering />}
      {sections.faq && <FAQ />}
      <Contact />
    </>
  );
}
