// Content for /bicycles. Everything on the page is rendered from this file, so
// adding a film, book, or link later is a one-line edit with no template changes.
//
// Leave `href` off an entry when the destination has not been confirmed. The
// renderer prints an unlinked name rather than guessing at a URL.

export type Entry = { name: string; note?: string; href?: string };
export type Link = { label: string; href: string };
export type Film = { title: string; year: string; what: string; links?: Link[] };
export type Book = { title: string; author: string; year: string; why: string };
export type Quote = { text: string; source: string };
export type Group = { heading: string; blurb?: string; items: Entry[] };

export const intro = [
  "I ride gravel, mountain, and dirt jumps, from laps at Eagle Rock to Pittsburgh's Dirty Dozen.",
  "This is the stuff I keep coming back to. Films mostly, plus the books, riders, and sites worth your time.",
];

export const filmSections: { heading: string; blurb?: string; films: Film[] }[] = [
  {
    heading: "Lachlan and Gus Morton",
    blurb:
      "Gus is the filmmaker brother. Thereabouts covers the whole body of work, first independently, then with Rapha, then with EF. Watch roughly in this order and you get the arc of Lachlan walking away from conventional pro racing and inventing the alternative calendar.",
    films: [
      {
        title: "Thereabouts",
        year: "2014",
        what: "The brothers ride from their childhood home in Port Macquarie to Uluru, about 2,500 km, after Lachlan burns out on pro racing. Directed by Scott Mitchell.",
        links: [{ label: "Watch on YouTube", href: "https://www.youtube.com/watch?v=QqoKsDBQCTY" }],
      },
      {
        title: "Thereabouts Reprise #2",
        year: "2015",
        what: "The second film. Confirmed on the Thereabouts channel under this title rather than the Thereabouts 2 the press used.",
        links: [{ label: "Watch on YouTube", href: "https://www.youtube.com/watch?v=QU5OUp2co_8" }],
      },
      {
        title: "Thereabouts Colombia",
        year: "2017",
        what: "Colombia's brutal climbs and cycling culture, plus the brothers returning to racing together.",
        links: [{ label: "Watch on YouTube", href: "https://www.youtube.com/watch?v=1eMmVd401Z4" }],
      },
      {
        title: "Outskirts",
        year: "2018 to 2019",
        what: "The second season of Thereabouts, made with Rapha. Three parts. Part 3, The Shadow of the East, is a 70 minute, seven country, 1,600 km ride from Montenegro to Turkey. The best of the set.",
        links: [
          { label: "1. Route 66", href: "https://www.youtube.com/watch?v=Dh25fH5diwQ" },
          { label: "2. The Big Land", href: "https://www.youtube.com/watch?v=AsC3ZKzObNQ" },
          { label: "3. The Shadow of the East", href: "https://www.youtube.com/watch?v=XuLfbKwcJ6Y" },
        ],

      },
      {
        title: "The Alt Tour",
        year: "2021",
        what: "Every stage and every transfer of the 2021 Tour de France, solo and self supported. About 5,500 km in 23 days. He beat the peloton to Paris and raised money for World Bicycle Relief. 38 minutes.",
        links: [{ label: "Watch on YouTube", href: "https://www.youtube.com/watch?v=eujxv77lGOI" }],
      },
      {
        title: "EF Gone Racing",
        year: "2019 onward",
        what: "Short films on the alt calendar rides: Badlands, GBDURO, Unbound, Munich to the Ukrainian border, and more.",
        links: [{ label: "Start with Kanza, episode 001", href: "https://www.youtube.com/watch?v=kPODHtTdO24" }],
      },
      {
        title: "The Divide",
        year: "2023 to 2024",
        what: "His 2023 Tour Divide ride, Banff to Antelope Wells, in 12 days, 12 hours, 21 minutes. Not an official record because of course deviations and the film crew, which is part of the story. EF's first full length film.",
        links: [{ label: "Watch on YouTube", href: "https://www.youtube.com/watch?v=ZYRKjKsDgyQ" }],
      },
      {
        title: "The Great Southern Country",
        year: "2025",
        what: "The 2024 lap of Australia, 14,200 km in 30 days, 9 hours, 59 minutes. Gus filmed it. Strong on the Outback, the support crew, and the Indigenous communities along the route.",
        links: [
          { label: "Watch on YouTube", href: "https://www.youtube.com/watch?v=XW1F79sfftA" },
          { label: "EF Pro Cycling", href: "https://efprocycling.com/culture/the-great-southern-country-film-tour" },
        ],

      },
    ],
  },
  {
    heading: "Payson McElveen",
    blurb:
      "Durango based pro, marathon MTB national champion, singlespeed world champion, Lifetime Grand Prix gravel racer, and host of The Adventure Stache. The Crossing films come from his own Stachehouse Productions.",
    films: [
      {
        title: "Crossing Iceland",
        year: "2022",
        what: "First single push, human powered crossing of Iceland, north to south, Akureyri to Vik. 257 miles of highland doubletrack and glacial rivers in 19 hours 45 minutes, carrying 7,000 calories with no resupply. 13 minutes, shot with Chris Burkard.",
        links: [{ label: "Bikepacking.com", href: "https://bikepacking.com/plog/crossing-iceland-video/" }],
      },
      {
        title: "Crossing Tasmania",
        year: "2023",
        what: "360 miles and about 34,000 feet of climbing, west coast to the Bay of Fires, in 32 hours. Deliberately slower, about letting go of the clock. Route built with local bikepacker Emma Flukes. Ends on the Blue Derby trails. About 21 minutes.",
        links: [{ label: "Bikepacking.com", href: "https://bikepacking.com/news/crossing-tasmania-film/" }],
      },
    ],
  },
  {
    heading: "The history of mountain biking",
    films: [
      {
        title: "Klunkerz: A Film About Mountain Bikes",
        year: "2006",
        what: "Billy Savage's history of the Marin County klunker scene on Mount Tamalpais. Repack, Schwinn Excelsiors pulled from dumps, Gary Fisher, Joe Breeze, Charlie Kelly, Tom Ritchey, and the Crested Butte and Cupertino crews. 83 minutes.",
        links: [{ label: "Green Planet Films", href: "https://greenplanetfilms.org/products/klunkerz-a-film-about-mountain-biking" }],
      },
      {
        title: "Camera Corner",
        year: "2024",
        what: "Wende Cragg was the only woman riding with the original Marin crew, and her Rolling Dinosaur Archive is close to the only photographic record of that era. Named for the switchback on the Repack course where she shot. The Radavist's first feature, directed by Josh Weinberg. Released free online in December 2024.",
        links: [{ label: "The Radavist", href: "https://theradavist.com/camera-corner-documentary-wende-cragg/" }],
      },
    ],
  },
  {
    heading: "Everything else",
    films: [
      {
        title: "A Sunday in Hell",
        year: "1976",
        what: "Jorgen Leth on Paris to Roubaix. Road, not dirt, but the foundational cycling film.",
      },
      { title: "Life Cycles", year: "2010", what: "Cinematic mountain biking, more art than edit." },
      { title: "The Moment", year: "2016", what: "The history of North Shore and freeride mountain biking." },
      {
        title: "The Ridge / Wee Day Out",
        year: "2014 / 2016",
        what: "Danny MacAskill. Short, endlessly rewatchable, and the kids will love them.",
      },
    ],
  },
];

export const riders: Entry[] = [
  { name: "Lachlan Morton", note: "Alt calendar, ultra distance, and the human side of pro cycling.", href: "https://en.wikipedia.org/wiki/Lachlan_Morton" },
  { name: "Gus Morton", note: "The filmmaker brother. Thereabouts." },
  { name: "Payson McElveen", note: "Mountain and gravel racing, the Crossing films, and the podcast." },
  { name: "Lael Wilcox", note: "Ultra distance bikepacking. Tour Divide and the round the world record." },
  { name: "Chris Burkard", note: "Photographer and filmmaker. Shot Crossing Iceland." },
  { name: "Rebecca Rusch", note: "Queen of Pain. Endurance mountain and gravel." },
  { name: "Ted King", note: "Ex pro turned gravel. Vermont. Unbound winner." },
  { name: "Wende Cragg", note: "A living link to the birth of the sport." },
];

export const creatorGroups: Group[] = [
  {
    heading: "Mountain biking",
    items: [
      { name: "Berm Peak", note: "Seth Alvo. Skills, builds, trail building. The trail building series is the one." },
      { name: "BKXC", note: "Point of view trail tours from all over North America. Good for trip ideas." },
      { name: "Skills with Phil", note: "Technique coaching." },
      { name: "Pinkbike", note: "Especially Ben Cathro's How to Bike series.", href: "https://www.pinkbike.com/" },
      { name: "GMBN", note: "Global Mountain Bike Network. The big all rounder." },
      { name: "Fluidride", note: "Instruction library." },
      { name: "Matt Jones and Brendan Fairclough", note: "Freeride and slopestyle entertainment." },
    ],
  },
  {
    heading: "Gravel and bikepacking",
    items: [
      { name: "Bikepacking.com", note: "Videos and the Plog film roundups.", href: "https://bikepacking.com/" },
      { name: "The Radavist", note: "Films, reportage, and Camera Corner.", href: "https://theradavist.com/" },
      { name: "Dylan Johnson", note: "Evidence based gravel training." },
      { name: "Path Less Pedaled", note: "Russ Roca and Laura Crawford. Touring and bikepacking." },
      { name: "Chris Hall", note: "UK ultra distance and gravel adventures." },
    ],
  },
  {
    heading: "Dirt jump and trials",
    items: [
      { name: "Danny MacAskill" },
      { name: "Harry Main" },
      { name: "Martin Soderstrom" },
    ],
  },
  {
    heading: "Wrenching",
    items: [
      { name: "Park Tool", note: "The YouTube channel and the repair help site.", href: "https://www.parktool.com/en-us/blog/repair-help" },
      { name: "Sheldon Brown", note: "The late Sheldon Brown's technical archive. Still the reference.", href: "https://www.sheldonbrown.com/" },
    ],
  },
];

export const books: Book[] = [
  { title: "Bicycle Diaries", author: "David Byrne", year: "2009", why: "The Talking Heads frontman rides a folding bike through cities on tour and thinks about urbanism, art, and music." },
  { title: "Fat Tire Flyer", author: "Charlie Kelly", year: "2014", why: "Repack and the birth of mountain biking, told by one of the founders. Pairs with Klunkerz and Camera Corner." },
  { title: "Bicycle: The History", author: "David V. Herlihy", year: "2004", why: "The definitive history of the machine." },
  { title: "The Lost Cyclist", author: "David V. Herlihy", year: "2010", why: "Frank Lenz's 1890s round the world ride, and his disappearance." },
  { title: "Wheels of Change", author: "Sue Macy", year: "2011", why: "How women rode the bicycle to freedom. Context for the Susan B. Anthony line below." },
  { title: "Roads Were Not Built for Cars", author: "Carlton Reid", year: "2014", why: "Cyclists, not motorists, pushed for paved roads." },
  { title: "The Rider", author: "Tim Krabbe", year: "1978", why: "A single amateur race told from inside the rider's head. The cult classic." },
  { title: "Full Tilt", author: "Dervla Murphy", year: "1965", why: "Ireland to India by bicycle. Solo, through Iran and Afghanistan, in 1963." },
  { title: "Miles from Nowhere", author: "Barbara Savage", year: "1983", why: "A two year, 25 country round the world tour." },
  { title: "Just Ride", author: "Grant Petersen", year: "2012", why: "Rivendell's founder against racer culture. The unracer manifesto." },
  { title: "Need for the Bike", author: "Paul Fournel", year: "2001", why: "Short lyrical essays. Good source for pull quotes." },
  { title: "The Wheels of Chance", author: "H. G. Wells", year: "1896", why: "A Victorian cycling holiday comedy. Public domain." },
  { title: "Bike Snob", author: "Eben Weiss", year: "2010", why: "New York cycling humor." },
  { title: "Zinn and the Art of Mountain Bike Maintenance", author: "Lennard Zinn", year: "many editions", why: "The shop manual." },
];

export const siteGroups: Group[] = [
  {
    heading: "Read",
    items: [
      { name: "Bikepacking.com", note: "Routes, gear, films. The single best gravel and bikepacking resource.", href: "https://bikepacking.com/" },
      { name: "The Radavist", note: "Photo heavy reportage, culture, history.", href: "https://theradavist.com/" },
      { name: "Escape Collective", note: "Independent road and gravel journalism.", href: "https://escapecollective.com/" },
      { name: "Pinkbike", note: "Mountain bike news and reviews.", href: "https://www.pinkbike.com/" },
      { name: "Vital MTB", note: "Reviews and race coverage.", href: "https://www.vitalmtb.com/" },
      { name: "Singletracks", note: "Trail reviews.", href: "https://www.singletracks.com/" },
      { name: "Adventure Cycling Association", note: "Long distance routes. Relevant for New Jersey to Maine.", href: "https://www.adventurecycling.org/" },
      { name: "Rene Herse", note: "Jan Heine on tires, gravel, and randonneuring.", href: "https://www.renehersecycles.com/" },
    ],
  },
  {
    heading: "Maps and trails",
    items: [
      { name: "Trailforks", note: "Trail maps and conditions.", href: "https://www.trailforks.com/" },
      { name: "MTB Project", note: "Trail maps and conditions.", href: "https://www.mtbproject.com/" },
      { name: "JORBA", note: "Jersey Off Road Bicycle Association. The local trail advocacy group.", href: "https://www.jorba.org/" },
    ],
  },
  {
    heading: "Forums",
    items: [
      { name: "r/MTB", href: "https://www.reddit.com/r/MTB/" },
      { name: "r/gravelcycling", href: "https://www.reddit.com/r/gravelcycling/" },
      { name: "r/bikepacking", href: "https://www.reddit.com/r/bikepacking/" },
      { name: "r/Dirtjumping", href: "https://www.reddit.com/r/Dirtjumping/" },
      { name: "r/bikewrench", href: "https://www.reddit.com/r/bikewrench/" },
      { name: "r/xbiking", note: "The vibe bike and Rivendell crowd.", href: "https://www.reddit.com/r/xbiking/" },
    ],
  },
];

export const quotes: Quote[] = [
  { text: "Life is like riding a bicycle. To keep your balance, you must keep moving.", source: "Albert Einstein, letter to his son Eduard, 1930" },
  { text: "Let me tell you what I think of bicycling. I think it has done more to emancipate women than anything else in the world.", source: "Susan B. Anthony, interviewed by Nellie Bly, New York World, 1896" },
  { text: "Get a bicycle. You will not regret it, if you live.", source: "Mark Twain, Taming the Bicycle" },
  { text: "It is by riding a bicycle that you learn the contours of a country best, since you have to sweat up the hills and coast down them.", source: "Ernest Hemingway, Fathers and Sons, 1933" },
  { text: "The bicycle is the most civilized conveyance known to man. Other forms of transport grow daily more nightmarish. Only the bicycle remains pure in heart.", source: "Iris Murdoch, The Red and the Green, 1965" },
  { text: "Cycle tracks will abound in Utopia.", source: "H. G. Wells, A Modern Utopia, 1905" },
  { text: "Ride as much or as little, or as long or as short as you feel. But ride.", source: "Eddy Merckx" },
  { text: "It never gets easier, you just go faster.", source: "Greg LeMond" },
];

export const quoteFootnote = {
  text: "The one everybody posts, about not despairing for the future of the human race when you see an adult on a bicycle, is not H. G. Wells. Quote Investigator traced the earliest appearance to a 1988 letter in Bicycle USA, forty two years after Wells died, and nothing in his writing matches. The Utopia line above is the real one.",
  href: "https://quoteinvestigator.com/2022/12/10/bicycle-hope/",
};
