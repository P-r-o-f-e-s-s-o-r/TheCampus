/**
 * Sapiens Campus — Explore
 * Edit the public figures here. js/site.js copies them into the page.
 *
 * TODO: Confirm these numbers before treating them as fact.
 * They match the old public home (3000+ members / 20+ events / 50+ colleges)
 * and they are unconfirmed. The Dec 2025 sponsorship deck printed a
 * different set (2000+ students / 44+ colleges). Do not invent a third set.
 *
 * The HTML repeats the same strings so the page still reads with
 * JavaScript off. If you change a figure, update that fallback text too.
 */
(function (global) {
  global.SAPIENS_CAMPUS = {
    stats: {
      members: "3000+",
      events: "20+",
      colleges: "50+"
    },
    statsNote: "Figures as shown on the public community home",
    deck: {
      when: "Dec 2025",
      students: "2000+",
      colleges: "44+"
    }
  };
})(window);
